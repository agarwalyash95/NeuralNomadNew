"""
Conversation Capabilities — shared envelope (docs/conversation-capability-layer.md).

A capability producer returns a dict shaped like:

    {"cap": <str>, "data": {...}, "freshness": "static"|"slow"|"live"|"derived",
     "degraded": bool, "degraded_reason": str|None}

This rides the additive `capabilities` SSE event/field alongside the turn's
normal reply + input widget. Producers never write planner slots — only
Context Memory (recently_viewed) — and never fabricate: a capability with no
wired live/DB source returns degraded=True with an honest reason rather than
inventing a value (docs/ai-orchestration-architecture.md §9 "Trustworthy").
"""

MAX_CAPABILITIES_PER_TURN = 2


def capability_envelope(cap, data, freshness="slow", degraded=False, degraded_reason=None):
    payload = {"cap": cap, "data": data, "freshness": freshness}
    if degraded:
        payload["degraded"] = True
        payload["degraded_reason"] = degraded_reason or "Live data isn't available for this yet."
    return payload


def cap_city_coords(city_obj):
    """Best-effort (lat, lng) floats for a reference City, or (None, None)."""
    if city_obj is None:
        return None, None
    lat = float(city_obj.latitude) if city_obj.latitude is not None else None
    lng = float(city_obj.longitude) if city_obj.longitude is not None else None
    return lat, lng
