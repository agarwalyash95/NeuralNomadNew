"""
Travel Knowledge Engine — cross-cutting enrichment infrastructure.

Sits alongside `reference` the way `visa`/`forex` already do: it adds the
relationship graph, embeddings, cached AI insights, interaction telemetry,
and TTL'd distance edges that the master tables in `reference` were never
given, without touching those tables' own identity/shape. See
docs/travel-knowledge-engine-plan.md §3b and
docs/travel-intelligence-implementation-roadmap.md §3 for the full design.

Generic-FK `object_id` fields are CharField(max_length=64), not IntegerField
or UUIDField, deliberately — targets can be `reference` app rows (integer pk)
or `knowledge`/`planner` app rows (UUID pk via apps.common.models.BaseModel).
"""

from django.contrib.contenttypes.models import ContentType
from django.db import connection, models
from pgvector.django import HnswIndex, VectorField

from apps.common.models import BaseModel
from apps.reference.models import EnrichmentMixin

# HNSW is a Postgres-specific index method (`USING hnsw ... WITH (...)`) — SQLite
# tolerates the vector(768) column type fine (its loose type-affinity system
# accepts any type name) but has no USING/WITH index syntax at all, so dev/test
# runs against SQLite (config/settings/testing.py) would fail table sync if this
# index were unconditional. Real Postgres deployments still get the real index.
_IS_POSTGRES = connection.vendor == "postgresql"


class Neighbourhood(BaseModel, EnrichmentMixin):
    city = models.ForeignKey("reference.City", on_delete=models.CASCADE, related_name="neighbourhoods")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    vibe_tags = models.JSONField(default=list, blank=True)  # ["nightlife", "family", "budget", "upscale"]
    center_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    center_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    safety_score = models.FloatField(null=True, blank=True)

    # Computed, no LLM (see roadmap §1.5)
    price_tier = models.CharField(max_length=10, blank=True, null=True)          # $ / $$ / $$$ / $$$$
    pace_tag = models.CharField(max_length=20, blank=True, null=True)              # "lively" / "residential" / "mixed"
    walkability_score = models.FloatField(blank=True, null=True)                    # 0-1
    local_rhythm_notes = models.TextField(blank=True)
    tourist_density_by_month = models.JSONField(default=dict, blank=True)            # {"1": 0.3, "2": 0.35, ...}

    class Meta:
        unique_together = ("city", "name")

    def __str__(self):
        return f"{self.name}, {self.city.name}"


class Event(BaseModel):
    city = models.ForeignKey("reference.City", on_delete=models.CASCADE, related_name="events")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=60, blank=True)  # festival, concert, sports, market
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    venue_place_id = models.CharField(max_length=255, blank=True)
    venue_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    venue_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    # "manual" / "llm_researched" / a real feed name — never silently invented.
    # If LLM-researched and not confident, the ingestion prompt is instructed
    # to omit the event entirely rather than write a low-confidence guess.
    source = models.CharField(max_length=60, default="manual")
    cost_provenance = models.JSONField(default=dict, blank=True)  # block_schema.make_provenance() shape

    class Meta:
        indexes = [models.Index(fields=["city", "start_date"])]

    def __str__(self):
        return f"{self.name} ({self.start_date})"


class LocalTip(BaseModel):
    # No GenericForeignKey — object_id must support both int (reference app)
    # and UUID (knowledge/planner app) primary keys, which GenericForeignKey
    # doesn't handle uniformly; resolve target rows by (content_type, object_id) directly.
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
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
    # restaurant tip is (see roadmap §1.8). Etiquette tips may auto-publish.
    needs_human_review = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"[{self.category}] {self.tip_text[:60]}"


class EmergencyContact(BaseModel):
    country = models.ForeignKey("reference.Country", on_delete=models.CASCADE, related_name="emergency_contacts")
    city = models.ForeignKey("reference.City", on_delete=models.SET_NULL, null=True, blank=True, related_name="emergency_contacts")
    service_type = models.CharField(max_length=40)  # police, ambulance, fire, tourist_helpline, embassy
    number = models.CharField(max_length=30)
    notes = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.service_type}: {self.number} ({self.country.code})"


class SafetyAdvisory(BaseModel):
    country = models.ForeignKey("reference.Country", on_delete=models.CASCADE, related_name="safety_advisories")
    city = models.ForeignKey("reference.City", on_delete=models.SET_NULL, null=True, blank=True, related_name="safety_advisories")
    level = models.CharField(max_length=20, choices=[
        ("normal", "normal"), ("caution", "caution"), ("high_risk", "high_risk"),
    ])
    summary = models.TextField()
    # Must be a real, named source — invalidation here is primarily operational
    # (a human updates this in response to real events), not clock-driven.
    source = models.CharField(max_length=120)

    def __str__(self):
        return f"{self.country.code} — {self.level}"


class PlaceRelationship(BaseModel):
    """The 'relationship graph' — one edge table instead of N join tables per relation type."""
    from_content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    from_object_id = models.CharField(max_length=64)
    to_content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    to_object_id = models.CharField(max_length=64)
    relation_type = models.CharField(max_length=30, choices=[
        ("near", "near"), ("pairs_well_with", "pairs_well_with"),
        ("alternative_to", "alternative_to"), ("on_route_between", "on_route_between"),
    ])
    strength_score = models.FloatField(default=0.0)  # 0-1
    distance_km = models.FloatField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # e.g. {"shared_theme": "sunset viewpoint"}

    class Meta:
        indexes = [models.Index(fields=["from_content_type", "from_object_id"])]
        unique_together = ("from_content_type", "from_object_id", "to_content_type", "to_object_id", "relation_type")

    def __str__(self):
        return f"{self.from_object_id} --{self.relation_type}--> {self.to_object_id}"


class EntityEmbedding(BaseModel):
    """Generic — decoupled from the master tables so the embedding model can version independently."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    embedding = VectorField(dimensions=768)
    embedding_version = models.CharField(max_length=40)  # e.g. "gemini-text-embedding-004"
    source_text_hash = models.CharField(max_length=64)  # detects when the underlying text changed

    class Meta:
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
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    insight_type = models.CharField(max_length=40)  # e.g. noise_profile, signature_dish, real_duration — see roadmap §3
    context_hash = models.CharField(max_length=64, db_index=True)  # hash of (item + trip context) that produced this text
    text = models.TextField(blank=True)
    structured = models.JSONField(default=dict, blank=True)  # for insight types that are richer than one string
    provenance = models.JSONField(default=dict, blank=True)  # block_schema.make_provenance() shape
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ("content_type", "object_id", "insight_type", "context_hash")

    def __str__(self):
        return f"{self.insight_type}({self.object_id})"


class EntityInteractionLog(BaseModel):
    """Substrate for popularity scoring — nothing tracked this before."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    event_type = models.CharField(max_length=30)  # viewed, hovered, added_to_plan, booked, removed
    workspace_id = models.UUIDField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id", "created_at"]),
            models.Index(fields=["content_type", "object_id", "event_type"]),
        ]


class CrowdPattern(BaseModel):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.CharField(max_length=64)
    hour_of_day = models.PositiveSmallIntegerField()  # 0-23
    day_type = models.CharField(max_length=10, choices=[
        ("weekday", "weekday"), ("weekend", "weekend"), ("holiday", "holiday"),
    ])
    crowd_level = models.FloatField()  # 0-1
    sample_size = models.PositiveIntegerField(default=0)  # EntityInteractionLog rows behind this cell
    source = models.CharField(max_length=20, choices=[
        ("telemetry", "telemetry"), ("estimated_prior", "estimated_prior"),
    ])

    class Meta:
        unique_together = ("content_type", "object_id", "hour_of_day", "day_type")


class TransitOutcomeLog(BaseModel):
    """Only populated where a real tracking/status source exists — see roadmap §1.4."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")  # route model
    object_id = models.CharField(max_length=64)
    scheduled_at = models.DateTimeField()
    actual_at = models.DateTimeField(null=True, blank=True)
    delta_minutes = models.IntegerField(null=True, blank=True)
    source = models.CharField(max_length=40)  # which tracking/provider surfaced this

    class Meta:
        indexes = [models.Index(fields=["content_type", "object_id", "scheduled_at"])]


class DistanceEdge(BaseModel):
    """Supersedes planner.LocationDistanceCache conceptually — same keys, extended with TTL + modes."""
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
    expires_at = models.DateTimeField(db_index=True)  # the field LocationDistanceCache was missing

    class Meta:
        unique_together = ("origin_key", "destination_key", "mode")

    def __str__(self):
        return f"{self.origin_key} -> {self.destination_key} [{self.mode}]"


class PlanInsightDismissal(BaseModel):
    """
    Persists 'Not now' on a proactive AI recommendation. Without this, a
    dismissed insight would simply reappear on the next render — the vision
    mockup didn't address this, but a real implementation has to (see
    docs/travel-intelligence-implementation-roadmap.md §2.6). Dismissal is
    scoped to context_hash, not "forever": once the underlying plan content
    changes enough to produce a new context_hash, the insight can resurface.
    """
    workspace = models.ForeignKey("planner.PlannerWorkspace", on_delete=models.CASCADE, related_name="insight_dismissals")
    context_hash = models.CharField(max_length=64)

    class Meta:
        unique_together = ("workspace", "context_hash")
