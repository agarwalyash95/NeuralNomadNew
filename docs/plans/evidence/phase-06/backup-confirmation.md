# Phase 6 Pre-Work Backup Confirmation

- Date: 2026-07-20 (Asia/Calcutta)
- Method: `pg_dump` (PostgreSQL 18 client, custom format `-F c`), same direct approach
  used in Phases 3 and 4 (`pg_dump.exe` at `C:\Program Files\PostgreSQL\18\bin`,
  credentials read programmatically from Django's `config.settings.development`
  and passed via `PGPASSWORD` for a non-interactive run — the password itself
  was never printed to any log or transcript, only piped through a scratch
  file deleted immediately after the dump completed).
- Output: `neuralnomad_pre_phase6_20260720_014000.dump`, 30,283,138 bytes,
  stored outside the repository (session scratchpad, not committed).
- Target database: `neuralnomad` (PostgreSQL 18, `localhost:5433`).
- Integrity check: `pg_restore --list` against the dump succeeded, 909 TOC
  entries listed.
- Restore path: `pg_restore -h localhost -p 5433 -U postgres -d neuralnomad --clean --if-exists <dump-file>`.
