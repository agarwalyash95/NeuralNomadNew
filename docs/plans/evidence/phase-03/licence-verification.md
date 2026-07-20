# Phase 3 Licence Verification

## GODL-India — now VERIFIED (was [UNKNOWN]/fetch-blocked in the master plan)

- Source fetched: `https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf`
  (200 OK via a browser User-Agent; the bare WebFetch tool call to
  `data.gov.in/government-open-data-license-india` still 403s — the site blocks the
  fetch-tool's default UA, not general access). Full extracted text at
  `docs/plans/evidence/phase-03/godl-license-text.txt`.
- Identity: Government Open Data License – India (GODL-India), notified by the Ministry
  of Electronics and Information Technology, Gazette of India, Part I-Section 1,
  F.No. 8(2)/2013-EG-I, dated **10 February 2017** (published 13 February 2017),
  signed R.K. Sudhanshu, Jt. Secy. and Group Coordinator (e-Governance). Implements the
  2012 National Data Sharing and Accessibility Policy (NDSAP).
- **Grant (§3):** "a worldwide, royalty-free, non-exclusive license to use, adapt,
  publish (...original, or...adapted and/or derivative forms), translate, display, add
  value, and create derivative works (including products and services), for all lawful
  commercial and non-commercial purposes, and for the duration of existence of such
  rights over the data."
  - Commercial use: **permitted**.
  - Redistribution / derivative works / adaptation: **permitted**.
  - Storage/normalization into our own schema: covered under "use"/"adaptation"/
    "value-addition" — no clause restricts normalized storage.
- **Conditions (§4):** attribution required (provider, source, licence, plus DOI/URL/URI
  — template in §5 of the licence); no false endorsement; no warranty from the data
  provider; no guarantee of continued updates.
- **Exemptions (§6):** personal information; non-shareable/sensitive data; names/crests/
  logos/official symbols; other-IP-protected data (patents/trademarks); military
  insignia; identity documents; RTI-exempt info. **None of these apply** to LGD district
  codes, tourism/monument lists, or other open administrative datasets Phase 3/6 use.
- **Termination (§7):** rights end automatically on breach; reinstated on cure within 30
  days or by provider's express reinstatement.
- Conclusion: matches the master plan's own "asserted" default exactly
  (`§5`: "Asserted: royalty-free, commercial OK, attribution required"). The plan's
  `data.gov.in` row and `§18` "Verify before code beyond P0" bullet are updated to mark
  GODL as **[VERIFIED]** rather than unknown.

## LGD (Local Government Directory, `lgdirectory.gov.in`) — reachable, licence inferred

- `https://lgdirectory.gov.in/` returns 200 (NIC-hosted, same Digital India/MeitY
  ecosystem as `data.gov.in`). No separate licence page was found distinct from GODL;
  LGD is treated as GODL-covered by inference (same publisher class, same open-data
  programme), **not independently confirmed**. Each `SourceRegistry` row for
  district/LGD data still requires `licence_verified_at` to be set at the specific
  dataset's import time per the master plan's own rule (§5: "Approved-for-import only
  when its row says so AND its Phase 3 licence checklist item is checked at import
  time") — this note does not skip that per-row check, it only removes the umbrella
  [UNKNOWN] blocker.

## OTD Delhi (GTFS) — remains [UNKNOWN], out of Phase 3 scope

- Not fetched in this session. The master plan places OTD/GTFS entirely in **V2/T4
  scope** (§9.3, §14 Phase 3 "Out of scope: ... GTFS (V2)"), so it does not gate Phase 3.
  Left flagged for whichever phase first needs Delhi transit GTFS.

## RapidAPI provider ToS — unchanged, out of Phase 3 scope

- Still [UNKNOWN] per §5; irrelevant to Phase 3 (no live-provider panel sampling is
  built in this phase — that is P5's `TravelPriceObservation` panel, explicitly gated on
  ToS review separately).
