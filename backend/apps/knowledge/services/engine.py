"""Phase 7 compatibility shim — KnowledgeEngine.resolve() folded into
apps.reference.services.places_explore.resolve_places() (that class was
already just a thin wrapper over explore_places/_category_config, both
reference-owned). Every real caller in this codebase has been migrated to
call resolve_places() directly; this class exists only so anything still
importing `apps.knowledge.services.engine.KnowledgeEngine` keeps working
unchanged.
"""

from apps.reference.services.places_explore import UnknownCategoryError, resolve_places  # noqa: F401


class KnowledgeEngine:
    @staticmethod
    def resolve(category, location, lat=None, lng=None, radius_km=15.0):
        return resolve_places(category, location, lat=lat, lng=lng, radius_km=radius_km)
