"""
PlanBlock output contract — the schema every generated block must conform
to before being persisted (docs/planner-output-generation-architecture.md
B13). Before this module, the composed dict from _compose_days was written
straight into PlannerTrip.days with no schema check at all.

Deliberately validates only fields that are REAL today: grounding
(master_ref for non-transport blocks), and the common shape every block
already carries. The full B13 spec also calls for `why` (reasoning),
`confidence`, `alternatives`, and `tags` — those are added to this contract
incrementally as the phases that produce real data behind them land
(PreferenceScorer for `why`/`confidence` in Phase 2, validation/refinement
in Phase 3). Adding those fields now, with nothing real to populate them,
would mean either leaving them blank (useless) or inventing a placeholder
value (fabrication) — both violate this project's core discipline of never
presenting invented data as real. This module is the extension point; it
is not itself the full contract yet.
"""

from typing import Any, Dict, List

_REQUIRED_COMMON_FIELDS = ("id", "category", "title", "start_time", "end_time", "status", "metadata")

# Phase 0b (docs/planner-north-star-audit-and-vision.md): rest/hotel_return
# are deliberately non-bookable — no price, provenance, or master ref by
# design (chat_edit_intents._build_rest_block/_build_hotel_return_block,
# mirrored by ItineraryTimeline.tsx's createLightBlock). This contract
# predates that taxonomy and was never updated to exempt them, so the first
# generation-time path that actually emits one — _append_hotel_return_
# anchors (Phase 2g) — failed BlockContractViolation on every real trip it
# fired for (currency_code + master_ref both, understandably, absent).
# Confirmed as a real, live production failure, not a hypothetical.
_NON_BOOKABLE_CATEGORIES = {"rest", "hotel_return"}


class BlockContractViolation(Exception):
    """Raised with every violation found for a block/day, never just the
    first — a caller fixing one issue should see the rest in the same pass."""


def validate_block(block: Dict[str, Any]) -> None:
    violations: List[str] = []
    category = block.get("category")
    is_non_bookable = category in _NON_BOOKABLE_CATEGORIES

    for field_name in _REQUIRED_COMMON_FIELDS:
        if block.get(field_name) in (None, ""):
            violations.append(f"missing required field: {field_name}")

    if not is_non_bookable and not block.get("currency_code"):
        violations.append("missing required field: currency_code")

    metadata = block.get("metadata") or {}
    is_transport = bool(metadata.get("transport"))
    if not is_transport and not is_non_bookable:
        master_ref = metadata.get("master_ref")
        if not master_ref or not master_ref.get("table") or master_ref.get("id") is None:
            violations.append("non-transport block missing metadata.master_ref{table,id} — ungrounded block")

    if violations:
        raise BlockContractViolation(
            f"Block {block.get('id')!r} (category={block.get('category')!r}): " + "; ".join(violations)
        )


def validate_days(days: List[Dict[str, Any]]) -> None:
    """Validates every block across every day. Raises once with every
    violation found across the whole plan, not just the first block hit —
    a generation failure here degrades to the curated fallback (Phase 0b),
    the same honest path as an LLM failure, never a silent bad persist."""
    all_violations: List[str] = []
    for day in days:
        for block in day.get("activities", []):
            try:
                validate_block(block)
            except BlockContractViolation as exc:
                all_violations.append(str(exc))
    if all_violations:
        raise BlockContractViolation("; ".join(all_violations))
