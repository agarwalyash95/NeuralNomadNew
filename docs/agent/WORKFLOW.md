# Cross-Agent Development Workflow

This workflow keeps work resumable when switching between Codex, Claude, Gemini, Copilot, Cursor, Cline, Windsurf, or another coding agent.

## 1. Start: reconstruct reality

Read the mandatory files in `AGENTS.md`, then establish a baseline:

```bash
python scripts/agent_context.py
git status --short
git diff -- <relevant-paths>
```

Before editing, identify the exact requested outcome, active checkpoint, verified versus planned claims, relevant existing changes, affected contracts, and the smallest check that could disprove the proposed fix.

If the handoff is stale, do not “correct” the code to match it. Reconcile the documents to observed code/runtime evidence.

## 2. Scope: define the task boundary

Use this compact task contract in notes or the handoff:

```text
Outcome:
In scope:
Out of scope:
Acceptance evidence:
Likely files:
Risks / unknowns:
```

If the task touches an already-modified file, inspect its full diff first and preserve unrelated hunks. If ownership is ambiguous and a change could destroy work, stop and ask the owner.

## 3. Investigate before implementing

- Trace behavior from entry point to persistence or output.
- Search for existing implementations and conventions.
- Check schemas, migrations, serializers, API types, and UI consumers together.
- Separate the first incorrect decision from downstream symptoms.
- Prefer runtime evidence over inferred explanations when runtime access exists.
- Record newly discovered out-of-scope issues in the handoff; do not fix them opportunistically.

## 4. Implement a coherent slice

- Make the smallest change that satisfies the task end to end.
- Preserve established ownership boundaries and data contracts.
- Add or update migration/API/type coverage when a contract changes.
- Avoid broad cleanup, renames, dependency upgrades, or formatting unless required.
- Keep generated artifacts and local caches out of the change unless explicitly requested.

For long work, refresh `HANDOFF.md` at meaningful safe checkpoints so an interrupted session remains recoverable.

## 5. Verify proportionally

Use narrow relevant checks first, then broaden when risk warrants it.

| Change | Minimum evidence |
|---|---|
| Documentation/process only | Inspect links, paths, status, and final diff |
| Frontend types/state/API contract | Targeted check plus `npm run type-check` |
| Frontend behavior/style | Type-check, lint as applicable, and manual/rendered behavior |
| Backend Python logic | Targeted exercise plus `manage.py check` |
| Model/schema | Migration inspection and `makemigrations --check --dry-run` |
| Cross-stack contract | Backend check, frontend type-check, and one end-to-end/manual flow |
| Infrastructure/config | Config validation and service startup/health check where available |

Record commands exactly. Distinguish passing, failing, skipped, and unavailable checks. A pre-existing failure is still a failure; label it with evidence instead of hiding it.

## 6. Review the final diff

Before stopping:

1. Re-run `git status --short`.
2. Review every changed hunk owned by the task.
3. Confirm no secrets, caches, build output, or unrelated changes were added.
4. Confirm the change matches the requested outcome, not a larger imagined goal.
5. Confirm documentation describes the implemented state accurately.

Do not stage, commit, push, deploy, or discard changes unless the owner requested it.

## 7. Handoff: make resumption mechanical

Replace the “Latest handoff” section in `HANDOFF.md` with:

```markdown
## Latest handoff

- Updated: YYYY-MM-DD HH:MM timezone
- Agent/platform: name
- Requested outcome: ...
- Status: Verified | Implemented, unverified | In progress | Blocked

### Completed
- ...

### Changed files
- `path`: why it changed

### Verification
- PASS — `exact command`: relevant result
- FAIL — `exact command`: relevant result
- SKIPPED — reason

### Remaining work / risks
- ...

### Next action
1. One concrete next step.
```

Keep the handoff concise enough to scan, but exact enough that the next agent does not need chat history.

## 8. Maintain durable state

Update `CURRENT_STATE.md` when the active initiative, owner gate, verified capability, next priority, material risk, or baseline changes. Append a decision only when a choice should constrain future agents. Never rewrite old decisions; append a superseding one.

## Conflict and recovery rules

- **Documents disagree with code:** code/runtime wins; update the document with dated evidence.
- **Two agents changed the same file:** preserve both sets of work, identify overlapping hunks, and ask before discarding intent.
- **A verification command cannot run:** record why and provide the exact command for the next environment.
- **The owner changes direction:** update the active goal and handoff; do not erase prior decisions unless explicitly superseded.
- **The repository is dirty:** continue only in owned files and never use destructive cleanup commands.
