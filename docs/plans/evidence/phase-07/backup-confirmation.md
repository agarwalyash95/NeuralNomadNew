# Phase 7 Pre-Work Backup Confirmation

- Date: 2026-07-20 (Asia/Calcutta)
- Method: `pg_dump` (PostgreSQL 18 client, custom format `-F c`), same direct approach used in Phases 3/4/6.
- Output: `neuralnomad_pre_phase7_20260720_093109.dump`, 30,799,622 bytes, stored outside the repository (session scratchpad, not committed).
- Target database: `neuralnomad` (PostgreSQL 18, `localhost:5433`).
- Integrity check: `pg_restore --list` succeeded, 931 TOC entries.
- Restore path: `pg_restore -h localhost -p 5433 -U postgres -d neuralnomad --clean --if-exists <dump-file>`.

## Pre-migration baseline (all 13 `apps.knowledge` tables)

Recorded directly against the live DB immediately after the dump, before any schema change:

| Table | Rows |
|---|---|
| `knowledge_distanceedge` | 830 |
| `knowledge_entityembedding` | 42 |
| `knowledge_localtip` | 87 |
| `knowledge_placeinsight` | 1,129 |
| `knowledge_planinsightdismissal` | 24 |
| `knowledge_crowdpattern` | 0 |
| `knowledge_emergencycontact` | 0 |
| `knowledge_entityinteractionlog` | 0 |
| `knowledge_event` | 0 |
| `knowledge_neighbourhood` | 0 |
| `knowledge_placerelationship` | 0 |
| `knowledge_safetyadvisory` | 0 |
| `knowledge_transitoutcomelog` | 0 |

The 8 models slated for real deletion this phase all have **zero rows** — an additional real-data confirmation (beyond the grep-based zero-consumer check) that they are genuinely unused, not merely under-referenced in code.

## HNSW index baseline (must be byte-identical after the state-only move)

```sql
CREATE INDEX entity_embedding_hnsw ON public.knowledge_entityembedding USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')
```
