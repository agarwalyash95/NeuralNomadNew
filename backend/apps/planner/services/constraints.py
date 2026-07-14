"""
Hard-constraint enforcement for plan generation (T2.2).

Reads TravelerProfile.facts for known accessibility/travel constraints and
filters candidate venues/transport before they ever reach the LLM compose
step — a constrained traveler should never be offered an inaccessible venue
or a red-eye flight in the first place.

Constraint fact keys (TravelerProfile.facts[].key):
  accessibility_wheelchair  — value: true  → require step-free / wheelchair-friendly
  accessibility_stroller    — value: true  → require step-free access
  avoid_red_eye             — value: true  → exclude flights departing 00:00–05:00
"""

_ACCESSIBILITY_KEYS = {"accessibility_wheelchair", "accessibility_stroller"}


class ConstraintEngine:
    """
    Built from a workspace's TravelerProfile.facts. `constraints` is a plain
    dict of active constraint keys -> True, safe to log/display. If no facts
    imply a hard constraint, `constraints` is empty and every filter is a
    no-op (unconstrained = always valid, never silently restrictive).
    """

    def __init__(self, workspace):
        self.constraints = {}
        user = getattr(workspace, "user", None)
        if user is None:
            return
        try:
            from apps.planner.models import TravelerProfile

            profile = TravelerProfile.objects.filter(user=user).first()
        except Exception:
            return
        if not profile or not profile.facts:
            return

        for fact in profile.facts:
            key, value = fact.get("key"), fact.get("value")
            if key in _ACCESSIBILITY_KEYS and value in (True, "true", "yes"):
                self.constraints[key] = True
            elif key == "avoid_red_eye" and value in (True, "true", "yes"):
                self.constraints["avoid_red_eye"] = True

    def is_valid_venue(self, row) -> bool:
        """
        True unless a known hard constraint demonstrably excludes this row.
        Unknown/missing accessibility data never excludes a venue — silence
        is not evidence of inaccessibility, only ignorance.
        """
        if not self.constraints:
            return True
        needs_step_free = "accessibility_wheelchair" in self.constraints or "accessibility_stroller" in self.constraints
        if not needs_step_free:
            return True

        detail = getattr(row, "accessibility_detail", None) or {}
        step_free = detail.get("step_free")
        if step_free is False:
            return False  # demonstrably not step-free — exclude
        # step_free is True or unknown (None) — don't exclude on absence of data
        wheelchair_flag = getattr(row, "wheelchair_accessible", None)
        if wheelchair_flag is False and "accessibility_wheelchair" in self.constraints:
            return False
        return True

    def is_valid_transport(self, mode: str, start_time) -> bool:
        """True unless avoid_red_eye excludes a 00:00-05:00 flight departure."""
        if "avoid_red_eye" not in self.constraints or mode != "flight" or not start_time:
            return True
        try:
            hour = int(str(start_time).split(":")[0])
        except (ValueError, IndexError):
            return True
        return not (0 <= hour < 5)
