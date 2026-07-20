# Agent Continuity System

This directory is the shared memory for coding agents. It is deliberately tool- and platform-neutral.

| File | Purpose | Update rule |
|---|---|---|
| `../../AGENTS.md` | Canonical rules and startup order | Change rarely |
| `CURRENT_STATE.md` | Verified project checkpoint and active gate | Update when reality changes |
| `HANDOFF.md` | Latest session's resumable handoff | Update whenever work stops |
| `DECISIONS.md` | Append-only durable decisions | Append after a real decision |
| `WORKFLOW.md` | Detailed start/work/verify/handoff protocol | Change when the process improves |

These files are not a substitute for inspecting code and the working tree. They are navigation aids whose claims should include evidence and a date.

## Status vocabulary

- **Verified**: supported by code inspection plus a successful check or observed runtime result.
- **Implemented, unverified**: code exists, but the relevant runtime behavior has not been observed.
- **In progress**: work has started and is not yet a safe completed checkpoint.
- **Blocked**: progress needs a named input, permission, dependency, or external result.
- **Planned**: accepted as future work but not started.
- **Unknown**: not inspected or evidence conflicts.

Avoid vague labels such as “mostly done.” State the evidence and remaining gap instead.
