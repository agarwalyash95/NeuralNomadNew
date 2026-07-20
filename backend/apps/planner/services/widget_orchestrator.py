"""
WidgetOrchestrator — thin, data-driven widget routing over the canonical
intent ladders (services/intelligence/clusters.py).

The old 10-rung priority ladder (one widget per field, up to ~13 asks for a
full trip) is replaced by per-intent ladders of at most 5 asks + 1
confirmation. Recommendation content, reasons, and smart defaults come from
the Planner Intelligence Layer:

    Intelligence → best recommendation → widget payload

Payload builders are READ-ONLY on the draft — the old
_build_transport_selection_payload used to write preferred_mode + save() as
a side effect; mode suggestions now live only in prefilled/defaults.
"""

import math
from typing import Any, Dict, Optional, Tuple

from apps.planner.models import INTENT_FULL_TRIP
from apps.planner.services.intelligence.clusters import (
    CLUSTER_DEFS,
    INTENT_LADDERS,
    cluster_fields,
    cluster_satisfied,
    field_filled,
    nearby_cities_eligible,
)
from apps.planner.services.intelligence import recommendations as _recs
from apps.planner.services.intelligence import confidence as _confidence


class WidgetOrchestrator:
    """Walks the intent's ladder; emits the first unsatisfied step's widget."""

    @classmethod
    def determine_next_widget(cls, draft, ai_data) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        intent = draft.intent or INTENT_FULL_TRIP
        ladder = INTENT_LADDERS.get(intent, INTENT_LADDERS[INTENT_FULL_TRIP])
        meta = draft.metadata or {}

        for step in ladder:
            if step == "destination":
                if not draft.destination_text:
                    return "destination_search", cls._build_destination_payload(draft)
            elif step == "dates":
                if not (draft.start_date and draft.end_date):
                    return "date_range_picker", cls._build_date_payload(draft)
            elif step == "nearby_cities":
                mobility_widget = cls._next_self_drive_widget(draft)
                if mobility_widget:
                    return mobility_widget
                if nearby_cities_eligible(draft):
                    payload = cls._build_nearby_cities_payload(draft, ai_data)
                    # Pre-call (ai_data=None) always surface it as the active
                    # step so the prompt asks about it this turn. Post-call,
                    # only show the card once the model actually populated
                    # suggestions — a miss falls through to confirmation
                    # rather than blocking plan-anytime on a retry.
                    if ai_data is None or payload.get("suggestions"):
                        return "nearby_cities_recommendation", payload
                # not eligible / already shown / no suggestions yet -> continue ladder
            elif step == "confirmation":
                if not meta.get("plan_confirmation_submitted") and not meta.get("final_plan_confirmed"):
                    return "plan_confirmation_widget", cls._build_confirmation_payload(draft)
                return None, None
            elif step in CLUSTER_DEFS:
                if not cluster_satisfied(draft, step, intent):
                    return f"cluster_{step}", cls._build_cluster_payload(draft, intent, step)

        return None, None

    @classmethod
    def _next_self_drive_widget(cls, draft):
        """Ask route-relevant driving questions progressively, never as a bulk form."""
        from django.conf import settings

        if not getattr(settings, "PLANNER_ADAPTIVE_INTAKE_ENABLED", True):
            return None
        if (draft.intent or INTENT_FULL_TRIP) != INTENT_FULL_TRIP:
            return None
        meta = draft.metadata or {}
        if not cls._meaningful_road_journey(draft):
            return None
        mobility = dict(meta.get("mobility") or {})
        if mobility.get("can_drive") is None:
            return "self_drive_openness", {
                "stage": "openness", "required": False,
                "step_label": "Driving option",
                "step_hint": "Would you consider driving a useful road leg on this trip?",
                "defaults": {"can_drive": False},
            }
        if mobility.get("can_drive") is False:
            return None
        if mobility.get("license_ready") is None or not mobility.get("vehicle_access"):
            return "self_drive_readiness", {
                "stage": "readiness", "required": False,
                "step_label": "Driving readiness",
                "step_hint": "A license and vehicle choice determine whether self-drive is feasible.",
                "defaults": {"license_ready": False, "vehicle_access": "rental"},
            }
        if not mobility.get("license_ready"):
            return None
        distance = cls._road_distance_km(draft)
        if distance and distance >= 250 and mobility.get("max_driving_hours") is None:
            fields = ["max_driving_hours", "night_driving"]
            if any(token in (draft.destination_text or "").lower() for token in ("hill", "mount", "manali", "shimla", "ladakh", "sikkim")):
                fields.append("mountain_experience")
            return "self_drive_route_comfort", {
                "stage": "route_comfort", "required": False, "fields": fields,
                "distance_km": round(distance),
                "step_label": "Road comfort",
                "step_hint": "Set limits for this route; these override saved defaults for this trip.",
                "defaults": {"max_driving_hours": 6, "night_driving": False},
            }
        return None

    @classmethod
    def _meaningful_road_journey(cls, draft) -> bool:
        if (draft.metadata or {}).get("preferred_mode") == "self_drive":
            return True
        distance = cls._road_distance_km(draft)
        return bool(distance and 40 <= distance <= 900)

    @staticmethod
    def _road_distance_km(draft):
        origin = draft.origin_city
        destination = draft.destination_city
        if not origin and draft.origin_text:
            try:
                from apps.reference.models import City
                origin = City.objects.filter(name__iexact=draft.origin_text).first()
            except Exception:
                origin = None
        if not (origin and destination):
            return None
        coords = [origin.latitude, origin.longitude, destination.latitude, destination.longitude]
        if any(value is None for value in coords):
            return None
        lat1, lon1, lat2, lon2 = map(math.radians, map(float, coords))
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return 6371 * 2 * math.asin(math.sqrt(a)) * 1.18

    # ── Core-slot payloads ────────────────────────────────────────────────

    @classmethod
    def _build_destination_payload(cls, draft):
        return {
            "current_destination": draft.destination_text,
            "recommendation": {
                "text": "Pick the city or region you want to focus on — everything else keys off this.",
                "confidence": 92,
                "reasons": ["Destination sets prices, seasons, and routes"],
            },
            "step_label": "Destination",
            "step_hint": "Choose the city or region you want to explore.",
        }

    @classmethod
    def _build_date_payload(cls, draft):
        destination = draft.destination_text or "your destination"
        return {
            "start_date": draft.start_date.isoformat() if draft.start_date else None,
            "end_date": draft.end_date.isoformat() if draft.end_date else None,
            "recommendation": {
                "text": f"A 4–7 day window works well for {destination} without feeling rushed.",
                "confidence": 88,
                "reasons": ["Dates unlock real fares and hotel prices", "Season shapes what I recommend"],
            },
            "step_label": "Dates",
            "step_hint": "Pick a trip window so I can shape the pace around it.",
        }

    # ── Cluster payload (generic — one builder for every cluster card) ────

    @classmethod
    def _build_cluster_payload(cls, draft, intent: str, cluster: str) -> Dict[str, Any]:
        meta = draft.metadata or {}
        fields = cluster_fields(intent, cluster)
        defaults = _recs.cluster_defaults(draft, cluster, fields)
        recommendation = _recs.cluster_recommendation(draft, cluster, fields)

        # Actual known values win over defaults; defaults fill the gaps so
        # Done-without-touching submits the recommendation.
        prefilled: Dict[str, Any] = dict(defaults)
        for f in fields:
            current = cls._current_value(draft, f)
            if current is not None:
                prefilled[f] = current

        if "budget" in fields:
            amount, _, _ = _recs.recommended_budget_inr(draft, meta.get("visit_purpose"))
            prefilled.setdefault("budget_inr", meta.get("budget_inr") or amount)
            prefilled["recommended_budget_inr"] = amount

        payload: Dict[str, Any] = {
            "cluster": cluster,
            "fields": fields,
            "prefilled": prefilled,
            "defaults": defaults,
            "recommendation": recommendation,
            "step_label": CLUSTER_DEFS[cluster]["label"],
            "step_hint": CLUSTER_DEFS[cluster]["hint"],
        }

        # The explicit 5-way mode choice, with payload-embedded details so the
        # card reacts instantly (no round trip) when a mode is tapped.
        if "preferred_mode" in fields:
            payload["mode_options"] = _recs.build_mode_options(draft)

        return payload

    @classmethod
    def _current_value(cls, draft, field: str):
        meta = draft.metadata or {}
        if field == "travelers":
            return draft.adults if meta.get("travelers_set") else None
        if field == "budget":
            return draft.budget_tier or draft.budget_amount or None
        if field == "origin":
            return draft.origin_text or meta.get("origin") or None
        if field == "interests":
            return draft.interests or meta.get("interests") or None
        return meta.get(field)

    # ── Nearby-cities (excursion) payload ─────────────────────────────────

    @classmethod
    def _build_nearby_cities_payload(cls, draft, ai_data) -> Dict[str, Any]:
        suggestions = []
        if ai_data and getattr(ai_data, "nearby_cities", None):
            day_count = (
                (draft.end_date - draft.start_date).days + 1
                if draft.start_date and draft.end_date else 1
            )
            suggestions = [
                {
                    "city": s.city,
                    "distance": s.distance,
                    "why_visit": s.why_visit,
                    "recommended_duration": s.recommended_duration,
                    "proposed_day": min(index + 2, max(day_count - 1, 1)),
                    "added_travel_time_mins": None,
                    "required_visit_time": s.recommended_duration,
                    "incremental_cost": None,
                    "capacity_impact": "replaces part or most of the proposed day",
                    "replacement_required": True,
                    "requires_verification": True,
                    # Best-effort photo from the existing enriched catalog —
                    # never fabricated; None degrades to an icon card.
                    "image_url": cls._city_photo(s.city),
                }
                for index, s in enumerate(ai_data.nearby_cities)
            ]
        return {
            "destination": draft.destination_text or "",
            "suggestions": suggestions,
        }

    @staticmethod
    def _city_photo(city_name: str) -> Optional[str]:
        try:
            from apps.reference.models import AttractionMaster
            from apps.reference.services.provenance import exclude_unverified

            row = (
                exclude_unverified(AttractionMaster.objects.filter(city__name__icontains=city_name))
                .exclude(image_url__isnull=True)
                .exclude(image_url="")
                .order_by("-user_rating", "-user_ratings_total")
                .first()
            )
            return row.image_url if row else None
        except Exception:
            return None

    # ── Trip Review Card payload ──────────────────────────────────────────

    @classmethod
    def _build_confirmation_payload(cls, draft):
        meta = draft.metadata or {}
        duration_days = None
        if draft.start_date and draft.end_date:
            duration_days = (draft.end_date - draft.start_date).days + 1

        conf = _confidence.build_confidence(draft)
        inferred_fields = [f["label"] for f in conf["factors"] if f["state"] == "inferred"]

        summary = {
            "destination": draft.destination_text or "your destination",
            "start_date": draft.start_date.isoformat() if draft.start_date else None,
            "end_date": draft.end_date.isoformat() if draft.end_date else None,
            "duration": f"{duration_days} Days" if duration_days else None,
            "origin": draft.origin_text or meta.get("origin"),
            "travelers": draft.adults if meta.get("travelers_set") else None,
            "children": draft.children or 0,
            "visit_purpose": meta.get("visit_purpose"),
            "budget_tier": draft.budget_tier or None,
            "budget_inr": (
                int(draft.budget_amount)
                if draft.budget_amount is not None and draft.budget_currency == "INR"
                else meta.get("budget_inr")
            ),
            "preferred_mode": meta.get("preferred_mode"),
            "star_rating": meta.get("star_rating"),
            "property_type": meta.get("property_type"),
            "interests": draft.interests or [],
            "nearby_cities": meta.get("nearby_cities") or [],
        }

        payload = {
            # Back-compat keys the old PlanConfirmationWidget reads
            "destination": summary["destination"],
            "duration": summary["duration"] or "3 Days",
            # Trip Review Card
            "summary": summary,
            "inferred_fields": inferred_fields,
            "confidence": conf,
            "fine_tune": {
                "cluster": "fine_tune",
                "fields": cluster_fields(draft.intent or INTENT_FULL_TRIP, "fine_tune"),
                "label": CLUSTER_DEFS["fine_tune"]["label"],
            },
        }
        visa = _recs.visa_note(draft.destination_text)
        if visa:
            payload["visa_note"] = visa
        return payload
