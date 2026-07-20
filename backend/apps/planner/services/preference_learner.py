"""
PreferenceLearner — turns DiffEngine EditSignals into durable, INFERRED
TravelerProfile facts using the canonical vocabulary (docs/planner-output-
generation-architecture.md Phase 6 / B15) — the same keys
_traveler_context_summary reads (pace_preference, hotel_quality_tier,
start_time_preference), so a learned fact from one trip actually shapes
the next one, closing the loop the architecture doc calls the flywheel
that makes "see it once, don't change it" improve over time.

"Inferred" provenance means these never override a "stated"/"confirmed"
fact — TravelerProfile.upsert_fact's own rule, unchanged here. A single
edit nudges the signal; it never overwrites something the user explicitly
said in chat.
"""

from collections import Counter
from typing import List, Optional

from apps.planner.services.diff_engine import EditSignal


def learn_from_edits(user, workspace_id, signals: List[EditSignal]) -> List[str]:
    """
    Writes inferred TravelerProfile facts from a batch of edit signals.
    Returns the fact keys actually written (for observability/testing).
    Best-effort: never raises into the request path that calls it.
    """
    if user is None or not getattr(user, "is_authenticated", False) or not signals:
        return []
    try:
        from apps.planner.models import TravelerProfile

        profile, _ = TravelerProfile.objects.get_or_create(user=user)
    except Exception:
        return []

    written: List[str] = []
    kinds = Counter(s.kind for s in signals)

    hotel_shifts = [s for s in signals if s.kind == "hotel_tier_shift"]
    if hotel_shifts:
        tier = _majority_direction_to_tier(hotel_shifts)
        if tier:
            profile.upsert_fact("hotel_quality_tier", tier, provenance="inferred", source_trip=workspace_id)
            written.append("hotel_quality_tier")

    if kinds.get("day_thinned", 0) >= 1:
        profile.upsert_fact("pace_preference", "slow", provenance="inferred", source_trip=workspace_id)
        written.append("pace_preference")

    time_shifts = [s for s in signals if s.kind == "start_time_shift"]
    if time_shifts:
        pref = _majority_direction_to_start_pref(time_shifts)
        if pref:
            profile.upsert_fact("start_time_preference", pref, provenance="inferred", source_trip=workspace_id)
            written.append("start_time_preference")

    # Phase 4 (M2): ± category affinity — a durable, cross-trip nudge away
    # from categories the traveler keeps editing out, read by
    # ranking.score_candidate via plan_context.profile_facts. A running
    # count, not a single-trip flag, so one thinned day doesn't permanently
    # blacklist a category; each occurrence only nudges it further.
    category_removals = [s for s in signals if s.kind == "category_removed"]
    if category_removals:
        affinity = _read_category_affinity(profile)
        for signal in category_removals:
            category = signal.detail.get("category")
            if category:
                affinity[category] = affinity.get(category, 0) - 1
        profile.upsert_fact("category_affinity", affinity, provenance="inferred", source_trip=workspace_id)
        written.append("category_affinity")

    return written


def _read_category_affinity(profile):
    for fact in (profile.facts or []):
        if fact.get("key") == "category_affinity":
            value = fact.get("value")
            if isinstance(value, dict):
                return dict(value)
    return {}


def _majority_direction_to_tier(hotel_shifts) -> Optional[str]:
    up = sum(1 for s in hotel_shifts if s.detail.get("direction") == "up")
    down = len(hotel_shifts) - up
    if up > down:
        return "luxury"
    if down > up:
        return "budget"
    return None


def _majority_direction_to_start_pref(time_shifts) -> Optional[str]:
    later = sum(1 for s in time_shifts if s.detail.get("direction") == "later")
    earlier = len(time_shifts) - later
    if later > earlier:
        return "late_starter"
    if earlier > later:
        return "early_riser"
    return None
