"""Google-only city geocoding and country-aware reference resolution.

This is the single sanctioned planner-owned writer to reference ``City``
rows. Callers outside this module must treat reference data as read-only.
The temporary imports from reference place exploration and the reference
coordinate-backfill command are explicitly surfaced by
``check_layer_boundaries`` until geocoding ownership is consolidated.
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def geocode_city(name: str) -> dict | None:
    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        return None
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json" + f"?address={urllib.parse.quote(name)}&key={api_key}"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
        result = (data.get("results") or [None])[0]
        if not result:
            return None
        location = result["geometry"]["location"]
        country = next((c for c in result.get("address_components", []) if "country" in c.get("types", [])), {})
        return {
            "latitude": location.get("lat"), "longitude": location.get("lng"),
            "country_name": country.get("long_name"), "country_code": country.get("short_name"),
            "place_id": result.get("place_id"),
        }
    except Exception:
        return None


def backfill_city_coordinates(city, *, geocode: dict | None = None) -> bool:
    """R5 (docs/planner-complete-current-audit-and-repair-plan.md §19):
    a City row created without ever successfully geocoding (e.g. created
    during chat intake by a path that never called geocode_city at all —
    confirmed for real: a "Goa" row existed with place_id=None,
    lat=None, lng=None, while a fresh geocode_city("Goa") call succeeds
    fine) used to stay coordinate-less forever, silently failing every
    transport lookup for it (journey_resolver._coords -> None ->
    _nearest_hubs -> [] -> "No defensible door-to-door journey could be
    verified" for EVERY mode, not just scheduled ones — cab/self-drive
    need both endpoints' coordinates too). Shared by resolve_or_create_city
    (below) and journey_resolver.resolve_journey_options, which uses
    draft.origin_city/destination_city directly and runs BEFORE plan
    generation's own city-resolution phase ever gets a chance to backfill.
    Returns True if coordinates are present after this call (already had
    them, or just backfilled them).

    Bug fix: two City rows created from different raw name strings for the
    same real place (e.g. "New York" vs "New York City", no CityAlias
    linking them) both start with place_id=None — legal, Postgres allows
    multiple NULLs on a unique column. When each gets geocoded
    independently, Google resolves both to the identical place_id;
    whichever backfills second used to crash the whole pool-growth call
    with IntegrityError (unique constraint "reference_city_place_id_key")
    the instant it tried to save. Now checked before ever assigning it."""
    if city.latitude is not None and city.longitude is not None:
        return True
    geocode = geocode if geocode is not None else geocode_city(city.name)
    if not geocode or geocode.get("latitude") is None or geocode.get("longitude") is None:
        return False
    city.latitude = geocode["latitude"]
    city.longitude = geocode["longitude"]
    place_id = geocode.get("place_id")
    if not city.place_id and place_id:
        from apps.reference.models import City

        if City.objects.filter(place_id=place_id).exclude(pk=city.pk).exists():
            logger.warning(
                "backfill_city_coordinates: place_id %s already belongs to another City row; "
                "leaving city %s (%r) without a place_id — likely a duplicate city row for the same place.",
                place_id, city.pk, city.name,
            )
        else:
            city.place_id = place_id
    city.save(update_fields=["latitude", "longitude", "place_id"])
    return True


def resolve_or_create_city(name: str, *, country_hint=None):
    from apps.reference.models import City, Country

    parts = [part.strip() for part in name.split(",") if part.strip()]
    city_name = parts[0]
    textual_country = parts[-1] if len(parts) > 1 else None
    geocode = geocode_city(name)
    country_name = textual_country or (geocode or {}).get("country_name")
    country_code = (geocode or {}).get("country_code")
    country = country_hint
    if country_name:
        country = Country.objects.filter(name__iexact=country_name).first()
    if not country and country_code:
        country = Country.objects.filter(code__iexact=country_code).first()
    if not country:
        country = Country.objects.filter(name__iexact=settings.DEFAULT_COUNTRY_NAME).first()
    if not country:
        country, _ = Country.objects.get_or_create(
            code=(country_code or settings.DEFAULT_COUNTRY_CODE)[:2].upper(),
            defaults={"name": country_name or settings.DEFAULT_COUNTRY_NAME, "currency_code": settings.DEFAULT_CURRENCY_CODE},
        )
    from apps.reference.services.canonical_resolver import resolve_canonical_city

    with transaction.atomic():
        city = resolve_canonical_city(city_name, country_context=country.name if country else None)
        if city:
            backfill_city_coordinates(city, geocode=geocode)
            return city
        place_id = (geocode or {}).get("place_id")
        if place_id:
            # resolve_canonical_city matches by name/alias text only, never
            # by place_id — so it can miss a real duplicate (a differently
            # spelled name for a place another City row already represents).
            # If Google's geocode for THIS raw name is a place another row
            # already owns, that row IS the same real city; return it
            # instead of creating a second, colliding row (this is also
            # what previously reached the reference_city_place_id_key
            # IntegrityError here).
            existing = City.objects.filter(place_id=place_id).first()
            if existing:
                backfill_city_coordinates(existing, geocode=geocode)
                return existing
        return City.objects.create(
            name=city_name, country=country, place_id=place_id,
            latitude=(geocode or {}).get("latitude"), longitude=(geocode or {}).get("longitude"),
        )
