# Recovery Runbook (Phase 9, master plan §14 P9)

Three real, already-proven procedures, consolidated here rather than left scattered across per-phase evidence docs.

## 1. Restore from a `pg_dump` backup

Every phase from Phase 3 onward that migrated schema or mutated data at scale took a `pg_dump` first (`docs/plans/evidence/phase-0{3,4,6,7}/backup-confirmation.md`) — all four record the **exact same** procedure, confirmed byte-identical across all four docs:

**Capture** (already-proven pattern, `pg_dump.exe` at `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`):
```bash
pg_dump -h localhost -p 5433 -U postgres -F c -f <output-file>.dump neuralnomad
```
Pass the password non-interactively via `PGPASSWORD` (read from Django's own settings, never typed/printed in a shell history — see any `backup-confirmation.md` for the exact scratch-file-piped pattern used).

**Verify the dump is restorable before trusting it**:
```bash
pg_restore --list <output-file>.dump
```
A healthy dump lists several hundred TOC entries (788-931 across the four real backups taken this initiative) with no error.

**Restore** (destructive — only run this deliberately, with the target database confirmed):
```bash
pg_restore -h localhost -p 5433 -U postgres -d neuralnomad --clean --if-exists <output-file>.dump
```
`--clean --if-exists` drops existing objects before recreating them, so this is safe to run against a database that already has (possibly-corrupted) data in it — it doesn't require a pre-emptied target.

## 2. Re-run a stalled or partial import batch

Every real importer in this codebase (`import_geonames`, `import_ourairports`, `import_wikidata_crossids`, `import_openflights_routes`, `import_datameet_train_routes`, `import_osm_places`, `populate_hub_transfer_links`) writes exactly one `apps.reference.models.ImportBatch` row per run, linked to a `SourceRelease` (`backend/apps/reference/models.py`, Phase 3 machinery) with `dry_run`, `status` (`running`/`completed`/`failed`/`dry_run`), `created_count`/`updated_count`/`skipped_count`/`conflicted_count`/`quarantined_count`.

**To check for a stalled run**: query for `ImportBatch` rows stuck at `status="running"` with an old `started_at` and no `finished_at` — a genuine crash mid-run, not a currently-executing process. (Phase 4's H7 note: a process appearing absent via `pgrep` is not proof of completion on its own — always check the actual row/DB state, not just process presence.)

**To re-run**: every importer is idempotent (upsert-based) and `--dry-run` by default — re-running the exact same command is always safe:
```bash
python manage.py <importer_name> --dry-run --json   # confirm what it would do first
python manage.py <importer_name> --apply --json     # then apply
```
A stalled batch's own `ImportBatch` row is not auto-cleaned; it simply stays `status="running"` as a historical record — the next real run creates a new row rather than resuming the old one, since every importer re-derives its target state from the source data on each run.

## 3. Rebuild the embeddings backlog

`apps.reference.services.embeddings.compute_embeddings_backlog(batch_size_per_category=10)` (relocated from `apps.knowledge` in Phase 7, same real function) is the one real writer of `EntityEmbedding` rows — popularity-ordered, re-embeds only when `source_text_hash` shows the underlying text actually changed (so re-running never wastes an API call on an unchanged row).

**Already wired as a Celery beat task** (`apps.reference.tasks.compute_embeddings_backlog`, every 15 minutes, `backend/config/settings/base.py`'s `CELERY_BEAT_SCHEDULE`) — under normal operation this catches up on its own. Manual intervention is only needed if the backlog needs to catch up faster than the 15-minute cadence allows (e.g. after a large bulk import of new places):

```bash
python manage.py shell -c "
from apps.reference.services.embeddings import compute_embeddings_backlog
print(compute_embeddings_backlog(batch_size_per_category=100))
"
```
Raise `batch_size_per_category` for a faster catch-up pass; each category (hotel/restaurant/attraction/activity) is processed independently, popularity-ordered, so the most-relevant rows embed first regardless of batch size chosen.

**To verify the pgvector HNSW index survived intact** after any of the above (relevant after a restore specifically): `entity_embedding_hnsw` should still exist and be defined exactly as:
```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'entity_embedding_hnsw';
-- expect: CREATE INDEX entity_embedding_hnsw ON public.knowledge_entityembedding
--         USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')
```
(Table name is still `knowledge_entityembedding` — Phase 7's state-only move relocated the Python class to `apps.reference`, not the table.)
