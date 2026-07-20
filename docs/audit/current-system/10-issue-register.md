# Issue Register
| ID | Severity | Problem | Recommended Fix |
|---|---|---|---|
| ARCH-001 | High | Thread fallback for generation jobs | Ensure Celery is strictly required in production |
| PLAN-001 | High | Stale revisions during PATCH | Enforce `expected_revision` uniformly in frontend |
| DATA-001 | Medium | AI hallucinated places | Validate all LLM output against `ReferenceMaster` before DB persist |
| UI-001 | Medium | Optimistic UI rollback | Add error boundaries and toast notifications for failed API calls |
