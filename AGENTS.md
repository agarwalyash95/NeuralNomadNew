# NeuralNomad Coding-Agent Contract

This file is the canonical entry point for every coding agent working in this repository. Platform-specific instruction files must point here instead of duplicating these rules.

## Mandatory startup

Before proposing or changing code:

1. Read this file completely.
2. Read `docs/agent/CURRENT_STATE.md`.
3. Read `docs/agent/HANDOFF.md`.
4. Read only the decisions in `docs/agent/DECISIONS.md` that affect the task.
5. Inspect the current branch, `git status --short`, and the relevant diff. Never assume the working tree is clean.
6. Read the implementation and its callers before relying on a plan or summary.

Run `python scripts/agent_context.py` for a read-only startup summary. If Python is unavailable, perform the steps manually.

## Source-of-truth order

When sources disagree, use this order:

1. The owner's latest request and explicit constraints.
2. Observed runtime behavior and reproducible command output.
3. Current code, migrations, tests, and configuration.
4. Accepted entries in `docs/agent/DECISIONS.md`.
5. `docs/agent/CURRENT_STATE.md` and `docs/agent/HANDOFF.md`.
6. Plans, roadmaps, summaries, and historical documentation.

Do not describe planned behavior as implemented. Label uncertain claims and verify them when practical.

## Non-negotiable working rules

- Preserve user changes. Do not reset, revert, delete, reformat, or overwrite unrelated work.
- Treat a dirty tree as active work owned by someone else unless the current task clearly owns a file.
- Keep changes within the requested scope. Do not start a neighboring backlog item without owner approval.
- Preserve the current architecture unless runtime evidence and an accepted decision justify changing it.
- Search for existing types, services, patterns, and utilities before creating parallel abstractions.
- Read both sides of a contract before changing it: frontend/backend, caller/callee, serializer/model, migration/model, or producer/consumer.
- Never expose or commit secrets, local environment files, tokens, credentials, or personal data.
- Do not claim success without recording the verification actually run and its result.
- If blocked, leave the tree safe and make the next action explicit in the handoff.

## Work cycle

For every task, follow `docs/agent/WORKFLOW.md`:

1. Establish the baseline and restate the scoped outcome.
2. Identify affected contracts and existing uncommitted changes.
3. Implement the smallest coherent change.
4. Verify in proportion to risk.
5. Review the final diff for scope and accidental changes.
6. Update continuity documents before ending the session.

## Required end-of-session updates

Update `docs/agent/HANDOFF.md` whenever work stops, including partial or blocked work. Update `docs/agent/CURRENT_STATE.md` when the project checkpoint, active gate, verified capability, or next priority changes. Append to `docs/agent/DECISIONS.md` only for a durable architectural or product decision.

The handoff must state the requested outcome, what changed, exact files, verification results, remaining risks, and the single best next action. Documentation-only exploration that changes no project state may leave it unchanged.

## Repository-specific guardrails

- The active product area is the Next.js frontend in `frontend/` and Django backend in `backend/`.
- The server owns canonical pre-generation trip state and generated-plan revision state. Clients mirror and reconcile that state; do not introduce another authority casually.
- AI may propose planning strategy, but deterministic services own facts, IDs, provenance, validation, persistence, and concurrency controls.
- The planner repair sequence in `docs/planner-complete-current-audit-and-repair-plan.md` is owner-gated. Do not advance deferred phases without the required runtime evidence and owner direction.
- The automated planner test suite is currently absent from the working tree. Do not silently treat this as a passing test baseline or restore/delete it without explicit scope.

## Common verification commands

Use only the commands relevant to the change:

```text
Frontend:  cd frontend && npm run type-check
           cd frontend && npm run lint
           cd frontend && npm run build

Backend:   cd backend && python manage.py check
           cd backend && python manage.py makemigrations --check --dry-run
           cd backend && python -m compileall apps config

Docker:    docker compose config
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
