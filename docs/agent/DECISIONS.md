# Durable Decision Log

Append new records; do not rewrite accepted history. If a decision changes, add a new record with `Supersedes: D-XXX`.

## D-001 — One canonical cross-agent context system

- Date: 2026-07-18
- Status: Accepted
- Decision: `AGENTS.md` and `docs/agent/` are the canonical continuity system. Platform-specific files contain pointers and small compatibility notes only.
- Why: Duplicated agent instructions drift and leave switching agents with contradictory context.
- Consequence: Any durable workflow change must be made in the canonical files first.

## D-002 — Evidence-first source precedence

- Date: 2026-07-18
- Status: Accepted
- Decision: Latest owner intent and observed runtime/code evidence outrank summaries, handoffs, and planning documents.
- Why: This repository contains older plans and a large uncommitted refactor, so prose can lag implementation.
- Consequence: Agents reconcile stale docs to reality; they do not reshape working code merely to match old prose.

## D-003 — Preserve the planner architecture pending runtime proof

- Date: 2026-07-18
- Status: Provisional
- Decision: Repair the current planner architecture incrementally and keep its server-authoritative/deterministic boundaries until Phase B runtime evidence shows a structural failure.
- Why: Static audit found a contained generation bug and several evidence-gated issues, not proof that a rewrite is required.
- Consequence: Deferred planner repairs and architecture changes require runtime evidence plus owner direction.
- Source: `docs/planner-complete-current-audit-and-repair-plan.md` sections 18–20.

## D-004 — Backend dependency direction

- Date: 2026-07-19
- Status: Accepted
- Decision: Backend domain dependencies flow `planner -> reference -> common`. Reference and knowledge must not import planner, except the two temporary, checker-visible calls to the single sanctioned planner geocoding writer. Provenance construction is owned by `apps.common.provenance`; planner retains a compatibility re-export.
- Why: Reference-owned price, suggestion, and station services previously imported planner utilities, creating reverse dependencies and import-cycle risk.
- Consequence: `check_layer_boundaries` enforces the rule; new exceptions require an explicit durable decision. The geocoding allowlist must shrink rather than spread and is removed when the approved consolidation supplies a lower-layer writer.
- Evidence: `docs/plans/phases/phase-01-implementation-report.md`; `backend/apps/reference/management/commands/check_layer_boundaries.py`.

## New decision template

```markdown
## D-XXX — Short title

- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded
- Supersedes: D-XXX (optional)
- Decision: ...
- Why: ...
- Consequence: ...
- Evidence: paths, commands, issue, or owner direction
```
