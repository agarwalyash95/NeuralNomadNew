# Phase 03 Acceptance Matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| G1/G2 (countries/states) | Passed (already 100%, untouched) | Phase 2 baseline unchanged |
| G4 major cities carry `geonameid` (target >=90%) | Partial | 4,169/15,475 cities overall (27.1%); this phase did not isolate the G4 (>=100k pop) subset specifically — measured, not certified against the exact G4 denominator |
| G3 districts | Measured, not targeted | 667 districts from GeoNames ADM2 only; LGD crosswalk (`lgd_code`) explicitly out of scope this phase |
| G5 minor towns | Measured, not targeted | bounded new-city creation (PPLC/PPLA/PPLA2 only) by design; 553,796 generic populated places intentionally not auto-created |
| Zero canonical rows deleted | Passed | row-count table, `final_row_counts.json` — City +80 (creation only), Airport/RailwayStation unchanged |
| Duplicate report (3) live | Passed | `audit_reference_data --json` `3_duplicate_candidates`; 6 pairs found post-import |
| Alias coverage report (4) live | Passed | `4_missing_aliases`; missing-alias count dropped 15,123 -> 13,498 |
| Unresolved-mapping report (8) live | Passed | `8_unresolved_mappings`; cities with no geonameid/map dropped 15,395 -> 11,306 |
| PostGIS checkpoint recorded + decision logged | Passed | `postgis_checkpoint.json`; recommendation "defer", all 4 triggers false |
| Licence checklist executed | Passed | GeoNames/OurAirports/Wikidata already verified; GODL-India verified this session; OTD Delhi correctly inactive |
| Reconciliation never auto-merges canonical rows | Passed | code review — ambiguous matches always stage/flag, never merge; `merge_reference_entities` is the only merge path and is human-gated |
| Every importer dry-run by default | Passed | command review — all four new commands default to `--dry-run` |
| Idempotent / resumable imports | Passed with one noted bound | `import_ourairports` fully idempotent; `import_geonames` idempotent on geonameid/District, bounded (8/city/run) on alias saturation by design |
| No paid API call | Passed | GeoNames/OurAirports/Wikidata are all free; zero Google calls |
| Migration additive only | Passed | `0014_phase3_source_registry` — 7 new tables, 9 new nullable columns, no drops |
| Standard validation trio clean | Passed | `check`, `makemigrations --check`, `compileall` all clean |
| `check_layer_boundaries` clean | Passed | zero violations, same 2 documented Phase 1 exceptions |
