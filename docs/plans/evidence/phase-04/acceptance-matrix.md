# Phase 04 Acceptance Matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| Route-model extensions (distance_km/frequency/operating_days/service_class_meta/provenance/confidence/freshness/is_active) | Passed | migration `0015_phase4_route_graph`, `_RouteFactsMixin` on AirportRoute/TrainRoute/BusRoute |
| `HubTransferLink` model created | Passed | migration `0015_phase4_route_graph`; adapted population strategy (same-city pairs, not metro areas — MetroArea table is empty) |
| `backfill_station_intelligence` incremental upsert (H7) | Passed, live-demonstrated twice | see §16 — process killed mid-run twice; both times the atomic transaction rolled back with **zero row-count change**, proving "mid-run kill leaves prior service areas intact" directly, not just by code review |
| Route-fact backfill (real data, not fabricated) | Passed | 3,485 `TrainRoute` rows (datameet trains.json, CC0), 1,916 `AirportRoute` rows (OpenFlights, ODbL, honestly marked stale-since-2014); both importers idempotent on re-run |
| `reference/services/route_graph.py` (V1 algorithm) | Passed | tested against real data (Mumbai→Bikaner via BDTS→BKN) and the full S1-S14 scenario suite |
| `journey_resolver` thin-adapter refactor | Passed | legacy path preserved verbatim under new dispatch; `PLANNER_ROUTE_GRAPH_ENABLED` (new, default False) + `PLANNER_MULTIMODAL_SHADOW_MODE` (existing, now meaningful) |
| Scenario fixtures S1–S14 | Passed (13/14 via pytest; S11 via shadow script) | `test_route_graph_scenarios.py`, 13 passed; S11 via `scripts/phase4_shadow_comparison.py` |
| Shadow-mode comparison shows no regression on real S11 workspace | Passed — after a real fix | **First run found a genuine regression** (route_graph path lost the train option entirely for Kolkata→Gangtok); root-caused to route_graph requiring a literal scheduled edge with no geometric fallback; fixed by adding a `geo.nearest()`-based fallback mirroring the legacy `_nearest_hubs` behavior; re-verified: mode-set and recommended-mode now identical between legacy and route_graph paths |
| Report 5 (missing hub mappings) | Passed | `audit_reference_data --full-reports` |
| Report 6 (missing road connectors, G6-G9) | Wired, honestly near-zero | G6-G9 curated fixtures are explicit Phase 6 scope; report states this rather than fabricating a placeholder list |
| Report 7 (top-200 pairs baseline) | **[PENDING — see completion note]** | population-based demand proxy (top-20 cities, ~190 pairs), computed live via `route_graph.search()` |
| No paid API calls | Passed | GeoNames/OurAirports/Wikidata/datameet/OpenFlights are all free; zero Google calls |
| Migration additive only | Passed | `0015_phase4_route_graph` — 1 new table, 8 new columns × 3 route tables, no drops |
| Standard validation trio clean | Passed | `check`, `makemigrations --check`, `compileall` all clean |
| `check_layer_boundaries` clean | Passed | zero violations; `route_graph.py` confirmed to never import `apps.planner` |
| A real, separate performance bug found and fixed | N/A (not a formal criterion, recorded for completeness) | (1) missing bounding-box pre-filter in the airport-service-area loop (~107M unfiltered haversine calls); (2) floating-point exact-equality comparison in the new incremental-upsert diff, spuriously flagging nearly every row as "changed" on every run — both found via direct `pg_stat_activity` investigation of an unexpectedly slow run, not assumed |
