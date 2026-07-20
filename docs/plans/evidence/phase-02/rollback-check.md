# Phase 02 Rollback Check

- Migration `0013` is structurally reversible and contains no data operation.
- Reversing it removes only the four new fields and eight indexes.
- Coordinate repair changed existing placeholder/missing coordinate fields and therefore
  requires the owner-confirmed database backup for exact data rollback.
- No row was created or deleted; service areas and route facts were untouched.
- Compatibility Haversine wrappers allow service-hunk rollback without caller changes.
- The post-apply command is idempotent and currently proposes zero writes.

Verdict: rollback path is explicit and safe.
