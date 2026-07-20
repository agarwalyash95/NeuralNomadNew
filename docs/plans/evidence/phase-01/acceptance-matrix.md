# Phase 01 Acceptance Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Common provenance module exists | Passed | `apps/common/provenance.py` |
| Planner compatibility re-export retained | Passed | Parity command |
| Output behavior byte-compatible | Passed | Explicit verified/suggested equality checks |
| Reference/knowledge provenance imports migrated | Passed | Boundary search/checker |
| Station-intelligence planner distance import removed | Passed | Boundary search/checker |
| Unauthorized planner imports | Passed | 6 before; 0 violations after |
| Transitional geocoding debt explicit | Passed | Exactly 2 allowlisted imports |
| Boundary command passes | Passed | `validation-output.txt` |
| Dependency direction documented | Passed | D-004 and module docstrings |
| No migration/data mutation | Passed | Migration plan |
| Django/reference regression checks | Passed | Standard checks + 3 scenarios |
