"""
KnowledgeEngine — the single DB-first entry point every caller should go
through instead of re-implementing "check the DB, fetch on miss" per call
site (see docs/travel-knowledge-engine-plan.md §5).

This currently wraps apps.reference.services.places_explore.explore_places
rather than replacing it — that function's cache-then-fetch-then-persist
logic is already correct; centralizing it here is what makes "no external
API call outside the resolver" an enforceable rule instead of a convention.
Existing direct callers of explore_places (the four ViewSet.explore()
actions, plan_generation.py's _grow_pool_via_places) are not migrated in
this pass — see the K2 notes in docs/travel-intelligence-implementation-roadmap.md
for why that's a deliberately separate, more carefully sequenced change.
"""

from apps.reference.services.places_explore import _category_config, explore_places


class UnknownCategoryError(ValueError):
    pass


class KnowledgeEngine:
    @staticmethod
    def resolve(category, location, lat=None, lng=None):
        """
        category: "hotel" | "restaurant" | "attraction" | "activity"
        location: raw "City[, Country]" string (matches explore_places today;
                  a City instance overload can be added once callers stop
                  passing free-text locations)
        lat/lng: optional floats for geo-bias + distance-sort

        Returns (source, places, error) — same shape as explore_places, kept
        stable so callers can migrate incrementally without a breaking change.
        """
        config = _category_config().get(category)
        if config is None:
            raise UnknownCategoryError(
                f"KnowledgeEngine has no category config for {category!r}; "
                f"expected one of {sorted(_category_config().keys())}"
            )

        return explore_places(
            model=config["model"],
            location=location,
            lat_val=lat,
            lng_val=lng,
            google_query=config["query_template"].format(location=location),
            included_type=config["included_type"],
            field_mask=config["field_mask"],
            field_mapper=config["field_mapper"],
        )
