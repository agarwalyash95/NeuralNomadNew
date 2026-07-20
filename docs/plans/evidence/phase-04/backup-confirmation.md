# Phase 4 Pre-Work Backup Confirmation

- Date: 2026-07-19 (Asia/Calcutta)
- Method: `pg_dump` (PostgreSQL 18 client, custom format `-F c`), same direct approach
  used in Phase 3 (DB reachable, `pg_dump.exe` at
  `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`, credentials read from
  `config.settings.development`).
- Output: `neuralnomad_pre_phase4_20260719_221801.dump`, 18,330,270 bytes, stored
  outside the repository (session scratchpad, not committed).
- Target database: `neuralnomad` (PostgreSQL 18.4, `localhost:5433`).
- Restore path: `pg_restore -h localhost -p 5433 -U postgres -d neuralnomad --clean --if-exists <dump-file>`.
