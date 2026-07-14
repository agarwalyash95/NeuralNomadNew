"""
PlanInsightEngine — itinerary-level proactive intelligence (see
docs/travel-intelligence-implementation-roadmap.md §11 / §1.10).

Every rule is evaluated against real, already-computed trip data (never a
fresh LLM call per rule) and returns advisory insights. Rules whose fix has
an obvious, concrete diff (e.g. "move breakfast 30 minutes") are expected to
set `action` to a PlanProposal-shaped dict so acceptance flows through the
same proposal mechanism as any other plan edit — see PlanProposal.KIND_INSIGHT.
Rules that are purely advisory (no single correct corrective diff) leave
`action` as None; the frontend renders these as plain informational nodes,
not accept/dismiss suggestions (see roadmap §2.6).

Six rules are implemented here — the original two needing nothing beyond
K1/K3 data (DailyWalkLoadWarning, HeatExposureWarning), plus four that
became buildable once blocks carry editable start/end times
(docs/planner-product-audit-2026-07.md Wave 2 TL1): ScheduleGapWarning,
CheckInMismatchWarning, LateArrivalWarning, and OpeningHoursConflictWarning
(the last resolves each block's own opening_hours via metadata.master_ref —
never guesses when the master row or the hours text don't parse cleanly).
All four are advisory-only (action=None) for the same reason the original
two are: none has a single mechanically-correct corrective diff, only a
judgment call about which slot to move to. The rest of the original RULES
list (CrowdPeakWarning, SunriseAdjustedTiming, OnRouteOpportunity,
HotelTravelTimeSaving, PreferenceMatch, ReviewRecencyDrop, FreeEntryToday,
RouteClosureConflict, HolidayClosureConflict, TimeBudgetTradeoff) depend on
K5 data (crowd telemetry, golden-hour computation, TravelerProfile
injection, Event/HolidayCalendar wiring) and are added there.
"""

from apps.planner.services.distance_service import haversine_distance_km
from apps.planner.services.opening_hours import is_open_at


def _to_minutes(time_str):
    """'14:05' -> 845. None on anything that doesn't parse — never guesses a time."""
    try:
        h, m = str(time_str).split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _is_active(block):
    return block.get("is_active") is not False and block.get("status") != "inactive"


def _group_days_by_city(trip):
    grouped = {}
    for day in trip.days or []:
        grouped.setdefault((day.get("city") or "").strip().lower(), []).append(day)
    for days in grouped.values():
        days.sort(key=lambda d: d.get("day_number") or 0)
    return grouped


class InsightRule:
    key = None

    def evaluate(self, trip):
        """Returns a list of insight dicts. Must not mutate `trip`."""
        raise NotImplementedError


class DailyWalkLoadWarning(InsightRule):
    key = "daily_walk_load"
    DEFAULT_THRESHOLD_KM = 6.0

    def evaluate(self, trip):
        insights = []
        for day in trip.days or []:
            geo_blocks = [
                a for a in day.get("activities", [])
                if a.get("latitude") is not None and a.get("longitude") is not None
            ]
            if len(geo_blocks) < 2:
                continue
            total_km = sum(
                haversine_distance_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
                for a, b in zip(geo_blocks, geo_blocks[1:])
            )
            if total_km >= self.DEFAULT_THRESHOLD_KM:
                insights.append({
                    "rule": self.key,
                    "day_number": day.get("day_number"),
                    "severity": "info",
                    "message": (
                        f"Day {day.get('day_number')} covers roughly {total_km:.1f} km on foot "
                        f"between stops — worth budgeting for a cab on at least one leg."
                    ),
                    "related_block_ids": [a["id"] for a in geo_blocks],
                    "action": None,
                })
        return insights


class HeatExposureWarning(InsightRule):
    key = "heat_exposure"
    HOT_TEMP_C = 32.0
    OUTDOOR_CATEGORIES = ("attraction", "activity")
    EXPOSURE_WINDOW = (11, 15)  # 11:00-15:00

    @staticmethod
    def _hour(time_str):
        try:
            return int(str(time_str).split(":")[0])
        except (ValueError, IndexError, AttributeError):
            return None

    def evaluate(self, trip):
        insights = []
        for day in trip.days or []:
            weather = day.get("weather_normal") or {}
            avg_temp = weather.get("avg_temp_c")
            if avg_temp is None or avg_temp < self.HOT_TEMP_C:
                continue

            exposed = []
            for block in day.get("activities", []):
                if (block.get("category") or "").lower() not in self.OUTDOOR_CATEGORIES:
                    continue
                hour = self._hour(block.get("start_time"))
                if hour is not None and self.EXPOSURE_WINDOW[0] <= hour < self.EXPOSURE_WINDOW[1]:
                    exposed.append(block)

            if exposed:
                names = ", ".join(b.get("title", "an outdoor stop") for b in exposed[:2])
                insights.append({
                    "rule": self.key,
                    "day_number": day.get("day_number"),
                    "severity": "warning",
                    "message": (
                        f"Day {day.get('day_number')} averages {avg_temp:.0f}°C — {names} "
                        f"{'is' if len(exposed) == 1 else 'are'} scheduled during the hottest "
                        f"part of the day (11am-3pm). Consider an earlier or later slot."
                    ),
                    "related_block_ids": [b["id"] for b in exposed],
                    "action": None,
                })
        return insights


class ScheduleGapWarning(InsightRule):
    key = "schedule_gap"
    GAP_THRESHOLD_MINS = 180  # 3 hours

    def evaluate(self, trip):
        insights = []
        for day in trip.days or []:
            timed = [
                (_to_minutes(a.get("start_time")), _to_minutes(a.get("end_time")), a)
                for a in day.get("activities", [])
                if _is_active(a)
            ]
            timed = [(s, e, a) for s, e, a in timed if s is not None]
            timed.sort(key=lambda t: t[0])
            for (s1, e1, a1), (s2, _e2, a2) in zip(timed, timed[1:]):
                gap_start = e1 if e1 is not None else s1
                gap = s2 - gap_start
                if gap >= self.GAP_THRESHOLD_MINS:
                    hours = round(gap / 60, 1)
                    insights.append({
                        "rule": self.key,
                        "day_number": day.get("day_number"),
                        "severity": "info",
                        "message": (
                            f"Day {day.get('day_number')} has a {hours:g}-hour gap between "
                            f"{a1.get('title', 'your last stop')} and {a2.get('title', 'your next stop')} "
                            f"— room for something else, or just a slower morning."
                        ),
                        "related_block_ids": [a1.get("id"), a2.get("id")],
                        "action": None,
                    })
        return insights


class CheckInMismatchWarning(InsightRule):
    key = "checkin_mismatch"

    def evaluate(self, trip):
        insights = []
        days_by_city = _group_days_by_city(trip)
        cities = trip.cities or []

        for idx, city in enumerate(cities):
            transit = city.get("transitToNext")
            if not isinstance(transit, dict) or not _is_active(transit):
                continue
            arrival_mins = _to_minutes(transit.get("end_time"))
            if arrival_mins is None:
                continue
            if idx + 1 >= len(cities):
                continue
            next_city = cities[idx + 1]
            next_days = days_by_city.get((next_city.get("name") or "").strip().lower())
            if not next_days:
                continue
            arrival_day = next_days[0]

            for block in arrival_day.get("activities", []):
                if (block.get("category") or "").lower() != "hotel" or not _is_active(block):
                    continue
                checkin_mins = _to_minutes(block.get("start_time"))
                if checkin_mins is None or checkin_mins >= arrival_mins:
                    continue
                insights.append({
                    "rule": self.key,
                    "day_number": arrival_day.get("day_number"),
                    "severity": "warning",
                    "message": (
                        f"{block.get('title', 'Your hotel')} check-in is set for "
                        f"{block.get('start_time')}, but {transit.get('title', 'your transit')} "
                        f"doesn't arrive until {transit.get('end_time')} — push the check-in back."
                    ),
                    "related_block_ids": [block.get("id"), transit.get("id")],
                    "action": None,
                })
        return insights


class LateArrivalWarning(InsightRule):
    key = "late_arrival"
    LATE_HOUR = 22
    EARLY_NEXT_HOUR = 9

    def evaluate(self, trip):
        insights = []
        days_by_city = _group_days_by_city(trip)
        cities = trip.cities or []

        for idx, city in enumerate(cities):
            transit = city.get("transitToNext")
            if not isinstance(transit, dict) or not _is_active(transit):
                continue
            arrival_mins = _to_minutes(transit.get("end_time"))
            if arrival_mins is None or arrival_mins < self.LATE_HOUR * 60:
                continue
            if idx + 1 >= len(cities):
                continue
            next_city = cities[idx + 1]
            next_days = days_by_city.get((next_city.get("name") or "").strip().lower())
            if not next_days:
                continue
            arrival_day = next_days[0]

            timed = [
                (_to_minutes(a.get("start_time")), a)
                for a in arrival_day.get("activities", [])
                if _is_active(a)
            ]
            timed = [(s, a) for s, a in timed if s is not None]
            if not timed:
                continue
            first_start, first_block = min(timed, key=lambda t: t[0])
            if first_start < self.EARLY_NEXT_HOUR * 60:
                insights.append({
                    "rule": self.key,
                    "day_number": arrival_day.get("day_number"),
                    "severity": "warning",
                    "message": (
                        f"{transit.get('title', 'Your transit')} lands at {transit.get('end_time')}, "
                        f"but {first_block.get('title', 'the first stop')} on day "
                        f"{arrival_day.get('day_number')} starts at {first_block.get('start_time')} "
                        f"— a tight or impossible turnaround."
                    ),
                    "related_block_ids": [transit.get("id"), first_block.get("id")],
                    "action": None,
                })
        return insights


_OPENING_HOURS_TABLES = {"attraction", "activity", "restaurant", "hotel"}
_MASTER_MODEL_NAMES = {
    "attraction": "AttractionMaster",
    "activity": "ActivityMaster",
    "restaurant": "RestaurantMaster",
    "hotel": "HotelMaster",
}


class OpeningHoursConflictWarning(InsightRule):
    key = "opening_hours_conflict"

    def evaluate(self, trip):
        insights = []
        lookups = {}
        for day in trip.days or []:
            for block in day.get("activities", []):
                if not _is_active(block):
                    continue
                master_ref = (block.get("metadata") or {}).get("master_ref") or {}
                table, obj_id = master_ref.get("table"), master_ref.get("id")
                if table not in _OPENING_HOURS_TABLES or obj_id is None:
                    continue
                lookups.setdefault((table, obj_id), []).append((day, block))
        if not lookups:
            return insights

        from django.apps import apps as django_apps

        model_cache = {}
        for (table, obj_id), entries in lookups.items():
            if table not in model_cache:
                try:
                    model_cache[table] = django_apps.get_model("reference", _MASTER_MODEL_NAMES[table])
                except LookupError:
                    model_cache[table] = None
            model = model_cache[table]
            if model is None:
                continue
            instance = model.objects.filter(pk=obj_id).only("opening_hours").first()
            if instance is None:
                continue
            opening_hours = instance.opening_hours or []

            for day, block in entries:
                open_status = is_open_at(opening_hours, day.get("date"), block.get("start_time"))
                if open_status is not False:
                    continue  # True (open) or None (unknown) — only flag demonstrable conflicts
                insights.append({
                    "rule": self.key,
                    "day_number": day.get("day_number"),
                    "severity": "warning",
                    "message": (
                        f"{block.get('title', 'This stop')} is scheduled for "
                        f"{block.get('start_time')} on day {day.get('day_number')}, "
                        f"but it's normally closed then."
                    ),
                    "related_block_ids": [block.get("id")],
                    "action": None,
                })
        return insights


class OverloadedDayWarning(InsightRule):
    """
    T7.1 — flags any day with 5+ sightseeing/activity blocks. Computed live
    against the current trip state (same pattern as every rule here), so it
    naturally re-evaluates after any edit — no separate event/persistence
    mechanism needed.
    """
    key = "overloaded_day"
    THRESHOLD = 5

    def evaluate(self, trip):
        insights = []
        for day in trip.days or []:
            movable = [
                a for a in (day.get("activities") or [])
                if _is_active(a) and (a.get("category") or "").lower() in {"attraction", "activity"}
            ]
            if len(movable) < self.THRESHOLD:
                continue
            insights.append({
                "rule": self.key,
                "day_number": day.get("day_number"),
                "severity": "warning",
                "message": (
                    f"Day {day.get('day_number')} has {len(movable)} sightseeing stops — "
                    "that's a full day. Consider moving one to a lighter day."
                ),
                "related_block_ids": [a.get("id") for a in movable],
                "action": None,
            })
        return insights


class LocalHolidayInsight(InsightRule):
    """
    T8.1 — surprise & delight: real public holidays (HolidayCalendar) that
    fall within the trip's date range for a city the trip actually visits.
    Honest provenance — only fires on real DB rows, never invented.
    """
    key = "local_holiday"

    def evaluate(self, trip):
        insights = []
        dated_days = [d for d in (trip.days or []) if d.get("date") and d.get("city")]
        if not dated_days:
            return insights

        try:
            from datetime import date as date_cls
            from apps.reference.models import City, HolidayCalendar
        except Exception:
            return insights

        city_names = {d["city"].strip().lower() for d in dated_days}
        try:
            start_d = date_cls.fromisoformat(min(d["date"] for d in dated_days))
            end_d = date_cls.fromisoformat(max(d["date"] for d in dated_days))
        except (ValueError, TypeError):
            return insights

        seen_countries = set()
        for city_name in city_names:
            for city_obj in City.objects.filter(name__iexact=city_name).select_related("country"):
                if city_obj.country_id in seen_countries:
                    continue
                seen_countries.add(city_obj.country_id)
                for hol in HolidayCalendar.objects.filter(
                    country=city_obj.country, date__gte=start_d, date__lte=end_d
                ):
                    insights.append({
                        "rule": self.key,
                        "day_number": None,
                        "severity": "info",
                        "message": (
                            f"Public holiday in {city_obj.country.name} on "
                            f"{hol.date.strftime('%b %d')}: {hol.name}. Some places may be closed — check hours ahead."
                        ),
                        "related_block_ids": [],
                        "action": None,
                    })
        return insights


class NaturalPhenomenonInsight(InsightRule):
    """
    T8.1 — surprise & delight: seasonal natural phenomena (TravelSeason.natural_phenomena,
    e.g. cherry blossom windows) that overlap the trip's months for a visited city.
    Always carries the DB's own variability window — never a single confident date.
    """
    key = "natural_phenomenon"

    def evaluate(self, trip):
        insights = []
        dated_days = [d for d in (trip.days or []) if d.get("date") and d.get("city")]
        if not dated_days:
            return insights

        try:
            from datetime import date as date_cls
            from apps.reference.models import City, TravelSeason
        except Exception:
            return insights

        city_names = {d["city"].strip().lower() for d in dated_days}
        months = set()
        for d in dated_days:
            try:
                months.add(date_cls.fromisoformat(d["date"]).month)
            except (ValueError, TypeError):
                continue
        if not months:
            return insights

        for city_name in city_names:
            for city_obj in City.objects.filter(name__iexact=city_name):
                for season in TravelSeason.objects.filter(city=city_obj, month__in=list(months)):
                    for phenom in (season.natural_phenomena or []):
                        name = phenom.get("name", "")
                        if not name:
                            continue
                        window = phenom.get("typical_window", [])
                        msg = f"Natural phenomenon in {city_obj.name}: {name} is typically active during your travel window."
                        if window:
                            msg += f" Expected: {window[0]} – {window[-1]}."
                        insights.append({
                            "rule": self.key,
                            "day_number": None,
                            "severity": "info",
                            "message": msg,
                            "related_block_ids": [],
                            "action": None,
                        })
        return insights


RULES = [
    DailyWalkLoadWarning(),
    HeatExposureWarning(),
    ScheduleGapWarning(),
    CheckInMismatchWarning(),
    LateArrivalWarning(),
    OpeningHoursConflictWarning(),
    OverloadedDayWarning(),
    LocalHolidayInsight(),
    NaturalPhenomenonInsight(),
]


class PlanInsightEngine:
    @staticmethod
    def run(trip):
        """Runs every registered rule against a PlannerTrip, returns the flat insight list."""
        insights = []
        for rule in RULES:
            try:
                insights.extend(rule.evaluate(trip))
            except Exception:
                # One rule's bug must not take down the rest of the batch pass.
                continue
        return insights
