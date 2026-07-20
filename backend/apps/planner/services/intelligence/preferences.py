"""
AI reasoning memory — the trip remembers WHY, not just WHAT.

"I don't mind spending more if the view is amazing" should not collapse to
budget=premium; it becomes values=["scenery"] with a cited reason, stored in
TripDraftState.metadata["ai_preferences"]:

    {"values": [...], "avoid": [...],
     "reasons": [{"field": "budget", "reason": "values scenery over price"}],
     "confidence": 0.0-1.0}

Consumed by recommendation ranking (bias), the LLM prompt (PREFERENCES
block), and the plan pipeline. Durable, explicitly-stated facts are promoted
to the existing TravelerProfile (stated provenance — never silently
inferred there).
"""

from typing import Any, Dict, List, Optional

_MAX_VALUES = 8
_MAX_REASONS = 10

# Keyword groups for turning free-text value tags into ranking bias flags.
_BIAS_KEYWORDS = {
    "wants_scenery": {"scenery", "view", "views", "nature", "sea view", "lake view", "mountains"},
    "avoids_crowds": {"crowds", "crowded", "quiet", "peaceful", "offbeat"},
    "foodie": {"food", "cuisine", "eating", "street food", "dining"},
    "comfort_first": {"comfort", "luxury", "convenience", "relaxation"},
    "budget_conscious": {"savings", "cheap", "value", "budget"},
    "walkability": {"walking", "walkable"},
    "nightlife": {"nightlife", "parties", "bars"},
}


def get_ai_preferences(draft) -> Dict[str, Any]:
    meta = draft.metadata or {}
    prefs = meta.get("ai_preferences")
    if not isinstance(prefs, dict):
        # NEVER `dict(_EMPTY)` — a shallow copy shares _EMPTY's nested list
        # objects across every caller. merge_preference_signals appends to
        # `current["values"/"avoid"/"reasons"]` in place, which used to
        # mutate the MODULE-LEVEL _EMPTY singleton itself — the very first
        # preference merged for ANY trip in the process's lifetime silently
        # leaked into every other trip that had no ai_preferences set yet.
        # Fresh lists on every call, always.
        return {"values": [], "avoid": [], "reasons": [], "confidence": 0.0}
    return {
        "values": list(prefs.get("values") or []),
        "avoid": list(prefs.get("avoid") or []),
        "reasons": list(prefs.get("reasons") or []),
        "confidence": float(prefs.get("confidence") or 0.0),
    }


def merge_preference_signals(draft, signals) -> bool:
    """
    Merge one turn's extracted preference_signals into the cumulative memory.
    Accepts a pydantic model or a dict; returns True when anything changed.
    Additive only — an inferred signal never removes an earlier one.
    """
    if signals is None:
        return False
    if hasattr(signals, "model_dump"):
        signals = signals.model_dump(exclude_none=True)
    if not isinstance(signals, dict):
        return False

    new_values = [str(v).strip().lower() for v in (signals.get("values") or []) if str(v).strip()]
    new_avoid = [str(v).strip().lower() for v in (signals.get("avoid") or []) if str(v).strip()]
    new_reasons = []
    for r in signals.get("reasons") or []:
        if hasattr(r, "model_dump"):
            r = r.model_dump()
        if isinstance(r, dict) and r.get("reason"):
            new_reasons.append({"field": str(r.get("field") or "general"), "reason": str(r["reason"])[:200]})

    if not (new_values or new_avoid or new_reasons):
        return False

    current = get_ai_preferences(draft)
    values = current["values"]
    avoid = current["avoid"]
    reasons = current["reasons"]

    for v in new_values:
        if v not in values:
            values.append(v)
    for v in new_avoid:
        if v not in avoid:
            avoid.append(v)
    existing_reason_texts = {r.get("reason") for r in reasons}
    for r in new_reasons:
        if r["reason"] not in existing_reason_texts:
            reasons.append(r)

    observations = len(values) + len(avoid) + len(reasons)
    confidence = round(min(0.95, 0.5 + 0.06 * observations), 2)

    if not draft.metadata:
        draft.metadata = {}
    draft.metadata["ai_preferences"] = {
        "values": values[:_MAX_VALUES],
        "avoid": avoid[:_MAX_VALUES],
        "reasons": reasons[-_MAX_REASONS:],
        "confidence": confidence,
    }
    return True


def preference_bias(draft) -> Dict[str, bool]:
    """Ranking-bias flags derived from the stored value/avoid tags."""
    prefs = get_ai_preferences(draft)
    tags = set(prefs["values"])
    avoid_tags = set(prefs["avoid"])
    bias: Dict[str, bool] = {}
    for flag, keywords in _BIAS_KEYWORDS.items():
        if tags & keywords:
            bias[flag] = True
    if avoid_tags & _BIAS_KEYWORDS["avoids_crowds"] or "crowds" in avoid_tags:
        bias["avoids_crowds"] = True
    if avoid_tags & _BIAS_KEYWORDS["nightlife"]:
        bias["avoids_nightlife"] = True
    return bias


def preferences_prompt_block(draft) -> str:
    """Compact PREFERENCES block for the system prompt ('' when empty)."""
    prefs = get_ai_preferences(draft)
    if not (prefs["values"] or prefs["avoid"] or prefs["reasons"]):
        return ""
    lines = ["--- TRAVELER PREFERENCES (reason with these; never re-ask) ---"]
    if prefs["values"]:
        lines.append(f"  Values: {', '.join(prefs['values'])}")
    if prefs["avoid"]:
        lines.append(f"  Avoids: {', '.join(prefs['avoid'])}")
    for r in prefs["reasons"][-4:]:
        lines.append(f"  Why ({r.get('field', 'general')}): {r.get('reason')}")
    return "\n".join(lines)


def promote_to_traveler_profile(draft, user) -> None:
    """
    Push explicitly-reasoned preferences into the durable cross-trip
    TravelerProfile. Best-effort; anonymous users are skipped.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return
    prefs = get_ai_preferences(draft)
    if not prefs["reasons"]:
        return
    try:
        from apps.planner.models import TravelerProfile
        profile, _ = TravelerProfile.objects.get_or_create(user=user)
        workspace_id = getattr(getattr(draft, "workspace", None), "id", None)
        for r in prefs["reasons"][-3:]:
            key = f"preference:{r.get('field', 'general')}"
            profile.upsert_fact(key, r.get("reason"), provenance="stated", source_trip=workspace_id)
    except Exception as exc:
        print(f"[Intelligence] traveler-profile promotion failed (non-fatal): {exc}")


# Phase 1 (docs/planner-output-generation-architecture.md): the canonical
# vocabulary bridge. _record_traveler_facts (conversation_service.py) writes
# {home_origin, typical_party_size, budget_tier, recent_trip_budget,
# interests}; tasks._infer_traveler_facts writes {pace_preference,
# budget_sensitivity, start_time_preference, meal_timing,
# top_activity_categories, hotel_quality_tier}; ConstraintEngine reads
# {accessibility_wheelchair, accessibility_stroller, avoid_red_eye}. Nothing
# in the normal conversation flow ever wrote the ConstraintEngine keys, so a
# wheelchair need typed into chat (draft.metadata["accessibility"]) was
# captured and then silently discarded end-to-end. This maps the raw,
# structured draft.metadata fields into those exact reader-expected keys.
_ACCESSIBILITY_TAG_TO_FACT_KEY = {
    "wheelchair": "accessibility_wheelchair",
    "stroller": "accessibility_stroller",
}

# trip_pace's free-text vocabulary (widget + LLM extraction) normalized to
# the three buckets _traveler_context_summary actually branches on.
_PACE_CANONICAL = {
    "packed": "packed",
    "fast": "packed",
    "slow": "slow",
    "relaxed": "slow",
    "moderate": "moderate",
    "balanced": "moderate",
}


def promote_draft_preferences_to_profile(draft, user) -> None:
    """
    Promote STRUCTURED draft.metadata preferences (accessibility, pace,
    hotel tier) into TravelerProfile using the CANONICAL fact keys
    ConstraintEngine / _traveler_context_summary actually read — not the
    disjoint keys _record_traveler_facts writes. Call this BEFORE
    ConstraintEngine is built in the same generation run: a wheelchair need
    typed in THIS chat then filters candidates in THIS same trip, not only
    a future one. Best-effort; anonymous(-in-Django's-sense) users are
    skipped, same discipline as promote_to_traveler_profile. Never
    downgrades a stated fact (TravelerProfile.upsert_fact's own rule).
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return
    meta = draft.metadata or {}
    if not meta:
        return
    try:
        from apps.planner.models import TravelerProfile

        profile, _ = TravelerProfile.objects.get_or_create(user=user)
        workspace_id = getattr(getattr(draft, "workspace", None), "id", None)

        for tag in meta.get("accessibility") or []:
            key = _ACCESSIBILITY_TAG_TO_FACT_KEY.get(str(tag).strip().lower())
            if key:
                profile.upsert_fact(key, True, provenance="stated", source_trip=workspace_id)

        pace_raw = meta.get("trip_pace")
        if pace_raw:
            canonical_pace = _PACE_CANONICAL.get(str(pace_raw).strip().lower())
            if canonical_pace:
                profile.upsert_fact("pace_preference", canonical_pace, provenance="stated", source_trip=workspace_id)

        star_rating = meta.get("star_rating")
        if isinstance(star_rating, (int, float)):
            if star_rating >= 5:
                profile.upsert_fact("hotel_quality_tier", "luxury", provenance="stated", source_trip=workspace_id)
            elif star_rating <= 3:
                profile.upsert_fact("hotel_quality_tier", "budget", provenance="stated", source_trip=workspace_id)
    except Exception as exc:
        print(f"[Intelligence] draft-preference promotion failed (non-fatal): {exc}")
