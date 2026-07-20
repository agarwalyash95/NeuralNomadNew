# Phase 02 Acceptance Matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| Shared geo utility | Passed | `test_geo.py`, wrapper assertion |
| Three compatibility delegations | Passed | canonical, explore, planner wrappers |
| Four approved fields | Passed | migration/model inspection |
| Eight composite indexes | Passed | physical schema inventory |
| Railway coverage >=95% | Passed | 96.5154% |
| Placeholder cities quarantined from publishability | Passed | 270 remain, 0 publishable |
| Publishability on candidate/explore/hub paths | Passed | explicit callers + compatibility alias |
| Reports 1/2/9 per state | Passed | post-audit and detailed metrics |
| Full non-publishable reason list | Passed | 586 deterministic rows |
| EXPLAIN index use | Passed | default Bitmap Index Scan |
| Nearby-hub p95 <=50 ms | Passed | 2.917 ms on the Phase 0-comparable service-area workload |
| Dry-run/apply idempotence | Passed | zero post-apply proposals |
| No paid API | Passed | call counters and gated Google preview |
| No row creation/deletion | Passed | command/migration review |
