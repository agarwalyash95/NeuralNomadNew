"""
PlanScorer -> PlanScorecard (docs/planner-output-generation-architecture.md
Phase 4 / B10). Every generated plan is scored 0-100 across five
dimensions once generation completes — the first objective, persisted
measure of "is this itinerary actually good," not just "did it not crash."

Every dimension is computed from data ALREADY produced by earlier phases —
nothing here re-derives judgment the LLM already made, and nothing is
invented or guessed:
  personalization  fraction of PlanContext.must_honor prefs (Phase 1) that
                    are actually evidenced in the chosen blocks
  grounding        fraction of non-transport blocks with a real master_ref
                    (the Core's hallucination-rejection guarantee, made
                    measurable instead of just "trust the code path")
  feasibility      1 − (pre-repair validation errors / blocks) — measures
                    how much work Phase 3's repair pass had to do; a fully
                    clean LLM composition scores 100 here even though the
                    FINAL plan is always feasible post-repair
  coverage         every day has ≥1 activity scheduled
  richness         fraction of non-transport blocks carrying real cached
                    enrichment (Phase 1's PlaceInsight join)
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

_WEIGHTS = {
    "constraint_compliance": 0.18,
    "schedule_feasibility": 0.14,
    "transport_quality": 0.14,
    "preference_match": 0.14,
    "budget_or_cost_transparency": 0.10,
    "diversity": 0.10,
    "freshness": 0.07,
    "provenance": 0.08,
    "unresolved_gaps": 0.05,
}

LOW_SCORE_THRESHOLD = 85


@dataclass
class PlanScorecard:
    overall: float
    dimensions: Dict[str, float] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)

    @property
    def flagged_for_review(self) -> bool:
        return self.overall < LOW_SCORE_THRESHOLD

    @property
    def quality_state(self) -> str:
        return "strong" if self.overall >= LOW_SCORE_THRESHOLD else "review_recommended"

    def to_dict(self, *, internal=True) -> Dict[str, Any]:
        payload = {
            "quality_state": self.quality_state,
            "reasons": self.reasons,
            "flagged_for_review": self.flagged_for_review,
        }
        if internal:
            payload.update({
            "overall": round(self.overall, 1),
            "dimensions": {k: round(v, 1) for k, v in self.dimensions.items()},
            })
        return payload


def score_plan(days: List[Dict[str, Any]], plan_context=None, pre_repair_report=None, gaps=None) -> PlanScorecard:
    reasons: List[str] = []
    dims = {
        "constraint_compliance": _score_personalization(days, plan_context, reasons),
        "schedule_feasibility": min(_score_feasibility(days, pre_repair_report, reasons), _score_coverage(days, reasons)),
        "transport_quality": _score_transport(days, reasons),
        "preference_match": _score_preference_match(days, reasons),
        "budget_or_cost_transparency": _score_cost_transparency(days, plan_context, reasons),
        "diversity": _score_diversity(days, reasons),
        "freshness": _score_evidence(days, "freshness", reasons),
        "provenance": min(_score_grounding(days, reasons), _score_evidence(days, "provenance", reasons)),
        "unresolved_gaps": _score_gaps(gaps, reasons),
    }
    overall = sum(dims[k] * weight for k, weight in _WEIGHTS.items())
    # VAL-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
    # R8): the new warning-severity validation checks (hours_conflict,
    # tight_travel_time, hotel_nights_mismatch) need to be visible
    # somewhere, or computing them is pointless — repair_plan's own gaps
    # list only ever surfaces error-severity violations (deliberately,
    # since gaps also drives GenerationNeedsInput elsewhere in the
    # pipeline). Reasons-only, additive: this NEVER touches `dims` or
    # `overall` above, so it cannot change a plan's score, quality_state,
    # or flagged_for_review outcome — only what the scorecard SAYS about a
    # plan that already scored however it scored.
    _add_warning_reasons(pre_repair_report, reasons)
    return PlanScorecard(overall=overall, dimensions=dims, reasons=reasons)


def _add_warning_reasons(pre_repair_report, reasons: List[str]) -> None:
    if pre_repair_report is None:
        return
    warnings = [v for v in pre_repair_report.violations if v.severity == "warning"]
    if not warnings:
        return
    by_code: Dict[str, int] = {}
    for violation in warnings:
        by_code[violation.code] = by_code.get(violation.code, 0) + 1
    labels = {
        "hours_conflict": "may be scheduled outside opening hours",
        "tight_travel_time": "may have too little travel time to the next stop",
        "hotel_nights_mismatch": "hotel stay length doesn't match the city's day count",
        "unparseable_time": "has an unreadable scheduled time",
        "price_sanity": "is priced well outside the expected range for its distance",
        "geo_sanity": "is located implausibly far from the day's city",
    }
    for code, count in by_code.items():
        label = labels.get(code, code.replace("_", " "))
        noun = "block" if count == 1 else "blocks"
        reasons.append(f"{count} {noun} {label}")


def _all_blocks(days):
    return [b for day in days for b in (day.get("activities") or [])]


def _non_transport_blocks(days):
    return [b for b in _all_blocks(days) if not (b.get("metadata") or {}).get("transport")]


def _score_personalization(days, plan_context, reasons: List[str]) -> float:
    must_honor = list(getattr(plan_context, "must_honor", None) or [])
    if not must_honor:
        return 100.0  # nothing stated to honor — neutral full score, not a penalty
    prefs = plan_context.prefs if plan_context else {}
    non_transport = _non_transport_blocks(days)
    satisfied = 0
    for pref_key in must_honor:
        if pref_key == "dietary":
            dietary = (prefs.get("dietary") or "").strip().lower()
            meal_blocks = [b for b in non_transport if b.get("category") == "food"]
            if dietary and any(
                dietary in (b.get("why") or "").lower() or dietary in (b.get("notes") or "").lower()
                for b in meal_blocks
            ):
                satisfied += 1
            else:
                reasons.append(f"dietary preference '{dietary}' not evidenced in any meal block")
        elif pref_key == "accessibility":
            # Accessibility is enforced upstream — ConstraintEngine filters
            # the candidate pool before compose ever runs (Phase 0f/1), so
            # any block that made it through already satisfies it. A trip
            # with zero blocks would mean generation itself failed
            # (caught elsewhere), not an accessibility miss.
            if non_transport:
                satisfied += 1
            else:
                reasons.append("accessibility requirement could not be verified — no blocks generated")
        elif pref_key == "transport":
            preferred = str((prefs.get("transport") or {}).get("preferred_mode") or "").lower()
            modes = {
                str(((block.get("metadata") or {}).get("transport") or {}).get("mode") or "").lower()
                for block in _transport_blocks(days)
            }
            if preferred in modes:
                satisfied += 1
            else:
                reasons.append(f"preferred transport mode '{preferred}' is not represented in the resolved journey")
    return 100.0 * satisfied / len(must_honor)


def _score_grounding(days, reasons: List[str]) -> float:
    non_transport = _non_transport_blocks(days)
    if not non_transport:
        return 100.0
    grounded = sum(
        1 for b in non_transport
        if ((b.get("metadata") or {}).get("master_ref") or {}).get("id") is not None
    )
    score = 100.0 * grounded / len(non_transport)
    if grounded < len(non_transport):
        reasons.append(f"{len(non_transport) - grounded} block(s) missing real grounding")
    return score


def _score_feasibility(days, pre_repair_report, reasons: List[str]) -> float:
    if pre_repair_report is None:
        return 100.0
    blocks = _all_blocks(days)
    if not blocks:
        return 100.0
    errors = [v for v in pre_repair_report.violations if v.severity == "error"]
    score = max(0.0, 100.0 * (1 - len(errors) / len(blocks)))
    if errors:
        reasons.append(f"{len(errors)} feasibility issue(s) needed repair before this plan was ready")
    return score


def _score_coverage(days, reasons: List[str]) -> float:
    if not days:
        return 0.0
    covered = 0
    for day in days:
        if day.get("activities"):
            covered += 1
        else:
            reasons.append(f"Day {day.get('day_number')} has no activities scheduled")
    return 100.0 * covered / len(days)


def _score_richness(days, reasons: List[str]) -> float:
    non_transport = _non_transport_blocks(days)
    if not non_transport:
        return 100.0
    enriched = sum(1 for b in non_transport if (b.get("metadata") or {}).get("insights"))
    score = 100.0 * enriched / len(non_transport)
    if score < 50:
        reasons.append("most blocks have no cached enrichment yet (real duration, signature dish, etc.)")
    return score


def _transport_blocks(days):
    return [b for b in _all_blocks(days) if (b.get("metadata") or {}).get("transport")]


def _score_transport(days, reasons):
    blocks = _transport_blocks(days)
    if not blocks:
        return 80.0
    values = []
    for block in blocks:
        transport = (block.get("metadata") or {}).get("transport") or {}
        suitability = transport.get("planning_suitability") or {}
        values.append(float(suitability.get("score") or 55))
        if transport.get("booking_availability") == "unverified":
            reasons.append(f"{block.get('title')} requires booking verification")
    return sum(values) / len(values)


def _score_preference_match(days, reasons):
    blocks = _non_transport_blocks(days)
    if not blocks:
        return 80.0
    matched = sum(1 for block in blocks if block.get("why"))
    if matched < len(blocks):
        reasons.append("some recommendations have weak preference rationale")
    return 100.0 * matched / len(blocks)


def _score_cost_transparency(days, plan_context, reasons):
    blocks = _all_blocks(days)
    if not blocks:
        return 0.0
    known = sum(1 for block in blocks if block.get("estimated_cost") is not None)
    score = 100.0 * known / len(blocks)
    if getattr(plan_context, "budget_amount", None) is not None and score < 70:
        reasons.append("supplied budget needs more verified prices before fit can be confirmed")
    elif score < 50:
        reasons.append("cost range confidence is limited because several prices are unverified")
    return score


def _score_diversity(days, reasons):
    blocks = _non_transport_blocks(days)
    if not blocks:
        return 100.0
    categories = [str(block.get("category") or "") for block in blocks]
    names = [str(block.get("title") or "").strip().lower() for block in blocks]
    duplicate_penalty = len(names) - len(set(names))
    category_score = min(len(set(categories)) / 4, 1.0)
    score = max(0.0, 100 * category_score - duplicate_penalty * 20)
    if duplicate_penalty:
        reasons.append("duplicate or near-duplicate recommendations remain")
    return score


def _score_evidence(days, field, reasons):
    material = _all_blocks(days)
    if not material:
        return 100.0
    values = []
    for block in material:
        metadata = block.get("metadata") or {}
        transport = metadata.get("transport") or {}
        if field == "freshness":
            value = transport.get("freshness") or metadata.get("freshness") or "unknown"
            values.append({"live": 100, "fresh": 90, "stale": 35, "unknown": 55}.get(value, 55))
        else:
            value = transport.get("provenance") or metadata.get("provenance")
            if (metadata.get("master_ref") or {}).get("id") is not None:
                value = value or "verified_database"
            values.append({"live_provider": 100, "cached_provider": 85, "verified_database": 90, "estimated": 55, "ai_recommended": 40, "fallback": 30}.get(value, 45))
    return sum(values) / len(values)


def _score_gaps(gaps, reasons):
    count = len(gaps or [])
    if count:
        reasons.append(f"{count} actionable gap(s) remain")
    return max(0.0, 100.0 - count * 15)
