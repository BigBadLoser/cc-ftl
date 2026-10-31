# Station flows (proposal, revision 2)

Not built. This revision follows the user's review of revision 1: flows hold topology only, departments choose their own
access and layout, flow edges reuse the corridors the ring already has, variety comes from a few archetypes plus
transformations, and every layout is validated. Method background: "Generator techniques" in
[LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md). Current generator: [STATIONGEN.md](STATIONGEN.md).

## 1. Model: topology and geometry apart

A **flow** is a graph of departments. It says what exists, what connects, who may enter and what wants to be near what.
It says nothing about rings, sections or compass points. A **layout** (geometry) is a separate step that maps the flow
onto a ring structure and is scored against it.

### Departments

| Field | Meaning |
|---|---|
| `id`, `kind` | e.g. `harbour`, `habitation`, `freight`, `market`, `secure`, `admin` |
| `rooms` | room specs from the station plan (`planStation`), grouped; sizes come from the plan, not from the arc |
| `access` | `open` (rooms door straight onto a ring corridor or court), `clustered` (rooms share an internal hall with one or two entrances), `controlled` (one entrance, a guard post or checkpoint on it) |
| `layout` | the layout strategy (section 4): `storefront`, `cabins`, `warehouse`, `machine`, `office`, `plain` |
| `needs` | geometric needs the layout must meet: `dockFace` (docks on the outer hull), `centre`, `largeFloor` (warehouse, refinery), `window` (an observation gallery) |

### Edges

An edge is a requirement on circulation, not a corridor to build: `walk(a, b)` (reachable within the station's normal
corridors), `adjacent(a, b)` (share a wall or a short corridor run), `entrance(a, b)` (a's entrance opens towards b),
`guarded(a)` (every route into a passes its checkpoint), `service(a, b)` (a second, back route, may be partial).

### Hard constraints and preferences

- **Hard** (a layout that breaks one is repaired or rejected): every room reachable; required facilities present
  (docks, bridge, life support per the plan); `needs`; `guarded` routes; the existing station rules (everything inside
  `STATION_MAX`, the 3-tile hull width rule, clear roof space round roof-mounted guns).
- **Preferences** (scored, traded off): `adjacent`, `entrance`, district clustering, symmetry, room proportions, short
  walks from the docks to public departments, depth of private ones.

A few spatial facts stay in the vocabulary as needs, not positions: docks sit on the outer hull, the rotunda and the
command heart take the centre. The flow names the need, the layout finds where it can be met.

Checked and dropped (revision 2 had them wrong): **gun bays do not need a hull face.** Weapons and point defence are
roof-mounted (`roofMounted` in `layout.ts`); the only rule is clear roof space round them, so a gun bay can stand anywhere,
inner rings included. **Airlocks may face east.** The sim and the art support all four rotations (the airlock sheet has
r0-r3, docking in `vehicles/geometry.ts` works on any hull side); "never east" in `stationDocks.ts` is a convention
carried over from ships, where the east end is the stern with the engines. Stations have no engines, so docks on any face
are allowed unless the user wants the camera-facing side kept clear of docked shuttles.

## 2. Access types

- **Open:** rooms door straight onto a ring corridor or a court (shops, the mess, cabins). Cheapest, and what most
  departments should be. This is today's band.
- **Clustered:** a short internal hall inside the department's arc, parallel to the ring, rooms between it and the hull
  or the inner edge; one or two entrances. For departments with many small rooms (a medbay with treatment rooms, offices).
- **Controlled:** one entrance with a guard post or checkpoint room on it (secure core, armoury, command heart, brig).
  Enforced structurally: other doors are not drawn, and door pruning may not open new ones.

Conflict: the sim has no door access rules (locked doors, faction-only doors), so "controlled" is a single entrance plus
a guard, not a lock. Locks would be sim work, outside the generator.

## 3. Circulation reuse

Flow edges map onto the corridors the ring already has: ring corridors, spokes, the concourse, court promenades. The
generator adds circulation only where an edge cannot be met: a department's internal hall (clustered), a short link,
or a partial service route (a passage behind two or three departments, not a full ring). `walk` edges are checked by
path length on the existing graph; `service` edges count as met when a second route exists, however short.

## 4. Archetypes and transformations

One or two archetypes per station kind, then conditional transformations. Trading:

**Archetype "harbour and market":** `harbour` (controlled entrance: customs; needs `dockFace`; with `admin`, the harbour
office), `market` (open, storefront; adjacent to the rotunda or a court), `freight` (open, warehouse; walk-near the
harbour), `habitation` (open, cabins; depth: away from the harbour), `secure` (controlled, machine), `centre`
(the rotunda).

**Transformations** (each a rule: condition, change, chance):

| Transformation | Condition | Change |
|---|---|---|
| Split harbour | docks above the face limit | a second `harbour` on another dock face, each with its own customs |
| Market on the concourse | no court, or a small station | `market` becomes storefronts along the concourse instead of round a court |
| Expand freight | crates above a threshold | `freight` takes a second section; warehouses merged |
| Restricted wing | security 0.3 or more | a `controlled` wing (brig, evidence store) off the harbour |
| Clustered medbay | crew above a threshold | medbay becomes `clustered` with treatment rooms |
| Set pieces | per the injection table (revision 1) | cantina, chapel, observation gallery |

Transformations run on the graph and are checked (graph validation, section 6) before any geometry.

Pushback: transformations can produce graphs the ring cannot honour (three departments that all want to touch the
harbour, on a ring where a section has two ring neighbours and one radial neighbour). Keep `adjacent` a preference unless
a layout family can always satisfy it, and keep the number of transformations small enough to test each one.

## 5. Geometry-aware department layouts

The layout assigns departments to sections of the ring (a small search: about six departments over four to eight
sections, scored on the preferences, hard constraints filtered first), then each department lays out its own arc by its
strategy:

- **storefront:** narrow, deep segments with their doors (or archways) on the concourse or court side; repeated widths
  (a tulou's identical units).
- **cabins:** today's cabin bands, along the ring corridor, the mess in the middle of the run.
- **warehouse:** one large contiguous floor per department, merged from the plan's crate rooms, laid out by the aisles
  plan; a cargo office at its door.
- **machine:** rectangular rooms for designs (reactor, shields, AI core, gun bays), set inside the arc; the leftovers at
  the curved edges become a plant room, store or service passage instead of being glued on. Gun bays need no hull face,
  so they need not sit on the rim at all.
- **office:** small rectangular rooms off a short hall (clustered).
- **plain:** today's band segments.

**Boundaries:** a department's outer edge follows the ring (stepped where the circle is), while partitions between its
rooms are straight. Rooms that need rectangles (machines, warehouses' aisles) are rectangles inside the department;
the stepped margin goes to circulation, stores or service, never to a machine room.

## 6. Validation

**Graph checks** (before geometry): every department reachable; required facilities present; no `controlled` department
on the only route between two others (it would block the station).

**Layout checks** (after geometry, in the quality report, per seed):

- connectivity: every room reachable, `guarded` routes really pass their checkpoint;
- required facilities and `needs` met;
- accessibility: public departments within a walk budget of the docks, private ones deeper (space syntax depth);
- department adjacency: share of `adjacent` and `entrance` preferences met;
- floor use: the share of floor inside the hull that is rooms or circulation in use, and the share of each room's
  floor its job uses.

Pushback on floor-area utilisation as a target: optimising it drives towards cramming, the opposite of the airy trading
stations asked for. Report it, and flag only waste (unreachable or unused pockets, slivers), not low density.

**Visual comparison:** fixed seed sheets (current system against the flow system, same seeds, every round station
kind), sent for review at each phase. The room score's weights are still provisional; calibrating them against the
user's judgment (a rated sheet of rooms) would make every number above more trustworthy.

## 7. Conflicts with the existing generator

| Existing part | Conflict | Resolution |
|---|---|---|
| `planStation` | flat room lists by role; crates split into rooms of 6 | add a grouping step that turns the plan into departments; warehouses merge crate rooms |
| `concentricStation`, `wheelStation` | ring radii come from room areas per band; bands are filled in list order | radii from departments' floor needs; bands filled per department arc |
| `cutBand` / `bandRooms` | segments sized by share of arc, so rooms stretch to fill the arc (the cargo slivers); no internal halls | department cutter: rooms keep their planned floor, the remainder goes to circulation, stores or the next department; a hall option for clustered departments |
| `fitAlong` rim rooms | rectangles pushed beyond the band, the "glued on" look; guns put there for a hull face they do not need | machine strategy places guns and machine rooms inside department arcs; the rim keeps only what wants it (docks, a gallery) |
| `dockBanks` | docks on north, south and west faces only | any face (a station has no stern); keep the rule only if the user wants the camera-facing side clear |
| `courtyards` | runs after the structure and turns any enclosed pocket into a court, adding band rooms the plan never listed | courts become flow nodes (market, drill hall, garden); the court pass fills only what the flow assigns |
| `swapRoles` | swaps rooms across the whole station, breaking departments | swaps only within a department, or off for flow stations |
| `pruneDoors` | keeps one door per room (two for big ones) and may keep a door that breaks a controlled entrance | respects department access: storefronts keep their fronts, controlled departments keep only their entrance |
| `openArchways` | opens doors between open rooms | allowed inside open and storefront departments; never on a controlled entrance |
| Reseeding on failure | more hard constraints mean more failed attempts | repair first (move a department, resize an arc), reseed last |
| Shared with ships | bands, fit-out and validators also build ships | flows are stations only; shared code changes keep ships byte-identical (tests pin them) |
| `stationQuality` `NEAR` | 12 tiles of walk is too short for big rooms | measure near from door to door, scaled by room size, or between department edges |

## 8. Implementation plan (incremental)

Each phase ends with seed sheets (current against new) and the quality report; nothing replaces the current path until
a phase beats it.

1. **Baseline and validation.** Freeze a seed set for round stations; add the layout checks (section 6) to the quality
   report and run them on today's generator. No behaviour change.
2. **Departments from the plan (trading only).** Types for departments and flows; the trading archetype; grouping the
   plan into departments; graph checks; tests. The existing band filler orders rooms by department (contiguous runs)
   instead of by pull. Small visual change, a check that the model holds.
3. **Department-to-section assignment** on concentric and wheel trading stations: sections from the spokes, the search,
   hard constraints, preferences, room swaps limited to a department.
4. **Department layout strategies:** warehouse and machine first (they fix the cargo slivers and the glued-on rim
   rooms), then storefront and cabins, then clustered halls.
5. **Access and circulation:** controlled entrances, department-aware door pruning and archways, partial service routes.
6. **Transformations and set pieces** for trading.
7. **Military** (archetype "keep"), then research, farming and mining; courts as flow nodes.

Phases 1-3 are small; phase 4 is the bulk of the work and where the look changes.
