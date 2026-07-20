"""
PlanValidator — deterministic feasibility validation (docs/planner-output-
generation-architecture.md Phase 3 / B8). Runs after compose, before the
plan is considered done. An LLM-composed plan is grounded (every block
traces to a real row or a real transport leg — the Core's existing
guarantee) but was never checked for INTERNAL feasibility: overlapping
blocks, a block that ends before it starts, a red-eye flight the shift-fix
(Phase 0f) somehow still let through, or a day with nothing scheduled.

Every Violation names a real, checkable defect in the composed plan —
never a style preference. severity="error" is something refinement should
try to repair; severity="warning" is recorded for visibility but never
blocks or gets repaired.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class Violation:
    severity: str  # "error" | "warning"
    code: str
    day_number: Optional[int]
    block_id: Optional[str]
    message: str
    autofixable: bool = False


@dataclass
class ValidationReport:
    violations: List[Violation] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return any(v.severity == "error" for v in self.violations)

    def add(self, violation: Violation) -> None:
        self.violations.append(violation)


def _parse_time(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M")
    except (ValueError, TypeError):
        return None


def validate_plan(days: List[Dict[str, Any]], constraint_engine=None) -> ValidationReport:
    report = ValidationReport()
    for day in days:
        _validate_day_temporal(day, report)
        _validate_day_coverage(day, report)
        _validate_day_hours(day, report)
        _validate_day_travel_time(day, report)
        _validate_day_price_sanity(day, report)
        _validate_day_geo_sanity(day, report)
        if constraint_engine is not None:
            _validate_day_constraints(day, constraint_engine, report)
    # Cross-day (VAL-01 R8): hotel-nights vs. actual stay needs the whole
    # trip, not one day at a time.
    _validate_hotel_nights(days, report)
    # Deliberately NOT re-implemented here (docs/planner-complete-current-
    # audit-and-repair-plan.md §19 R8): duplicate/near-duplicate venues are
    # already detected in services/scoring.py::_score_diversity (the exact
    # mechanism behind the real "duplicate or near-duplicate recommendations
    # remain" scorecard reason observed in Phase B evidence); the numeric
    # budget cap is already a hard check in plan_generation.run_pipeline
    # (raises GenerationNeedsInput) plus a soft signal in
    # scoring.py::_score_cost_transparency. Duplicating either here would be
    # a second, driftable copy of an already-working check.
    return report


def _validate_day_temporal(day: Dict[str, Any], report: ValidationReport) -> None:
    day_number = day.get("day_number")
    activities = day.get("activities") or []
    parsed = []
    for block in activities:
        start = _parse_time(block.get("start_time"))
        end = _parse_time(block.get("end_time"))
        if start is None or end is None:
            report.add(Violation(
                "warning", "unparseable_time", day_number, block.get("id"),
                f"Block '{block.get('title')}' has an unparseable start/end time.",
            ))
            continue
        if end <= start:
            report.add(Violation(
                "error", "backwards_time", day_number, block.get("id"),
                f"Block '{block.get('title')}' ends ({block.get('end_time')}) at or before it "
                f"starts ({block.get('start_time')}).",
                autofixable=True,
            ))
        parsed.append((start, end, block))

    parsed.sort(key=lambda p: p[0])
    for (start_a, end_a, block_a), (start_b, _end_b, block_b) in zip(parsed, parsed[1:]):
        if start_b < end_a:
            report.add(Violation(
                "error", "overlap", day_number, block_b.get("id"),
                f"'{block_b.get('title')}' ({block_b.get('start_time')}) overlaps the preceding "
                f"'{block_a.get('title')}' (ends {block_a.get('end_time')}).",
                autofixable=True,
            ))


def _validate_day_coverage(day: Dict[str, Any], report: ValidationReport) -> None:
    day_number = day.get("day_number")
    activities = day.get("activities") or []
    if not activities:
        report.add(Violation(
            "warning", "empty_day", day_number, None,
            f"Day {day_number} has no activities scheduled.",
        ))


def _validate_day_constraints(day: Dict[str, Any], constraint_engine, report: ValidationReport) -> None:
    day_number = day.get("day_number")
    for block in day.get("activities") or []:
        transport = (block.get("metadata") or {}).get("transport")
        if transport and not constraint_engine.is_valid_transport(transport.get("mode"), block.get("start_time")):
            report.add(Violation(
                "error", "red_eye_violation", day_number, block.get("id"),
                f"Transport block '{block.get('title')}' at {block.get('start_time')} violates avoid_red_eye.",
                autofixable=True,
            ))


def _validate_day_hours(day: Dict[str, Any], report: ValidationReport) -> None:
    """VAL-01 R8: surfaces the opening-hours conflict _candidate_block
    already computes and stamps onto block['_aiInsights']['hours_conflict']
    (plan_generation.py) but that validate_plan never looked at. Reused,
    not recomputed — this file has no opening-hours parsing of its own.
    Warning-only: an LLM-scheduled visit at a possibly-closed time is worth
    flagging, not grounds to refuse the whole plan."""
    day_number = day.get("day_number")
    for block in day.get("activities") or []:
        if (block.get("_aiInsights") or {}).get("hours_conflict") is True:
            report.add(Violation(
                "warning", "hours_conflict", day_number, block.get("id"),
                f"'{block.get('title')}' is scheduled at {block.get('start_time')}, which may be outside its opening hours.",
            ))


def _validate_day_travel_time(day: Dict[str, Any], report: ValidationReport) -> None:
    """VAL-01 R8: flags a same-day pair of consecutive blocks whose real
    straight-line distance couldn't plausibly be covered in the scheduled
    gap between them. Deliberately approximate (haversine, not a routed
    travel time — actual roads are always longer/slower) and generous
    (assumes a brisk 40 km/h average with a 10-minute grace buffer), so
    this only fires on genuinely implausible gaps, never a normal city
    crossing. Warning-only: an estimate, not a routing guarantee."""
    from apps.planner.services.distance_service import haversine_distance_km

    day_number = day.get("day_number")
    activities = [a for a in (day.get("activities") or []) if a.get("latitude") is not None and a.get("longitude") is not None]
    parsed = []
    for block in activities:
        start = _parse_time(block.get("start_time"))
        end = _parse_time(block.get("end_time"))
        if start is not None and end is not None:
            parsed.append((start, end, block))
    parsed.sort(key=lambda p: p[0])

    for (_start_a, end_a, block_a), (start_b, _end_b, block_b) in zip(parsed, parsed[1:]):
        gap_mins = (start_b - end_a).total_seconds() / 60
        if gap_mins <= 0:
            continue  # overlap/backwards already reported by _validate_day_temporal
        distance_km = haversine_distance_km(
            float(block_a["latitude"]), float(block_a["longitude"]),
            float(block_b["latitude"]), float(block_b["longitude"]),
        )
        plausible_mins = (distance_km / 40) * 60 + 10
        if gap_mins < plausible_mins - 15:  # tolerance so near-misses don't flag
            report.add(Violation(
                "warning", "tight_travel_time", day_number, block_b.get("id"),
                f"Only {int(gap_mins)} min between '{block_a.get('title')}' and '{block_b.get('title')}' "
                f"(~{distance_km:.0f} km apart) — may be too tight to travel between them.",
            ))


def _validate_hotel_nights(days: List[Dict[str, Any]], report: ValidationReport) -> None:
    """VAL-01 R8: cross-checks a hotel block's own metadata.stay_nights
    (stamped at compose time from the skeleton's per-city night count,
    see _candidate_block) against how many CONSECUTIVE days that stay
    episode actually spans in the final itinerary.

    Must group by consecutive run, not by city name — a loop trip that
    revisits the same city later (e.g. Gangtok -> Pelling -> Gangtok,
    observed for real in Phase B evidence) has two separate stay episodes
    with the same city name; naively summing every day matching that name
    across the whole trip would compare each stay's night count against
    the combined total of both, producing a false mismatch on a perfectly
    correct itinerary. Warning-only: informational drift, not a
    booking-breaking defect by itself.

    Nights vs. days-in-itinerary convention: for a NON-final stay episode,
    the departure/travel day is attributed to the NEXT city (confirmed
    against real Phase B data — a "Cab: Gangtok -> Pelling" transport block
    lands on a day tagged city='Pelling', not 'Gangtok'), so run_length
    (days tagged with this city) equals nights exactly. The trip's FINAL
    stay has no next city to absorb its departure day, so that day stays
    tagged with the same city — run_length is legitimately nights+1 there.
    Both are accepted; only a real mismatch (neither convention fits) flags."""
    index = 0
    while index < len(days):
        city = days[index].get("city")
        run_start = index
        while index < len(days) and days[index].get("city") == city:
            index += 1
        run = days[run_start:index]
        run_length = len(run)
        is_final_run = index == len(days)
        acceptable_nights = {run_length, run_length - 1} if is_final_run else {run_length}
        for day in run:
            for block in day.get("activities") or []:
                if block.get("category") != "hotel":
                    continue
                stay_nights = (block.get("metadata") or {}).get("stay_nights")
                if stay_nights is not None and int(stay_nights) not in acceptable_nights:
                    report.add(Violation(
                        "warning", "hotel_nights_mismatch", day.get("day_number"), block.get("id"),
                        f"'{block.get('title')}' is booked for {stay_nights} night(s) but this {city} "
                        f"stay spans {run_length} day(s) in this itinerary.",
                    ))
                break  # one hotel-nights check per stay episode is enough


_GEO_SANITY_RADIUS_KM = 200  # generous — a real day-trip/excursion to a nearby
                              # town is legitimate; this only catches a coordinate
                              # that's clearly a bad geocode or wrong-hub mismatch.


def _validate_day_price_sanity(day: Dict[str, Any], report: ValidationReport) -> None:
    """Phase 8 (§14 P8): compares a priced transport block's actual cost
    against reference.services.price_estimator's envelope for the same
    category+distance, flagging blocks that land outside a generous
    [min/1.5, max*1.5] tolerance band. Scoped to cab/bus/train, the only
    categories that (a) ever carry a real cost this early in the pipeline —
    _price_transport_blocks is the sole generation-time pricing pass; hotel/
    restaurant/attraction/activity blocks stay estimated_cost=None until a
    later booking flow — and (b) have a distance figure available at all,
    via the day's own transit_hints (the same real road-distance data
    _stamp_transit_hints already computed, not a fresh guess). A block with
    no matching transit_hints pair, or a category price_estimator has no
    seeded FareRule for (train, today), is silently skipped — no baseline,
    no false positive. Warning-only: an estimate mismatch is a signal to
    look closer, never proof the price itself is wrong."""
    from apps.reference.services import price_estimator

    day_number = day.get("day_number")
    transit_hints = day.get("transit_hints") or {}
    for block in day.get("activities") or []:
        category = (block.get("category") or "").lower()
        if category not in ("cab", "bus", "train"):
            continue
        cost = (block.get("cost") or {}).get("amount")
        if cost is None:
            cost = block.get("estimated_cost")
        if cost is None:
            continue
        try:
            cost = float(cost)
        except (TypeError, ValueError):
            continue

        block_id = block.get("id")
        distance_km = None
        for pair_id, hint in transit_hints.items():
            if block_id and block_id in pair_id.split(":"):
                distance_km = hint.get("distance_km")
                if distance_km:
                    break
        if not distance_km:
            continue

        try:
            envelope = price_estimator.estimate(category, distance_km=distance_km)
        except Exception:
            continue
        if envelope.get("min") is None or envelope.get("max") is None:
            continue  # insufficient_data — no baseline to compare against

        lo, hi = envelope["min"] / 1.5, envelope["max"] * 1.5
        if not (lo <= cost <= hi):
            report.add(Violation(
                "warning", "price_sanity", day_number, block.get("id"),
                f"'{block.get('title')}' costs {cost:,.0f} but the estimator expects roughly "
                f"{envelope['min']:,.0f}-{envelope['max']:,.0f} for this distance — worth a second look.",
            ))


def _validate_day_geo_sanity(day: Dict[str, Any], report: ValidationReport) -> None:
    """Phase 8 (§14 P8): flags a block whose coordinates land implausibly
    far from its own day's city — a sign of a bad geocode or a mismatched
    hub resolution, not a real itinerary choice. Same City-lookup pattern
    insight_engine.py's LocalHolidayInsight already uses. Warning-only,
    generous radius so a legitimate nearby excursion never flags."""
    from apps.planner.services.distance_service import haversine_distance_km
    from apps.reference.models import City

    day_number = day.get("day_number")
    city_name = (day.get("city") or "").strip()
    if not city_name:
        return
    city_obj = City.objects.filter(name__iexact=city_name).first()
    if not city_obj or city_obj.latitude is None or city_obj.longitude is None:
        return

    for block in day.get("activities") or []:
        lat, lng = block.get("latitude"), block.get("longitude")
        if lat is None or lng is None:
            continue
        distance_km = haversine_distance_km(
            float(city_obj.latitude), float(city_obj.longitude), float(lat), float(lng),
        )
        if distance_km > _GEO_SANITY_RADIUS_KM:
            report.add(Violation(
                "warning", "geo_sanity", day_number, block.get("id"),
                f"'{block.get('title')}' is ~{distance_km:.0f} km from {city_name} — "
                f"check this is really part of this day.",
            ))
