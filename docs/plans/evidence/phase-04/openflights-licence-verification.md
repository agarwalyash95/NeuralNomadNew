# Phase 4 Licence Verification — OpenFlights (new source)

## Source

`https://openflights.org/data.php` (fetched 2026-07-19, cleaned HTML saved at
`openflights-licence-text.txt`), cross-referenced against the GitHub mirror
(`github.com/jpatokal/openflights`) used to actually download `routes.dat` and
`airlines.dat`.

## Licence

> "The OpenFlights Airport, Airline, Plane and Route Databases are made available
> under the Open Database License. Any rights in individual contents of the database
> are licensed under the Database Contents License. In short, these mean that you are
> welcome to use the data as you wish, if and only if you both acknowledge the source
> and license any derived works made available to the public with a free license as
> well."

- **Commercial use:** permitted ("welcome to use the data as you wish").
- **Redistribution:** permitted, **share-alike** — a *publicly redistributed*
  derivative database must carry a compatible free licence. This application does not
  redistribute the raw or lightly-transformed database publicly; it consumes the data
  internally to power route search. Treated the same way the master plan's own OSM row
  treats ODbL: provenance-tagged, attributed, not commingled with differently-licensed
  fields.
- **Attribution:** required. `SourceRegistry.attribution_text` records:
  "Route/airline data from OpenFlights.org / Airline Route Mapper, ODbL."
- **Storage:** normalized route facts (source/destination code, airline, duration) are
  stored; no raw file is committed to the repository.

## Critical honesty finding: route data is stale since June 2014

> "Warning: The third-party that OpenFlights uses for route data ceased providing
> updates in June 2014. The current data is of historical value only."

This is the same class of finding C1/C2 exist to prevent — using this data as if it
were a live/current schedule would be dishonest. Consequence for the importer
(`import_openflights_routes.py`):

- Every `AirportRoute` row created from this source gets `provenance_tier="derived"`
  (never `"authoritative"` or `"verified"`), `confidence` capped well below 1.0, and
  `service_class_meta` carries an explicit `{"source": "openflights", "snapshot_year":
  2014, "staleness_note": "route existence only, not a current schedule"}` marker.
- `route_graph.py`'s search output must never claim a stale-sourced edge is a
  "verified" or "live" option — the existing price/provenance ladder (C1-honesty
  precedent) already treats anything short of a live provider hit as an estimate; this
  phase's route facts slot into the same discipline.

## Airport data (used only for airline matching, not new Airport rows)

Airport data on the same page is separately sourced from OurAirports/DAFIF (public
domain) — already an approved §5 source. This phase does not create new `Airport`
rows from OpenFlights; it only uses `airlines.dat` to create `Airline` rows and
`routes.dat` to create `AirportRoute` rows **where both endpoint IATA codes already
match an existing `Airport` row** (no new airports created).

## Conclusion

OpenFlights is added to the master plan §5 data-source matrix as a new row:
ODbL, `[VERIFIED]` 2026-07-19, usable for route facts with mandatory staleness
labelling. `SourceRegistry` row: `slug="openflights"`, `active=True`.
