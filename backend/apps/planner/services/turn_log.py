"""
Structured per-turn observability (audit OBS-01, checklist 0.1 —
docs/planner-complete-audit-and-fix-plan.md).

One JSON log line per chat turn on the `planner.turn` logger, carrying the
fields needed to quantify the CH-01 family of bugs in real traffic:

  prompted_step   — the ladder step the LLM prompt's "CURRENT ACTIVE STEP"
                    instruction was built against (pre-merge today; after the
                    Phase 1 fix this must always equal the emitted widget)
  emitted_widgets — widget types actually attached to the assistant message
  step_mismatch   — True when a step was prompted but no emitted widget
                    matches it (the CH-01 desync signal; destination_highlight
                    is a GIVE card, not a step, so it never counts as a match)
  answer_only     — the turn_intent classification for this turn
  extracted_fields— extraction fields the model returned non-null this turn

The line is emitted by ConversationService.send_message (the one place that
knows both the engine result and the answer_only decision).
"""

import json
import logging

logger = logging.getLogger("planner.turn")

# GIVE-only cards that are never a ladder step — their presence can't satisfy
# (or violate) prompted-step/widget agreement.
_NON_STEP_WIDGETS = {"destination_highlight"}


def log_turn(
    *,
    workspace_id,
    prompted_step,
    emitted_widgets,
    answer_only,
    extracted_fields,
    extraction_tier,
    detected_intent,
    ready_for_plan,
):
    step_widgets = [w for w in (emitted_widgets or []) if w not in _NON_STEP_WIDGETS]
    step_mismatch = bool(prompted_step) and prompted_step not in step_widgets
    payload = {
        "workspace": str(workspace_id),
        "prompted_step": prompted_step,
        "emitted_widgets": list(emitted_widgets or []),
        "step_mismatch": step_mismatch,
        "answer_only": bool(answer_only),
        "extracted_fields": sorted(extracted_fields or []),
        "extraction_tier": extraction_tier,
        "detected_intent": detected_intent,
        "ready_for_plan": bool(ready_for_plan),
    }
    logger.info("turn %s", json.dumps(payload, default=str))
    return payload
