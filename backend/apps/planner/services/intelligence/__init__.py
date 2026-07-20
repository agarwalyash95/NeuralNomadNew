"""
Planner Intelligence Layer — the single home for recommendation ranking,
reasoning generation, confidence calculation, proactive suggestions,
explanations, personalization, and smart defaults.

ConversationEngine and WidgetOrchestrator are thin consumers:

    Intelligence → best recommendation (+ reasons + defaults) → widget

Modules:
  clusters         — canonical cluster/ladder vocabulary (ONE source of truth)
  recommendations  — per-cluster ranked recommendations (DB-backed, deterministic)
  confidence       — planning confidence score + ✓/✗ factor checklist
  preferences      — AI reasoning memory (metadata["ai_preferences"])
  offers           — contextual proactive offers (intent × visit_purpose)
  journey_feed     — ambient "Did you know…" facts               (Phase 4)
  progressive      — background plan warm-up                     (Phase 8)

Design rules (docs/ai-orchestration-architecture.md §9/§10):
  - Deterministic and DB-backed; no per-turn LLM calls.
  - Never fabricate: no matching data → generic honest text, never invented
    prices/facts.
  - Never crash a turn: every public function degrades gracefully.
  - Never mutate the draft while building a payload (read-only builders).
"""
