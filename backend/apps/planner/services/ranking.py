"""
PreferenceScorer — preference-weighted candidate ranking (docs/planner-
output-generation-architecture.md Phase 2). Replaces the blunt
`sort(user_rating, reverse=True)[:12]` in plan_generation._build_
candidate_pool, which gave a vegetarian traveler and a steakhouse-lover the
identical restaurant shortlist whenever their ratings tied — dietary,
cuisine, interests, and stay-tier preferences never influenced WHICH
candidates the LLM was even offered, only what it was told about them in
the prompt (Phase 1).

score = w_rating * norm(rating) + w_pref * pref_match(row, prefs)

`popularity_score` is deliberately NOT a term here: it is never recomputed
on any reference master table (EntityInteractionLog has zero writers — see
docs/planner-output-generation-architecture.md Phase 0g) so every row's
value is the same constant 0.0. Including a term that can never vary would
be dead weight, not a real signal; add it back only once the interaction-
logging pipeline that would give it real values actually exists.
"""

import hashlib
import math
from typing import Any, Dict, List, Tuple

_RATING_WEIGHT = 0.6
_PREF_WEIGHT = 0.4
_MAX_RATING = 5.0
# No preference signal to evaluate a category against — a neutral score
# keeps the row in original rating order relative to its peers rather than
# artificially penalizing it for a comparison that was never applicable.
_NEUTRAL_PREF_SCORE = 0.5


def score_candidate(row, category: str, prefs: Dict[str, Any], context: Dict[str, Any] | None = None) -> Tuple[float, List[str]]:
    """
    Returns (score, reasons[]) for one candidate row against the trip's
    normalized preferences (services/plan_context.py PlanContext.prefs).
    `reasons` is the seed for the block's `why` field (Phase 2 task 2) —
    every reason here is a real, checkable fact about this row and these
    prefs, never an invented rationale.
    """
    reasons: List[str] = []
    context = context or {}
    rating = float(row.user_rating or 0)
    reviews = max(int(getattr(row, "user_ratings_total", 0) or 0), 1)
    # Bayesian shrinkage: tiny-review 5.0s cannot outrank proven 4.6s purely
    # because their raw average is noisier.
    confidence_rating = ((rating * reviews) + (4.0 * 50)) / (reviews + 50) if rating else 0.0
    rating_norm = min(confidence_rating / _MAX_RATING, 1.0) if confidence_rating else 0.0

    pref_score, pref_reasons = _pref_match(row, category, prefs or {})
    reasons.extend(pref_reasons)

    if rating >= 4.5:
        reasons.append(f"highly rated ({rating}★)")

    budget_fit = _budget_fit(row, category, context, reasons)
    party_fit = _party_fit(row, category, context, reasons)
    location_fit = _location_fit(row, context, reasons)
    score = 0.30 * rating_norm + 0.25 * pref_score + 0.25 * budget_fit + 0.10 * party_fit + 0.10 * location_fit

    # Phase 4 (M2, plan_generation._build_candidate_pool): a candidate
    # retrieved by cosine similarity to this traveler's own taste vector —
    # a genuinely personal signal, distinct from the trip-intent-text RAG
    # retrieval (M5) or a plain rating. Small and additive, never enough
    # alone to override a poor rating/budget/party fit.
    if getattr(row, "_source_taste", False):
        score += 0.08
        reasons.append("matches your personal taste profile")

    # Phase 4 (M2): ± category affinity, learned from repeated edits
    # (preference_learner.learn_from_edits via diff_engine's category_removed
    # signal) — a small, bounded nudge, not a hard exclusion; one thinned
    # day should shade future rankings, never blacklist a whole category.
    category_affinity = context.get("category_affinity") or {}
    affinity_value = category_affinity.get(category)
    if isinstance(affinity_value, (int, float)) and affinity_value:
        nudge = max(min(float(affinity_value) * 0.03, 0.12), -0.12)
        score += nudge
        if nudge <= -0.06:
            reasons.append("you've tended to remove this category in past trips")

    identity = _identity(row, category)
    rejected = {str(v).lower() for v in context.get("rejected", [])}
    recent = {str(v).lower() for v in context.get("recent", [])}
    if identity.lower() in rejected or str(getattr(row, "name", "")).lower() in rejected:
        score -= 0.35
        reasons.append("previously rejected")
    elif identity.lower() in recent:
        # REC-01 R9: was -0.08, weak enough that the 0.30-weighted rating
        # term routinely overrode it — the audit's real evidence (a
        # trip's own scorecard flagging "duplicate or near-duplicate
        # recommendations remain") confirmed this in practice. `recent`
        # is now cross-trip too (plan_context.py), so this penalty also
        # has more to actually catch.
        score -= 0.15
        reasons.append("shown in a previous generation")
    return score, reasons


def _identity(row, category):
    return f"{category}:{getattr(row, 'pk', '')}"


def _budget_fit(row, category, context, reasons):
    if category != "hotel" or not context.get("budget_amount"):
        return 0.5
    nights = max(int(context.get("nights") or 1), 1)
    rooms = max(int(context.get("rooms") or 1), 1)
    per_room_night = float(context["budget_amount"]) / nights / rooms
    currency = str(context.get("budget_currency") or "INR").upper()
    thresholds = [3000, 7000, 15000] if currency == "INR" else [60, 140, 300]
    target = 1 + sum(per_room_night > value for value in thresholds)
    price_rank = {"$": 1, "$$": 2, "$$$": 3, "$$$$": 4}.get(str(getattr(row, "price_range", "") or ""), target)
    fit = max(0.0, 1.0 - abs(price_rank - target) / 3.0)
    if fit >= 0.8:
        reasons.append("fits your per-night room budget")
    return fit


def _party_fit(row, category, context, reasons):
    children = int(context.get("children") or 0)
    party = int(context.get("party_size") or 1)
    capacity = getattr(row, "room_capacity", None)
    if capacity is not None and party > int(capacity):
        return 0.0
    if children and getattr(row, "good_for_children", None) is True:
        reasons.append("suited to families with children")
        return 1.0
    return 0.6


def _location_fit(row, context, reasons):
    centroid = context.get("centroid")
    if not centroid or getattr(row, "latitude", None) is None or getattr(row, "longitude", None) is None:
        return 0.5
    lat, lng = float(row.latitude), float(row.longitude)
    distance = math.hypot(lat - float(centroid[0]), lng - float(centroid[1])) * 111
    if distance <= 5:
        reasons.append("close to the itinerary cluster")
    return max(0.0, 1.0 - distance / 30.0)


def diversity_tiebreak(rows, band=0.0001):
    """Reorder only narrow suitability bands; never cross a material gap."""
    ordered = sorted(rows, key=lambda row: row._pref_score, reverse=True)
    result = []
    while ordered:
        best = ordered.pop(0)
        group = [best]
        while ordered and best._pref_score - ordered[0]._pref_score <= band:
            group.append(ordered.pop(0))
        group.sort(key=lambda row: hashlib.sha256(_identity(row, getattr(row, "_rank_category", "place")).encode()).hexdigest())
        result.extend(group)
    return result


def diversify_ranked_candidates(rows, *, seed: str = "", window: int = 5):
    """Apply bounded diversity/rotation penalties after suitability ranking.

    Only the next small suitability window is considered, so diversity can
    rotate comparable candidates without displacing a materially better one.
    """
    remaining = sorted(rows, key=lambda row: row._pref_score, reverse=True)
    result = []
    seen_signatures = set()
    while remaining:
        candidates = remaining[:window]
        scored = []
        for row in candidates:
            signature = _diversity_signature(row)
            # REC-01 R9: was 0.12/±0.01 — both raised (0.20/±0.03) so
            # diversity/rotation can actually compete with the rating term
            # within the suitability window, instead of being reliably
            # swamped by it (the audit's finding, confirmed by real
            # evidence of duplicate/near-duplicate recommendations).
            penalty = 0.20 if signature in seen_signatures else 0.0
            rotation = int(hashlib.sha256(f"{seed}:{_identity(row, getattr(row, '_rank_category', 'place'))}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
            scored.append((row._pref_score - penalty + rotation * 0.03, row, signature, penalty))
        _score, chosen, signature, penalty = max(scored, key=lambda item: item[0])
        chosen._diversity_penalty = penalty
        chosen._rank_before_diversity = remaining.index(chosen) + len(result) + 1
        remaining.remove(chosen)
        result.append(chosen)
        seen_signatures.add(signature)
    return result


def _diversity_signature(row):
    name = " ".join(str(getattr(row, "name", "")).lower().replace("&", " ").split())
    tokens = tuple(token for token in name.split() if token not in {"the", "hotel", "restaurant", "cafe", "resort"})[:3]
    category = str(getattr(row, "category", "") or getattr(row, "primary_type", "") or "").lower()
    cuisine = str(getattr(row, "cuisine", "") or "").lower()
    price = str(getattr(row, "price_range", "") or "").lower()
    return tokens, category, cuisine, price


def _pref_match(row, category: str, prefs: Dict[str, Any]) -> Tuple[float, List[str]]:
    reasons: List[str] = []
    matched = 0
    total_checks = 0

    interests = [str(i).strip().lower() for i in (prefs.get("interests") or []) if str(i).strip()]
    row_category = (getattr(row, "category", "") or "").lower().strip()
    if interests and row_category:
        total_checks += 1
        if any(interest in row_category or row_category in interest for interest in interests):
            matched += 1
            reasons.append(f"matches your interest in {row_category}")

    if category == "restaurant":
        matched, total_checks, reasons = _restaurant_pref_match(row, prefs, matched, total_checks, reasons)
    elif category == "hotel":
        matched, total_checks, reasons = _hotel_pref_match(row, prefs, matched, total_checks, reasons)

    if total_checks == 0:
        return _NEUTRAL_PREF_SCORE, reasons
    return matched / total_checks, reasons


def _restaurant_pref_match(row, prefs, matched, total_checks, reasons):
    dietary = (prefs.get("dietary") or "").strip().lower()
    if dietary:
        total_checks += 1
        accommodations = getattr(row, "dietary_accommodations", None) or {}
        accommodation_level = accommodations.get(dietary)
        if accommodation_level in ("full_menu", "some_options"):
            matched += 1
            reasons.append(f"accommodates {dietary} diners ({accommodation_level.replace('_', ' ')})")
        elif dietary == "vegetarian" and getattr(row, "serves_vegetarian_food", None):
            matched += 1
            reasons.append("serves vegetarian food")

    cuisine_pref = (prefs.get("cuisine") or "").strip().lower()
    row_cuisine = (getattr(row, "cuisine", "") or "").strip().lower()
    if cuisine_pref and row_cuisine:
        total_checks += 1
        if cuisine_pref in row_cuisine or row_cuisine in cuisine_pref:
            matched += 1
            reasons.append(f"{row.cuisine} cuisine matches your preference")

    return matched, total_checks, reasons


def _hotel_pref_match(row, prefs, matched, total_checks, reasons):
    stay = prefs.get("stay") or {}
    star_pref = stay.get("star_rating")
    row_star = getattr(row, "star_rating", None)
    if star_pref and row_star is not None:
        total_checks += 1
        try:
            if abs(float(row_star) - float(star_pref)) <= 1:
                matched += 1
                reasons.append(f"{row_star}★ matches your preferred tier")
        except (TypeError, ValueError):
            pass

    property_pref = (stay.get("property_type") or "").strip().lower()
    row_type = (getattr(row, "primary_type", "") or "").strip().lower()
    if property_pref and row_type:
        total_checks += 1
        if property_pref in row_type or row_type in property_pref:
            matched += 1
            reasons.append(f"a {row.primary_type} matches your preferred stay type")

    return matched, total_checks, reasons
