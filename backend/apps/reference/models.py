import re
import unicodedata

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import connection, models
from django.utils import timezone
from pgvector.django import HnswIndex, VectorField

from apps.common.models import BaseModel

# Phase 7 (knowledge application migration, §12): HNSW is Postgres-only —
# SQLite test runs (config/settings/testing.py) tolerate the vector(768)
# column type but have no USING/WITH index syntax. Same guard
# apps.knowledge.models used before this phase's move.
_IS_POSTGRES = connection.vendor == "postgresql"

# ==========================================
# GEOGRAPHY
# ==========================================

class Country(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2 code")
    currency_code = models.CharField(max_length=3, blank=True, null=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Countries"

class State(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return f"{self.name}, {self.country.code}"

class City(models.Model):
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities", blank=True, null=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    coordinate_confidence = models.FloatField(
        blank=True, null=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    is_publishable = models.BooleanField(default=False, db_index=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)

    # Phase 3 (source registry & reconciliation) — open-data cross-identifiers.
    geonameid = models.BigIntegerField(blank=True, null=True, unique=True)
    wikidata_id = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    population = models.BigIntegerField(blank=True, null=True)
    district = models.ForeignKey(
        "District", on_delete=models.SET_NULL, null=True, blank=True, related_name="cities"
    )
    destination_tags = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.name}, {self.country.code}"

    class Meta:
        verbose_name_plural = "Cities"
        # Previously unconstrained — "Springfield" resolved to whichever row was
        # created first, in whichever country (see docs/travel-knowledge-engine-plan.md §3a).
        unique_together = ("name", "state", "country")
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_city_lat_lon_idx"),
        ]


# ==========================================
# TRANSPORT
# ==========================================

class Airport(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name="airports")
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    iata_code = models.CharField(max_length=3, unique=True)
    normalized_code = models.CharField(max_length=10, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    hub_importance = models.CharField(
        max_length=20, blank=True, null=True,
        choices=[("primary", "Primary"), ("secondary", "Secondary"), ("minor", "Minor")],
        default="minor"
    )

    # Phase 3 — open-data cross-identifiers.
    ourairports_ident = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    wikidata_id = models.CharField(max_length=20, blank=True, null=True, db_index=True)

    def __str__(self):
        return f"{self.name} ({self.iata_code})"

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_airport_lat_lon_idx"),
        ]

class Airline(models.Model):
    name = models.CharField(max_length=255)
    iata_code = models.CharField(max_length=2, unique=True)
    logo_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name


class _RouteFactsMixin(models.Model):
    """Phase 4 (§7.1): distance/frequency/schedule-shape + honesty fields shared by
    every scheduled-edge route table. ``fare_rule`` is deliberately NOT added here —
    it belongs alongside the Phase 5 ``FareRule`` model, not before it exists."""
    distance_km = models.FloatField(blank=True, null=True)
    frequency_per_day = models.PositiveSmallIntegerField(blank=True, null=True)
    # 7-char Mon..Sun bitmask string, e.g. "1111111" = every day. Default "all days"
    # is the honest prior for a single dated-service snapshot with no weekly pattern
    # observed yet (§9.3's V2 upgrade path attaches real operating-day data later).
    operating_days = models.CharField(max_length=7, default="1111111")
    service_class_meta = models.JSONField(default=dict, blank=True)
    provenance_tier = models.CharField(max_length=20, choices=[
        ("authoritative", "Authoritative source"),
        ("provider", "Verified provider"),
        ("open_dataset", "Reputable open dataset"),
        ("derived", "Calculated/derived"),
        ("suggested", "LLM-suggested/estimated"),
        ("quarantined", "Quarantined/uncertain"),
    ], default="derived")
    confidence = models.FloatField(default=0.5)
    freshness_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True


class AirportRoute(_RouteFactsMixin, models.Model):
    source = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name="departing_routes")
    destination = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name="arriving_routes")
    airline = models.ForeignKey(Airline, on_delete=models.CASCADE)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.source.iata_code} -> {self.destination.iata_code} ({self.airline.iata_code})"

class RailwayStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    code = models.CharField(max_length=10, unique=True)
    normalized_code = models.CharField(max_length=10, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    operational_form = models.CharField(
        max_length=40, blank=True,
        choices=[
            ("terminal", "Terminal"), ("through_station", "Through station"),
            ("junction", "Junction"), ("halt", "Halt"), ("suburban", "Suburban"),
            ("metro", "Metro"), ("unknown", "Unknown")
        ],
        default="unknown"
    )
    network_role = models.CharField(
        max_length=40, blank=True,
        choices=[
            ("primary_city_hub", "Primary city hub"), ("secondary_city_hub", "Secondary city hub"),
            ("regional_hub", "Regional hub"), ("local_station", "Local station"),
            ("interchange", "Interchange"), ("unknown", "Unknown")
        ],
        default="unknown"
    )
    derived_hub_score = models.FloatField(blank=True, null=True)
    derived_connectivity_score = models.FloatField(blank=True, null=True)
    derived_intelligence_meta = models.JSONField(default=dict, blank=True)

    # Phase 3 — open-data cross-identifier.
    wikidata_id = models.CharField(max_length=20, blank=True, null=True, db_index=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_rail_lat_lon_idx"),
        ]

class TrainRoute(_RouteFactsMixin, models.Model):
    source = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name="departing_trains")
    destination = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name="arriving_trains")
    train_name = models.CharField(max_length=255)
    train_number = models.CharField(max_length=20)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.train_number} - {self.train_name}"

class BusStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    code = models.CharField(max_length=10, blank=True, null=True)
    normalized_code = models.CharField(max_length=10, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    hub_importance = models.CharField(
        max_length=20, blank=True, null=True,
        choices=[("primary", "Primary"), ("secondary", "Secondary"), ("minor", "Minor")],
        default="minor"
    )

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_bus_lat_lon_idx"),
        ]

class BusRoute(_RouteFactsMixin, models.Model):
    source = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name="departing_buses")
    destination = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name="arriving_buses")
    operator_name = models.CharField(max_length=255)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.operator_name}: {self.source} -> {self.destination}"

class MetroStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    line_color = models.CharField(max_length=50, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.city.name})"


# ==========================================
# ENTITIES (Hotels, Restaurants, Attractions)
# ==========================================

class EnrichmentMixin(models.Model):
    """
    Freshness/quality metadata for Knowledge-Engine-cached entities. Applied to
    the four master tables below (each of which already functions as a cache,
    populated by apps.reference.services.places_explore's cache-on-miss path)
    so "cached" finally has an expiry — see docs/travel-knowledge-engine-plan.md §3a/§4.
    """
    last_enriched_at = models.DateTimeField(null=True, blank=True)
    enrichment_ttl_days = models.PositiveSmallIntegerField(default=30)
    data_completeness_score = models.FloatField(default=0.0)
    popularity_score = models.FloatField(default=0.0, db_index=True)
    source = models.CharField(max_length=40, default="google_places")

    # Added in Migration 0009_reference_provenance and declared here to stay in sync
    external_id = models.CharField(blank=True, db_index=True, max_length=255, null=True)
    verification_status = models.CharField(
        choices=[("verified", "Verified"), ("unverified", "Unverified"), ("quarantined", "Quarantined")],
        db_index=True, default="unverified", max_length=20
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    provenance_metadata = models.JSONField(blank=True, default=dict)
    is_quarantined = models.BooleanField(db_index=True, default=False)

    class Meta:
        abstract = True


class PlaceCrossIdMixin(models.Model):
    """Phase 6 (§11.1): open-data cross-identifiers + image-rights metadata,
    shared by the four entity master tables. Mirrors the exact field shape
    City/Airport/RailwayStation's Phase 3 ``wikidata_id`` already uses — one
    cross-id vocabulary across the reference app, not a per-model reinvention.
    All nullable: Google Places (this app's only writer to date) supplies
    none of these, and a row created before Phase 6 or never matched to an
    open-data source legitimately has none."""
    wikidata_id = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    osm_id = models.CharField(max_length=32, blank=True, null=True, db_index=True,
                               help_text="OSM 'type/id' form, e.g. 'way/123456789'.")
    image_license = models.CharField(max_length=60, blank=True, null=True,
                                      help_text="e.g. 'CC-BY-SA 4.0' — set only for images with a known open licence (Wikimedia), never for Google Photos.")
    image_attribution = models.CharField(max_length=255, blank=True, null=True)
    image_source = models.URLField(max_length=500, blank=True, null=True,
                                    help_text="Link to the licensed image's source page (e.g. a Wikimedia Commons file page).")

    class Meta:
        abstract = True


class HotelMaster(PlaceCrossIdMixin, EnrichmentMixin, models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    star_rating = models.DecimalField(max_digits=2, decimal_places=1, blank=True, null=True)
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_range = models.CharField(max_length=10, blank=True, null=True)  # e.g. $$, when Google reports one
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    address = models.TextField(blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Deep Details (Google Places), mirroring RestaurantMaster/AttractionMaster
    parking_options = models.JSONField(default=list, blank=True)
    payment_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    # [{"amenity": "rooftop pool", "active_months": [5,6,7,8,9]}] — inferred from
    # editorial data at enrichment time, tagged "estimated" (see PlaceInsight)
    seasonal_amenities = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_hotel_lat_lon_idx"),
        ]


class HotelRoomTier(models.Model):
    """Real room-tier data from live provider rate responses — never synthesized."""
    hotel = models.ForeignKey(HotelMaster, on_delete=models.CASCADE, related_name="room_tiers")
    tier_name = models.CharField(max_length=120)
    price_premium_pct = models.FloatField(blank=True, null=True)
    feature_tags = models.JSONField(default=list, blank=True)
    source = models.CharField(max_length=40, default="provider_rate_data")

    def __str__(self):
        return f"{self.hotel.name} — {self.tier_name}"


class RestaurantMaster(PlaceCrossIdMixin, EnrichmentMixin, models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    cuisine = models.CharField(max_length=255, blank=True, null=True)
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_range = models.CharField(max_length=10, blank=True, null=True) # e.g. $$
    price_level = models.IntegerField(null=True, blank=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Deep Details
    outdoor_seating = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)
    allows_dogs = models.BooleanField(null=True, blank=True)
    good_for_children = models.BooleanField(null=True, blank=True)
    menu_for_children = models.BooleanField(null=True, blank=True)
    serves_vegetarian_food = models.BooleanField(null=True, blank=True)
    dine_in = models.BooleanField(null=True, blank=True)
    takeout = models.BooleanField(null=True, blank=True)
    delivery = models.BooleanField(null=True, blank=True)

    parking_options = models.JSONField(default=list, blank=True)
    payment_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)
    
    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    reservation_policy = models.CharField(max_length=20, blank=True, null=True, choices=[
        ("walk_in", "walk_in"), ("recommended", "recommended"), ("required", "required"),
    ])
    typical_lead_time_days = models.PositiveSmallIntegerField(blank=True, null=True)
    # {"vegetarian": "full_menu"|"some_options"|"limited", "vegan": ..., "gluten_free": ..., "halal": ..., "kosher": ...}
    # supersedes the flat booleans above as the source of card copy; the booleans
    # stay as a fast-filter fallback (see docs/travel-intelligence-implementation-roadmap.md §1.2)
    dietary_accommodations = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_rest_lat_lon_idx"),
        ]

class AttractionMaster(PlaceCrossIdMixin, EnrichmentMixin, models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True) # e.g. Temple, Museum
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    suggested_duration_mins = models.IntegerField(blank=True, null=True)
    ticket_price_estimate = models.CharField(max_length=100, blank=True, null=True)

    # Deep Details
    good_for_children = models.BooleanField(null=True, blank=True)
    wheelchair_accessible = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)

    parking_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    # {"step_free": bool|null, "terrain": "paved"|"uneven"|"steep"|null,
    #  "typical_walk_distance_m": int|null, "difficulty_level": "easy"|"moderate"|"strenuous"|null}
    accessibility_detail = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_attr_lat_lon_idx"),
        ]

class ActivityMaster(PlaceCrossIdMixin, EnrichmentMixin, models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True) # e.g. Adventure, Sports
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_estimate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    suggested_duration = models.CharField(max_length=100, blank=True, null=True)
    difficulty_level = models.CharField(max_length=50, blank=True, null=True)

    # Deep Details
    good_for_children = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)
    guided_tour = models.BooleanField(null=True, blank=True)
    equipment_included = models.BooleanField(null=True, blank=True)

    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    accessibility_detail = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"], name="ref_act_lat_lon_idx"),
        ]


class CategoryVocabularyMap(models.Model):
    """Phase 6: makes the source-system-to-our-vocabulary category mapping an
    inspectable/extensible table instead of the inline Python dict literals
    ``places_explore.py``'s field mappers used to own privately. Google's
    existing mappings are seeded verbatim (same values, new home); OSM tag
    rows are added by ``import_osm_places`` as it encounters them."""
    source_system = models.CharField(max_length=20, choices=[
        ("google", "Google Places"), ("osm", "OpenStreetMap"), ("wikidata", "Wikidata"),
    ])
    entity_type = models.CharField(max_length=20, choices=[
        ("hotel", "Hotel"), ("restaurant", "Restaurant"),
        ("attraction", "Attraction"), ("activity", "Activity"),
    ])
    source_value = models.CharField(
        max_length=100,
        help_text="e.g. Google type 'lodging', or OSM tag 'tourism=hotel'.",
    )
    canonical_category = models.CharField(max_length=100)

    def __str__(self):
        return f"[{self.source_system}] {self.source_value} -> {self.canonical_category}"

    class Meta:
        unique_together = ("source_system", "entity_type", "source_value")


class TransferProfile(models.Model):
    """
    General orientation notes for an airport/station hub (typical minimum
    connection time, whether terminal changes are common) — deliberately a
    rough prior, not schedule-accurate data. Seeded via LLM general knowledge,
    upgraded if a provider ever supplies real connection-time data.
    """
    location_code = models.CharField(max_length=10, unique=True)  # IATA/station code
    typical_min_connection_mins = models.PositiveSmallIntegerField(blank=True, null=True)
    terminal_change_common = models.BooleanField(default=False)
    stair_heavy = models.BooleanField(blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=40, default="general_knowledge")

    def __str__(self):
        return self.location_code


# ==========================================
# UTILITIES
# ==========================================

class HolidayCalendar(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    date = models.DateField()
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, blank=True, null=True) # e.g. National, Regional

    def __str__(self):
        return f"{self.date}: {self.name} ({self.country.code})"

class WeatherNormals(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    month = models.IntegerField() # 1-12
    avg_temp_c = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    precipitation_mm = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)

    # Computed from a fixed temp/precipitation lookup table, not generated —
    # a wrong packing suggestion has real consequences (see
    # docs/travel-intelligence-implementation-roadmap.md §1.6).
    feels_like_bucket = models.CharField(max_length=20, blank=True, null=True)
    packing_note = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.city.name} - Month {self.month}"

    class Meta:
        unique_together = ("city", "month")  # previously unconstrained — duplicate month rows were possible

class TravelSeason(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    month = models.IntegerField() # 1-12
    season_type = models.CharField(max_length=50) # Peak, Shoulder, Off-Peak

    # [{"name": "cherry blossom", "typical_window": ["03-25","04-10"], "year_variability_days": 7}]
    # Always carries a variability window — never a single confident date.
    natural_phenomena = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.city.name} - Month {self.month}: {self.season_type}"

    class Meta:
        unique_together = ("city", "month")



class TravelPriceHistory(models.Model):
    """
    Historical and live travel price database (covering the last 3 years).
    Uses ForeignKeys linking to the existing master reference tables.
    """
    service_type = models.CharField(max_length=20, choices=[
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('bus', 'Bus'),
        ('hotel', 'Hotel'),
        ('cab', 'Cab'),
    ], db_index=True)
    
    date = models.DateField(db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    provider = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=50, blank=True, help_text='Flight number, train number, room type, cab type')

    # Stored on the row rather than re-derived at read time — previously a price
    # was tagged "verified" only on the request that first called a live
    # provider; every later read of the same row silently downgraded to
    # "estimated" (see docs/travel-knowledge-engine-plan.md §1). The actual
    # read-path fix (live_price.py) lands in K2; this is the schema half.
    provenance_tier = models.CharField(max_length=12, blank=True, null=True, choices=[
        ("verified", "verified"), ("estimated", "estimated"), ("suggested", "suggested"),
    ])

    # ForeignKeys linking to reference master tables
    airport_route = models.ForeignKey(AirportRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    train_route = models.ForeignKey(TrainRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    bus_route = models.ForeignKey(BusRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    hotel = models.ForeignKey(HotelMaster, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    city = models.ForeignKey(City, on_delete=models.CASCADE, null=True, blank=True, related_name='cab_historical_prices')
    
    classification = models.CharField(
        max_length=40, blank=True, null=True,
        choices=[
            ("provider_observation", "Provider observation"),
            ("historical_dataset_observation", "Historical dataset observation"),
            ("cached_live_response", "Cached live response"),
            ("calculated_estimate", "Calculated estimate"),
            ("mock_data", "Mock data"),
            ("unknown", "Unknown")
        ],
        default="unknown"
    )
    details = models.JSONField(default=dict, blank=True, help_text='Extra details like class breakdown, seat availability, duration, departure/arrival times')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'service_type', 'provider']
        verbose_name = 'Travel Price History'
        verbose_name_plural = 'Travel Price History'
        indexes = [
            models.Index(fields=['service_type', 'date']),
        ]

    def __str__(self):
        return f"[{self.service_type.upper()}] {self.provider} on {self.date}: INR {self.price}"


# ==========================================
# TEXT NORMALIZATION UTILITIES
# ==========================================

def normalize_display_name(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_search_name(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    text = re.sub(r"[''`\-–—.,/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_code(text):
    if not text:
        return ""
    text = re.sub(r"[^a-zA-Z0-9]", "", text)
    return text.upper().strip()


# ==========================================
# METROPOLITAN AREAS
# ==========================================

class MetroArea(models.Model):
    name = models.CharField(max_length=255)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="metro_areas")
    primary_city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="primary_for_metro",
        help_text="The city most users mean when they name this metro area",
    )
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)
    external_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    source = models.CharField(max_length=40, default="curated")
    verification_status = models.CharField(
        max_length=20,
        choices=[("verified", "Verified"), ("unverified", "Unverified"), ("quarantined", "Quarantined")],
        default="unverified", db_index=True,
    )
    verified_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_search_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}, {self.country.code}"


class MetroAreaAlias(models.Model):
    metro_area = models.ForeignKey(MetroArea, on_delete=models.CASCADE, related_name="aliases")
    alias_name = models.CharField(max_length=255, db_index=True)
    normalized_alias = models.CharField(max_length=255, db_index=True)
    alias_type = models.CharField(max_length=20, default="common")
    source = models.CharField(max_length=40, default="curated")

    def save(self, *args, **kwargs):
        self.normalized_alias = normalize_search_name(self.alias_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.alias_name} → {self.metro_area.name}"


class MetroAreaCity(models.Model):
    MEMBERSHIP_TYPES = [
        ("core", "Core city"),
        ("satellite", "Satellite city"),
        ("suburb", "Suburb"),
        ("commuter_city", "Commuter city"),
        ("airport_city", "Airport city"),
        ("cross_border", "Cross-border/Special classification"),
    ]
    metro_area = models.ForeignKey(MetroArea, on_delete=models.CASCADE, related_name="member_cities")
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="metro_memberships")
    membership_type = models.CharField(max_length=20, choices=MEMBERSHIP_TYPES, default="core")
    is_primary = models.BooleanField(default=False)
    source = models.CharField(max_length=40, default="curated")
    confidence = models.FloatField(default=1.0)
    verification_status = models.CharField(max_length=20, default="unverified")
    verified_at = models.DateTimeField(blank=True, null=True)
    valid_from = models.DateField(blank=True, null=True)
    valid_to = models.DateField(blank=True, null=True)

    def clean(self):
        # 1. Cross-border checks
        if self.city.country_id != self.metro_area.country_id and self.membership_type != "cross_border":
            raise ValidationError(
                "A membership cannot reference a city from an incompatible country without an explicit 'cross_border' classification."
            )
        
        # 2. Only one active primary city per metro area
        if self.is_primary:
            siblings = MetroAreaCity.objects.filter(metro_area=self.metro_area, is_primary=True)
            if self.pk:
                siblings = siblings.exclude(pk=self.pk)
            if siblings.exists():
                raise ValidationError("Only one active primary city is allowed per metro area.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        # Ensure MetroArea.primary_city matches
        if self.is_primary and self.metro_area.primary_city != self.city:
            self.metro_area.primary_city = self.city
            self.metro_area.save(update_fields=["primary_city"])

    def __str__(self):
        return f"{self.city.name} ∈ {self.metro_area.name} ({self.membership_type})"


# ==========================================
# CITY ALIASES
# ==========================================

class CityAlias(models.Model):
    ALIAS_TYPES = [
        ("official", "Official name"),
        ("common", "Common name"),
        ("old", "Old/historical name"),
        ("local_language", "Local language name"),
        ("alternate_spelling", "Alternate English spelling"),
        ("airport_name", "Airport-style city name"),
        ("railway_search", "Railway search spelling"),
        ("provider_specific", "Provider-specific name"),
        ("abbreviation", "Abbreviation"),
    ]
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="aliases")
    alias_name = models.CharField(max_length=255, db_index=True)
    normalized_alias = models.CharField(max_length=255, db_index=True)
    alias_type = models.CharField(max_length=20, choices=ALIAS_TYPES, default="common")
    language_code = models.CharField(max_length=10, blank=True, null=True)
    provider = models.CharField(max_length=60, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    source = models.CharField(max_length=40, default="curated")
    verification_status = models.CharField(
        max_length=20,
        choices=[("verified", "Verified"), ("unverified", "Unverified"), ("quarantined", "Quarantined")],
        default="unverified",
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        self.normalized_alias = normalize_search_name(self.alias_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.alias_name} → {self.city.name} ({self.alias_type})"


# ==========================================
# LOCALITIES
# ==========================================

class Locality(models.Model):
    LOCALITY_TYPES = [
        ("district", "District"),
        ("neighbourhood", "Neighbourhood"),
        ("business_district", "Business district"),
        ("tourism_district", "Tourism district"),
        ("old_city", "Old city"),
        ("airport_area", "Airport area"),
        ("railway_area", "Railway station area"),
        ("suburb", "Suburb"),
        ("satellite_city", "Satellite city"),
        ("administrative_zone", "Administrative zone"),
    ]
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="localities")
    parent_locality = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="sub_localities",
    )
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    locality_type = models.CharField(max_length=20, choices=LOCALITY_TYPES, default="district")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    external_place_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    tourism_importance = models.CharField(
        max_length=20, blank=True, null=True,
        choices=[("primary", "Primary"), ("secondary", "Secondary"), ("emerging", "Emerging"), ("niche", "Niche")],
    )
    transfer_relevance = models.BooleanField(default=False)
    source = models.CharField(max_length=40, default="curated")
    verification_status = models.CharField(
        max_length=20,
        choices=[("verified", "Verified"), ("unverified", "Unverified"), ("quarantined", "Quarantined")],
        default="unverified",
    )
    verified_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_search_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}, {self.city.name}"


class LocalityAlias(models.Model):
    locality = models.ForeignKey(Locality, on_delete=models.CASCADE, related_name="aliases")
    alias_name = models.CharField(max_length=255, db_index=True)
    normalized_alias = models.CharField(max_length=255, db_index=True)
    alias_type = models.CharField(max_length=20, default="common")
    language_code = models.CharField(max_length=10, blank=True, null=True)
    provider = models.CharField(max_length=60, blank=True, null=True)
    source = models.CharField(max_length=40, default="curated")
    verification_status = models.CharField(max_length=20, default="unverified")
    verified_at = models.DateTimeField(blank=True, null=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        self.normalized_alias = normalize_search_name(self.alias_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.alias_name} → {self.locality.name}"


# ==========================================
# EXPLICIT SERVICE AREA MODELS
# ==========================================

class _BaseServiceArea(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    locality = models.ForeignKey(Locality, on_delete=models.SET_NULL, null=True, blank=True)
    metro_area = models.ForeignKey(MetroArea, on_delete=models.SET_NULL, null=True, blank=True)
    distance_km = models.FloatField(blank=True, null=True)
    distance_type = models.CharField(
        max_length=30,
        choices=[
            ("straight_line", "Straight line"),
            ("road", "Road distance"),
            ("rail", "Rail distance"),
            ("walking", "Walking distance"),
            ("provider_reported", "Provider reported")
        ],
        default="straight_line"
    )
    typical_transfer_mins = models.PositiveSmallIntegerField(blank=True, null=True)
    transfer_mode = models.CharField(
        max_length=20,
        choices=[
            ("cab", "Cab"), ("metro", "Metro"), ("bus", "Bus"),
            ("walk", "Walk"), ("mixed", "Mixed"), ("unknown", "Unknown")
        ],
        default="unknown"
    )
    traffic_context = models.CharField(
        max_length=20,
        choices=[
            ("normal", "Normal traffic"), ("peak", "Peak traffic"),
            ("off_peak", "Off-peak traffic"), ("unknown", "Unknown")
        ],
        default="unknown"
    )
    is_primary_hub = models.BooleanField(default=False)
    is_estimated = models.BooleanField(default=True)
    calculated_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=40, default="derived")
    confidence = models.FloatField(default=0.5)
    verified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True

    def clean(self):
        if not self.city and not self.locality and not self.metro_area:
            raise ValidationError("At least one of city, locality, or metro area must be provided.")
        if self.locality and self.locality.city_id != self.city_id:
            raise ValidationError("The locality must belong to the specified city.")
        if self.metro_area and self.city and not MetroAreaCity.objects.filter(metro_area=self.metro_area, city=self.city).exists():
            raise ValidationError("The city must belong to the specified metropolitan area.")
        if self.distance_km is not None and self.distance_km < 0:
            raise ValidationError("Distance cannot be negative.")
        if self.typical_transfer_mins is not None and self.typical_transfer_mins < 0:
            raise ValidationError("Transfer time cannot be negative.")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValidationError("Confidence must be between 0.0 and 1.0.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class RailwayStationServiceArea(_BaseServiceArea):
    station = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name="service_areas")

    def __str__(self):
        return f"{self.station.name} serves {self.city.name}"


class AirportServiceArea(_BaseServiceArea):
    airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name="service_areas")

    def __str__(self):
        return f"{self.airport.name} serves {self.city.name}"


class BusStationServiceArea(_BaseServiceArea):
    bus_station = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name="service_areas")

    def __str__(self):
        return f"{self.bus_station.name} serves {self.city.name}"


# ==========================================
# FIELD-LEVEL PROVENANCE
# ==========================================

class ReferenceFieldProvenance(models.Model):
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64, db_index=True)
    field_name = models.CharField(max_length=100)
    source_name = models.CharField(max_length=100)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    retrieved_at = models.DateTimeField(blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)
    confidence = models.FloatField(default=0.5)
    provenance_tier = models.CharField(max_length=20, choices=[
        ("authoritative", "Authoritative source"),
        ("provider", "Verified provider"),
        ("open_dataset", "Reputable open dataset"),
        ("derived", "Calculated/derived"),
        ("suggested", "LLM-suggested/estimated"),
        ("quarantined", "Quarantined/uncertain"),
    ], default="derived")
    raw_value_hash = models.CharField(max_length=64, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_current = models.BooleanField(default=True)
    superseded_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.field_name} on {self.content_type}:{self.object_id} ({self.provenance_tier})"


# ==========================================
# PRICE OBSERVATIONS AND SUMMARIES
# ==========================================

class TravelPriceObservation(models.Model):
    service_type = models.CharField(max_length=20, choices=[
        ('flight', 'Flight'), ('train', 'Train'), ('bus', 'Bus'),
        ('hotel', 'Hotel'), ('cab', 'Cab'),
    ], db_index=True)
    observed_date = models.DateField(db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    provider = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=50, blank=True)

    airport_route = models.ForeignKey(AirportRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='price_observations')
    train_route = models.ForeignKey(TrainRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='price_observations')
    bus_route = models.ForeignKey(BusRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='price_observations')
    hotel = models.ForeignKey(HotelMaster, on_delete=models.CASCADE, null=True, blank=True, related_name='price_observations')
    city = models.ForeignKey(City, on_delete=models.CASCADE, null=True, blank=True, related_name='cab_price_observations')

    source_type = models.CharField(max_length=20, choices=[
        ("live_api", "Live API fetch"),
        ("historical_import", "Historical data import"),
        ("provider_cache", "Provider cache"),
    ], default="live_api")
    retrieved_at = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"[{self.service_type}] {self.provider} {self.observed_date}: {self.price}"


class TravelPriceSummary(models.Model):
    service_type = models.CharField(max_length=20, choices=[
        ('flight', 'Flight'), ('train', 'Train'), ('bus', 'Bus'),
        ('hotel', 'Hotel'), ('cab', 'Cab'),
    ], db_index=True)
    origin_city = models.ForeignKey(City, on_delete=models.CASCADE, null=True, blank=True, related_name='price_summaries_origin')
    destination_city = models.ForeignKey(City, on_delete=models.CASCADE, null=True, blank=True, related_name='price_summaries_destination')
    currency = models.CharField(max_length=3, default='INR')

    median_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    p25_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    p75_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    price_band = models.CharField(max_length=20, blank=True, null=True, choices=[
        ("budget", "Budget"), ("moderate", "Moderate"), ("premium", "Premium"), ("luxury", "Luxury"),
    ])
    seasonal_index = models.FloatField(blank=True, null=True)
    month = models.PositiveSmallIntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(12)])

    observation_period_start = models.DateField()
    observation_period_end = models.DateField()
    sample_count = models.PositiveIntegerField(default=0)
    calculation_date = models.DateField(auto_now=True)
    algorithm_version = models.CharField(max_length=20, default="v1")
    source_coverage = models.CharField(max_length=255, blank=True)
    confidence = models.FloatField(default=0.5)
    includes_taxes = models.BooleanField(default=False)

    def __str__(self):
        return f"[{self.service_type}] summary {self.origin_city} → {self.destination_city}: {self.median_price}"


# ==========================================
# SOURCE REGISTRY, STAGING & RECONCILIATION (Phase 3)
# ==========================================

class District(models.Model):
    """India LGD district. ``lgd_code`` is the canonical identifier once a
    dedicated LGD crosswalk import exists; it is nullable until then (Phase 3
    populates districts from GeoNames ADM2 rows without an LGD crosswalk)."""
    lgd_code = models.CharField(max_length=20, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="districts")
    source = models.CharField(max_length=40, default="geonames_adm2")

    def __str__(self):
        return f"{self.name}, {self.state.name}"

    class Meta:
        unique_together = ("name", "state")


class SourceRegistry(models.Model):
    """One row per external open-data source consumed anywhere in ``reference``."""
    slug = models.SlugField(max_length=60, unique=True)
    publisher = models.CharField(max_length=255)
    licence_name = models.CharField(max_length=120)
    licence_url = models.URLField(max_length=500, blank=True, null=True)
    licence_verified_at = models.DateTimeField(blank=True, null=True)
    storage_permissions = models.JSONField(
        default=dict, blank=True,
        help_text="e.g. {'raw': true, 'normalized': true}",
    )
    attribution_text = models.TextField(blank=True)
    priority_rank = models.PositiveSmallIntegerField(default=100)
    active = models.BooleanField(
        default=False,
        help_text="Importers must refuse to run against an inactive source.",
    )

    def __str__(self):
        return f"{self.slug} ({'active' if self.active else 'inactive'})"

    class Meta:
        verbose_name_plural = "Source registry"
        ordering = ["priority_rank", "slug"]


class SourceRelease(models.Model):
    """A specific downloaded/fetched version of a registered source."""
    source = models.ForeignKey(SourceRegistry, on_delete=models.CASCADE, related_name="releases")
    version_label = models.CharField(max_length=100, blank=True)
    release_date = models.DateField(blank=True, null=True)
    file_checksum = models.CharField(max_length=128, blank=True)
    record_count = models.PositiveIntegerField(blank=True, null=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source.slug} @ {self.version_label or self.downloaded_at.date()}"


class ImportBatch(models.Model):
    """One row per importer run. Every importer command writes exactly one."""
    release = models.ForeignKey(SourceRelease, on_delete=models.CASCADE, related_name="batches")
    command_name = models.CharField(max_length=100)
    params = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(
        max_length=20, default="running",
        choices=[
            ("running", "Running"), ("completed", "Completed"),
            ("failed", "Failed"), ("dry_run", "Dry run"),
        ],
    )
    dry_run = models.BooleanField(default=True)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    conflicted_count = models.PositiveIntegerField(default=0)
    quarantined_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.command_name} batch #{self.pk} ({self.status})"


class StagingRecord(models.Model):
    """Quarantine area for imported rows before/pending reconciliation. Never
    planner-visible — nothing outside ``apps.reference`` import/reconciliation
    code may read this table."""
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="staging_records")
    raw_payload = models.JSONField(default=dict, blank=True)
    source_record_id = models.CharField(max_length=255, blank=True, db_index=True)
    normalized_payload = models.JSONField(default=dict, blank=True)
    match_status = models.CharField(
        max_length=20, default="unmatched",
        choices=[
            ("unmatched", "Unmatched"), ("matched", "Matched"),
            ("ambiguous", "Ambiguous"), ("rejected", "Rejected"),
        ],
        db_index=True,
    )
    matched_content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    matched_object_id = models.CharField(max_length=64, blank=True, null=True)
    match_confidence = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"staging {self.source_record_id} ({self.match_status})"


class ProviderEntityMap(models.Model):
    """General-case cross-identifier map: (source slug, external id) -> canonical
    entity. Fast-path columns (place_id/geonameid/wikidata_id/iata/code) remain
    the common case; this table exists for sources without a dedicated column."""
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64, db_index=True)
    source = models.ForeignKey(SourceRegistry, on_delete=models.CASCADE, related_name="entity_maps")
    external_id = models.CharField(max_length=255, db_index=True)
    matched_at = models.DateTimeField(auto_now_add=True)
    match_confidence = models.FloatField(default=1.0)

    def __str__(self):
        return f"{self.source.slug}:{self.external_id} -> {self.content_type}:{self.object_id}"

    class Meta:
        unique_together = ("source", "external_id")


class DataQualityIssue(models.Model):
    """Generic-FK issue log feeding reports 3/8/9 and the human-gated merge
    command. Never auto-resolved except by an explicit merge/decision."""
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64, db_index=True)
    issue_type = models.CharField(
        max_length=30,
        choices=[
            ("coordinate_conflict", "Coordinate conflict"),
            ("duplicate_candidate", "Duplicate candidate"),
            ("identity_conflict", "Identity conflict"),
            ("licence_block", "Licence block"),
            ("coordinate_out_of_range", "Coordinate out of range"),
        ],
        db_index=True,
    )
    details = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20, default="open",
        choices=[("open", "Open"), ("resolved", "Resolved"), ("accepted", "Accepted")],
        db_index=True,
    )
    resolution_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.issue_type} on {self.content_type}:{self.object_id} ({self.status})"


# ==========================================
# HUB TRANSFER LINKS (Phase 4)
# ==========================================

class HubTransferLink(models.Model):
    """Intra-city hub<->hub transfer edge (e.g. a railway terminus <-> the city's
    airport). Generic FK on both ends so it can link any two of
    Airport/RailwayStation/BusStation.

    Population strategy this phase is adapted from the master plan's "top-50 metro
    areas" design: ``MetroArea``/``MetroAreaCity`` are unpopulated in this tree, so
    links are built from same-city hub pairs for the top cities by population
    instead (see ``populate_hub_transfer_links``), not metro-area membership.
    """
    from_content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE, related_name="+"
    )
    from_object_id = models.CharField(max_length=64, db_index=True)
    to_content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE, related_name="+"
    )
    to_object_id = models.CharField(max_length=64, db_index=True)
    distance_km = models.FloatField(blank=True, null=True)
    typical_transfer_mins = models.PositiveSmallIntegerField(blank=True, null=True)
    mode = models.CharField(
        max_length=20, default="cab",
        choices=[("cab", "Cab"), ("metro", "Metro"), ("walk", "Walk"), ("mixed", "Mixed")],
    )
    min_connection_mins = models.PositiveSmallIntegerField(blank=True, null=True)
    provenance_tier = models.CharField(max_length=20, choices=[
        ("authoritative", "Authoritative source"),
        ("provider", "Verified provider"),
        ("open_dataset", "Reputable open dataset"),
        ("derived", "Calculated/derived"),
        ("suggested", "LLM-suggested/estimated"),
        ("quarantined", "Quarantined/uncertain"),
    ], default="derived")
    confidence = models.FloatField(default=0.5)

    def __str__(self):
        return f"{self.from_content_type}:{self.from_object_id} <-> {self.to_content_type}:{self.to_object_id}"

    class Meta:
        unique_together = ("from_content_type", "from_object_id", "to_content_type", "to_object_id")


# ==========================================
# PRICE ESTIMATION (Phase 5)
# ==========================================

class FareRule(models.Model):
    """A published or formalized fare formula — official fare-table slabs (train),
    per-km bands (bus), or a rate card (cab) — replacing the hardcoded price
    literals that used to live in planner service modules. This is class 1/2 of
    the price-estimation ladder (docs/plans/reference-foundation-and-planner-
    intelligence-master-plan.md §10.1): ``authoritative-rule`` when the params
    come from a real published table, ``estimated``/``derived`` when they're our
    own parameterized rule. Never a fabricated number — a category with no
    confidently-sourced rule simply has no row, and the estimator falls back
    honestly rather than inventing one (see ``price_estimator.py``)."""

    category = models.CharField(max_length=20, choices=[
        ("train", "Train"), ("bus", "Bus"), ("cab", "Cab"), ("metro", "Metro"),
    ], db_index=True)
    name = models.CharField(max_length=255, help_text="Human label, e.g. 'UPSRTC Ordinary Bus'")
    scope = models.CharField(max_length=20, choices=[
        ("national", "National default"),
        ("state", "State-specific"),
        ("city_tier", "City-tier"),
        ("route", "Specific route"),
    ], default="national")
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True, related_name="fare_rules",
        help_text="Set for state/city-tier/route-scoped rules; null for a national default.",
    )
    service_class = models.CharField(
        max_length=40, blank=True,
        help_text="e.g. sleeper/3ac/2ac/1ac for train, non_ac/ac for bus, hatchback/sedan/suv for cab.",
    )
    unit = models.CharField(max_length=20, choices=[
        ("per_km", "Per km"), ("flat", "Flat fare"), ("per_day", "Per day"),
    ], default="per_km")
    params = models.JSONField(
        default=dict, blank=True,
        help_text="e.g. {'base_fare': 300, 'per_km': 16} or a distance-slab list.",
    )

    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    source = models.ForeignKey(
        SourceRegistry, on_delete=models.SET_NULL, null=True, blank=True, related_name="fare_rules",
    )

    # Same provenance vocabulary _RouteFactsMixin established for Phase 4's route
    # models — one enum across the reference app, not a per-model reinvention.
    provenance_tier = models.CharField(max_length=20, choices=[
        ("authoritative", "Authoritative source"),
        ("provider", "Verified provider"),
        ("open_dataset", "Reputable open dataset"),
        ("derived", "Calculated/derived"),
        ("suggested", "LLM-suggested/estimated"),
        ("quarantined", "Quarantined/uncertain"),
    ], default="derived")
    confidence = models.FloatField(default=0.5)
    freshness_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"[{self.category}] {self.name} ({self.scope})"

    class Meta:
        verbose_name = "Fare rule"
        verbose_name_plural = "Fare rules"
        ordering = ["category", "scope", "-valid_from"]
        indexes = [
            models.Index(fields=["category", "is_active"], name="ref_farerule_cat_active_idx"),
        ]


# ==========================================
# KNOWLEDGE APPLICATION MIGRATION (Phase 7, §12)
# ==========================================
# Relocated from apps.knowledge — state-only move (SeparateDatabaseAndState,
# see migration 0018_phase7_knowledge_migration), the real tables
# (knowledge_entityembedding/knowledge_distanceedge/knowledge_placeinsight/
# knowledge_localtip) are untouched, db_table is pinned below so Django's
# default app-label-based naming doesn't imply a rename. apps.knowledge
# keeps re-exporting these names as a compatibility shim.

class EntityEmbedding(BaseModel):
    """Generic — decoupled from the master tables so the embedding model can version independently."""
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    embedding = VectorField(dimensions=768)
    embedding_version = models.CharField(max_length=40)  # e.g. "gemini-text-embedding-004"
    source_text_hash = models.CharField(max_length=64)  # detects when the underlying text changed

    class Meta:
        db_table = "knowledge_entityembedding"
        unique_together = ("content_type", "object_id", "embedding_version")
        indexes = [
            HnswIndex(
                name="entity_embedding_hnsw",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ] if _IS_POSTGRES else []

    def __str__(self):
        return f"embedding({self.object_id}, {self.embedding_version})"


class PlaceInsight(BaseModel):
    """Cached AI-generated text — replaces hardcoded per-category copy with real, cached synthesis."""
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    insight_type = models.CharField(max_length=40)  # e.g. noise_profile, signature_dish, real_duration
    context_hash = models.CharField(max_length=64, db_index=True)  # hash of (item + trip context) that produced this text
    text = models.TextField(blank=True)
    structured = models.JSONField(default=dict, blank=True)  # for insight types richer than one string
    provenance = models.JSONField(default=dict, blank=True)  # block_schema.make_provenance() shape
    expires_at = models.DateTimeField()

    # Phase 7 (§12.1): the enrichment/reconciliation machinery already
    # records source_name/tier per field elsewhere (ReferenceFieldProvenance)
    # but PlaceInsight/LocalTip never captured what actually produced the
    # cached text itself — added here, nullable, so 1,129/87 pre-existing
    # rows are left honestly blank rather than backfilled with a guess.
    generation_method = models.CharField(max_length=40, blank=True, null=True)  # e.g. "llm_synthesis"
    source_inputs = models.JSONField(default=list, blank=True)  # facts/fields the generation prompt was grounded in

    class Meta:
        db_table = "knowledge_placeinsight"
        unique_together = ("content_type", "object_id", "insight_type", "context_hash")

    def __str__(self):
        return f"{self.insight_type}({self.object_id})"


class LocalTip(BaseModel):
    # No GenericForeignKey — object_id must support both int (reference app)
    # and UUID (knowledge/planner app) primary keys, which GenericForeignKey
    # doesn't handle uniformly; resolve target rows by (content_type, object_id) directly.
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)

    category = models.CharField(max_length=40, choices=[
        ("scam_warning", "scam_warning"), ("after_dark", "after_dark"),
        ("etiquette", "etiquette"), ("emergency_prep", "emergency_prep"),
        ("safety", "safety"), ("money", "money"), ("transport", "transport"), ("food", "food"),
    ])
    tip_text = models.TextField()
    source = models.CharField(max_length=60, blank=True)  # llm-researched / community / official
    source_url = models.URLField(blank=True)  # strongly recommended for category="scam_warning"
    confidence = models.CharField(max_length=12, choices=[
        ("verified", "verified"), ("estimated", "estimated"), ("suggested", "suggested"),
    ], default="suggested")
    # Auto-generated scam/after-dark tips are gated behind manual review by
    # default — a wrong safety claim isn't proportionally bad the way a wrong
    # restaurant tip is. Etiquette tips may auto-publish.
    needs_human_review = models.BooleanField(default=True)

    # Phase 7 (§12.1): same rationale as PlaceInsight.generation_method/
    # source_inputs above — nullable, existing 87 rows left honestly blank.
    generation_method = models.CharField(max_length=40, blank=True, null=True)
    source_inputs = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "knowledge_localtip"
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"[{self.category}] {self.tip_text[:60]}"


class DistanceEdge(BaseModel):
    """TTL'd multi-mode distance/duration cache — reference-owned (consumed by
    planner.services.distance_service)."""
    origin_key = models.CharField(max_length=255, db_index=True)
    destination_key = models.CharField(max_length=255, db_index=True)
    mode = models.CharField(max_length=20, db_index=True)  # walking, driving, transit, cycling, flight, train, bus
    distance_km = models.FloatField(null=True, blank=True)
    duration_mins = models.FloatField(null=True, blank=True)
    cost_estimate = models.JSONField(null=True, blank=True)  # {amount, currency, provenance} — block_schema shape
    elevation_gain_m = models.FloatField(null=True, blank=True)
    traffic_multiplier = models.FloatField(null=True, blank=True)
    scenic_score = models.FloatField(null=True, blank=True)  # 0-1 heuristic, always "estimated" tier
    carbon_kg = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=30)  # google_distance_matrix, haversine_estimate, reference_route
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "knowledge_distanceedge"
        unique_together = ("origin_key", "destination_key", "mode")

    def __str__(self):
        return f"{self.origin_key} -> {self.destination_key} [{self.mode}]"

