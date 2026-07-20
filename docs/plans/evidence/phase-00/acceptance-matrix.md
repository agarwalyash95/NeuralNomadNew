# Phase 00 Acceptance Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Baseline JSON committed | Passed | `baseline.json` |
| Performance baseline recorded | Passed | Nearby-hub timing recorded; no-route limitation documented |
| C1 fabricated-price/default-route fix | Passed | Targeted checks and grep gate |
| C2 train/bus honesty fix | Passed | Implementer and reviewer provider checks |
| H1 resolver NameError fix | Passed | Metro-context targeted check |
| H2 selector frequency fix | Passed | Candidate-local frequency source and scenario regression |
| H5 place-ID ownership guard | Passed | Guard review and compile/check |
| C3 key-safe URL writes | Passed | Code diff and security grep |
| Scrub dry run | Passed | `dry-run-output.txt` |
| Real scrub leaves no `key=` URLs | Passed | `after-row-counts.json` |
| Poison-signature count reported | Passed | 0 matches, `data-quality-report.json` |
| Owner key rotation | Condition | Owner-only action remains documented; code/data leak path is closed |
| Django check clean | Passed | Implementer and reviewer reruns |
| No paid API in validation | Passed | Mock-isolated validation only |
| No poisoned rows deleted | Passed | 123 rows before/after |
