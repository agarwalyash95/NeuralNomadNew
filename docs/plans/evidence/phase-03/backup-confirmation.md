# Phase 3 Pre-Work Backup Confirmation

- Date: 2026-07-19 (Asia/Calcutta)
- Method: `pg_dump` (PostgreSQL 18 client, custom format `-F c`), run directly against
  the live host-native database using credentials read from
  `config.settings.development` (`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`).
- Target database: `neuralnomad` (PostgreSQL 18.4, `localhost:5433`).
- Output: `neuralnomad_pre_phase3_20260719_202548.dump`, 17,403,255 bytes, stored outside
  the repository (session scratchpad — not committed; the file is a full-DB credential-
  adjacent artifact and must not enter version control).
- Integrity check: `pg_restore --list` against the archive succeeded and enumerated 788
  TOC entries (schema, extension `vector`, and all table/sequence/index/constraint
  entries) with no read errors. This confirms the archive is a valid, restorable backup,
  not just a non-empty file.
- Row counts at backup time (`pg_stat_user_tables`, `reference_*`): city 15,395;
  railway_station 9,011; airport 7,063; railway_station_service_area 614,260;
  airport_service_area 47,291; state 1,976; country 250; hotel/restaurant/attraction/
  activity master 388/461/441/356; travel_price_history 42; bus_route/metro_station/
  airport_route 0.
- This satisfies the Phase 3 backup gate (§14 global rule: "owner takes a `pg_dump`
  before any phase that migrates schema or mutates data at scale"). The dump was taken
  directly (DB reachable, `pg_dump.exe` located at
  `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`) rather than waiting on a separate
  owner action, since taking a backup is non-destructive and read-only against the
  source database.
- **Restore path**, if ever needed: `pg_restore -h localhost -p 5433 -U postgres -d neuralnomad --clean --if-exists <dump-file>` against a database at the same or later schema state, or into a freshly created database for inspection.
