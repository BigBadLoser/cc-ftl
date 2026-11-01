# Station generator v2: department-driven ring stations (proposal)

Status: proposal plus a prototype on branch `stationgen2/proto`, for trading ring stations only. The current generator is
described in [STATIONGEN.md](STATIONGEN.md) (PR #234) and the earlier flow proposal in [STATIONFLOWS.md](STATIONFLOWS.md).
This document replaces STATIONFLOWS.md section 8 (its implementation plan). Sections 1 to 6 of STATIONFLOWS.md remain
useful as vocabulary.

## 1. Diagnosis: why the current ring generator can't be tuned into shape

The current pipeline for round stations (`stationRings.ts`, `stationBands.ts`, `stationCourts.ts`, plus the post-passes
in `generate.ts finishLayout`) works corridor-first:

1. **Ring radii come from summed room areas** (`bandRadius`). After that, the room list is cut into band segments by
   share of arc (`cutBand`). A segment gets whatever arc its share works out to, so rooms stretch or thin to fill the
   circle. This is why rooms come out narrow and stretched. The later fixes (`spared` lounges, cabin stores, `flex`
   bands, pinned floors) each patch one symptom.
2. **Rectangles are pushed along the circle's normal until they land** (`fitAlong`, `sweep`, `rim`, `bastions`). A
   machine room ends up wherever the first free spot is, either inside the gap between the rings or outside the outer
   band. This is why machine rooms look glued on and the space between rings is ragged.
3. **The space between the rings is left over, not planned.** `gapR` sizes it with a 1.7× slack factor. Whatever the
   rectangles don't fill becomes either black void or a court (`courtyards`), and the court's shape is the shape of the
   leftover.
4. **Departments are decided after geometry is fixed** (`planRing` picks a quadrant for each department; `zoned` uses a
   hill climb over list order; `swapRoles` swaps roles after the structure is drawn; `doorSlide` moves doors). Each pass
   fixes a symptom without changing the cause.
5. **Variety is narrow.** On every trading concentric station, the docks sit north and south, the 3-wide concourse runs
   north to south, there are four cardinal spokes, and the secure core is east or west. Seeds 1 to 6 are hard to tell
   apart (see the baseline sheets in the prototype report).

Conclusion: the room-level work in #234 is good and mostly independent of the structure (see section 5). The
structure-level work should not be carried forward.

## 2. The proposed architecture, challenged

The seven steps in the brief are right as a list of concerns. Built as seven strict sequential stages, they would bring
back the problem we have now, because later stages would have to repair earlier ones. Changes:

- **Steps 1 to 3 form one loop, not a chain.** Department sizes decide the geometry, and the geometry decides which
  department can go where. So the functional plan produces **area budgets and requirements** (floor needed, required
  modules, min/max room sizes, access, needs), not fixed rectangles. The structure is chosen **together with** the
  department-to-slot assignment by a small discrete search. Ring radii are then *solved* from the area each zone has to
  hold, instead of being guessed and then filled.
- **On a ring, circulation largely *is* the structure.** Ring corridors and spokes are both. Step 4 is therefore not a
  post-pass. Public circulation is part of the structure template. Inside each department, circulation (an internal
  hall, the one guarded entrance, a service back door) is part of how that department lays itself out (step 5).
  Afterwards we only *verify* it (dock-to-department depth, chokepoints, second routes).
- **Subdivision is demand-driven, with absorbers.** Every room has a min, target and max size. Departments are sized
  to their demand. Any small surplus goes to rooms that are meant to soak it up (stores, a lobby, a lounge, a plant
  room), not into stretching other rooms. A room never grows past its max. If the surplus is too big, the zone shrinks
  instead.
- **Use the geometry of the circle; don't fight it.** On a raster circle, the rim is flat near the four cardinal
  points and stair-stepped near the diagonals. A rectangle sitting tangent to the ring fits well near a cardinal point
  and wastes its corners near a diagonal. Each sector therefore has a **rect yield** (the area of the best inscribed
  rectangle divided by the sector's area). Departments that need rectangles (machine rooms, warehouses, hangars) prefer
  high-yield sectors. Wedge-tolerant departments (cabins, shops, offices, messes, stores) take the rest. Wedge rooms
  are not a defect for soft rooms; real ring habitats are built that way.
- **Courts are designed parcels.** A court is a department with a chosen shape: a central rotunda, an annular garden
  ring, or a plaza filling one sector. The current approach, where a court is "whatever pocket is left", goes away.
- **Select candidates before fit-out.** Fit-out costs about 300 ms. The structure and parcel stages are cheap, so we
  generate N candidate layouts, check hard constraints, score soft qualities on the parcel map, and fit out only the
  best one (falling back to the next if fit-out fails). Room-level scoring runs only on the finalist.
- **Fewer post-passes.** The new path turns off `swapRoles` (it breaks departments), `courtyards` (courts are planned)
  and `doorSlide` (doors are placed with the room's design in mind). `pruneDoors` gets each department's access rules.
  `thinWalls` should do nothing, because the emitter writes single walls.

## 3. The model

### 3.1 Functional plan (`FunctionalPlan`)

Built from today's `planStation` output (we keep the plan logic: crew, guns, reactors, power). Rooms are regrouped into
**facilities** with sizing ranges instead of fixed `w × h`:

| Field | Meaning |
|---|---|
| `role`, `mods` | as `RoomSpec` |
| `area` | `{ min, target, max }` floor tiles, from the modules' footprints, use tiles and the room type's profile |
| `shape` | `rect` (must be a rectangle: designs, aisles, bays), `soft` (wedge OK), `open` (court) |
| `minSide` | narrowest allowed side (no 2-wide rooms unless the type says so) |
| `dept` | the department it belongs to |

### 3.2 Department graph (`DeptGraph`)

Nodes are departments. Each one has: facilities, total area, `access` (`open`, `clustered` or `controlled`), `needs`
(`dockFace`, `centre`, `rect`, `largeFloor`), and a **strategy** (`harbour`, `warehouse`, `cabins`, `storefront`,
`machine`, `office`, `court`). Edges are `adjacent`, `near` (walk distance), `entrance` (the department's door faces
the other one), `apart` (keep away), and `guarded`.

For trading, an archetype gives the graph, then transforms vary it (STATIONFLOWS.md §4 transforms, applied before
geometry and checked):

- **harbour** = docks + customs post (the controlled chokepoint between the airlocks and public space) + dock office;
  `freight` is `adjacent` to it and its warehouse door opens onto the harbour hall. Customs, docks and freight form one
  walled precinct.
- **market**: shops and messes; `adjacent` to the court or rotunda, `near` to the harbour.
- **habitation**: cabins, lounge, medbay; `apart` from the harbour and from the machine department.
- **engineering**: reactors, shields, AI core; `controlled`; `rect`; reached through one guard post (the armoury).
- **defence**: gun bays (roof turrets need clear roof, not a hull face). They go into engineering, or mirrored into
  `rect` sectors.
- **command**: the bridge and office, by the harbour (civil) or at the centre (military, later).

### 3.3 Geometry: the polar parcel map

A station is a disc. The structure template has these parameters:

- **ring count** (1 to 3) and each ring corridor's width;
- **zone depths** between rings, solved from the area of the departments assigned to each zone;
- **spoke set**: cardinal spokes only, any non-empty subset. Diagonal raster corridors look broken, so none;
- **centre**: rotunda, command hub, or an open hub with spokes;
- **court**: none, central rotunda, annular court ring, or one sector plaza;
- **harbour faces**: any of N/S/W/E (E is allowed but weighted lower: STATIONFLOWS.md notes); one or two harbours.

Rasterisation: every tile centre in the hull disc maps to (r, θ), then to a zone (between two ring corridors) and a
sector (between two spokes). Spokes, zones and sectors split the disc into **slots**. Every tile inside the hull is
owned by exactly one of corridor, a department parcel, court, or **deliberate open space**. A wheel's open quarters are a
silhouette choice made at template time, with clean edges. Nothing else is left over.

**Assignment** is a small search: departments over slots (about six departments over 8 to 16 slots). Hard filters come
first (needs, face, rect yield, area). Then it scores adjacency, entrance, `apart`, and depth from the harbour. It runs
in a few milliseconds.

### 3.4 Department strategies (subdivision)

Each strategy receives its parcel (a set of tiles, with the corridor sides and the spoke sides marked) and returns
rooms, interior walls, doors and its internal circulation:

- **harbour:** airlock bays on the hull face, a harbour hall behind them, customs as the single door from the hall to
  public circulation, a freight door from the hall to the warehouse.
- **warehouse:** one large rectangular hold (aisles plan) in the best inscribed rectangle. The curved leftovers become
  the cargo office or stores, inside the department's walls.
- **machine:** rectangles sized by their design (`designSize`) and packed in a row along the parcel's flat side. A
  service corridor links them to the guard post. Leftovers become a plant or store room, or widen the service corridor.
- **cabins:** radial slicing. One-bed cabins about 2 to 3 tiles wide along the corridor face. Every room has a fixed
  target size; surplus goes to a lounge or stores in the middle of the run, never to wider cabins.
- **storefront:** repeated shop units of equal width on the public face (tulou rhythm), plus a back-of-house store.
- **court:** an open parcel, fitted out by the existing court recipes (without the landmarks for now: no new
  decoration until layout quality improves).

### 3.5 Emitting to the existing pipeline

The parcel map is written to the existing `Builder` canvas the same way `bandRooms` already stamps cell sets: each
room's floor is stamped as one part, walls go between different owners, and doors are set explicitly. From there on,
`finishLayout` runs unchanged (fit-out, room plans, designs, validation), with these station-v2 options: no
`swapRoles`, no `courtyards`, department-aware `pruneDoors`. Ships don't use this path, and the ship byte-identity
tests pin that.

## 4. Measurement: hard constraints, soft qualities, per-type expectations

A new bench tool (`tools/shipgen/stationBench.ts`) works on any branch. It reads only `GenResult`, so it can compare
`main`, #234 and v2 on the same seeds.

- **Hard (pass/fail, every seed counted):** generation succeeded, and in how many attempts (a failure counts against
  the average and is never dropped). Also: every room reachable, every module usable (use tiles reachable: `usage.ts`),
  required facilities present, power, docks, the station rules (STATION_MAX, hull width), and every `rect` room actually
  rectangular.
- **Structural:**
  - void tiles inside the hull's convex outline, and slivers (rooms under `minSide`);
  - per-room aspect ratio and its stretch past the room's `max`;
  - rim protrusions (room parts that stick out past the hull radius);
  - the share of each department's rooms that sit in one connected cluster.
- **Circulation:**
  - dock-to-department walk depth (space syntax);
  - whether every route into a controlled department passes its guard post;
  - second routes between public departments.
- **Room quality, per type:** each room type has an expectation profile (a density band, required clearances, whether
  symmetry counts, an aspect band, open floor wanted). A sparse room scores badly when its type expects density, and a
  dense court scores badly. This replaces the single 0–100 `roomQuality` score as the headline number. The old score is
  still reported.
- **Diversity:** a layout signature (template parameters, the department-to-angle map, harbour faces, court type) plus a
  coarse occupancy-grid distance between seeds, reported within a station type.
- **Performance:** milliseconds per station (median and p95) and attempts per station.
- **Sheets:** the same seeds side by side (before | after), at the same scale, labelled.

## 5. Extraction plan for PR #234

`shipgen-stations-1` is kept unchanged as the reference branch. Each extraction is a small PR off `main`. Its ship
impact is stated, and ship sheets go with it whenever ships change.

| PR | Contents (from #234) | Depends on | Ship impact |
|---|---|---|---|
| **E1: room use rules and tools** | `useTiles.ts`, `rooms/usage.ts`, use rules enforced at placement, `usageReport`, `labels`, `roomSheet`, `rooms.js`, `audit*`, `failReport`, the `draw.ts`/`cli.js` additions | — | Yes: beds block walking and use tiles are kept, on ships too. Ship sheets attached |
| **E2: room plans** | berths (barracks rows, cabins off a hallway: `cabins.ts`, `quarters.ts`), aisles for holds and farms (`aisles.ts`, `plans.ts`), `companions.ts` (ore bins) | E1 | Yes: civilian quarters become cabins |
| **E3: room designs** | `frame.ts`, `designs.ts`, `rooms/quality.ts` (designs score with it), working-piece islands (`islands.ts`, `islandSets.ts`) | E1 | Small: designs also run on ships |
| **E4: lamps** | the `lights` sprite family, floor light / cage lamp / light mast content and placement | — | Lamps on ships too |
| **Bench** (new, not from #234) | `stationBench.ts` (section 4) | E1 (usage), E3 (quality) | None |

**Kept only on the reference branch (superseded by v2):**

- `stationRings/Bands/Courts/Departments/Districts` structure changes, `roleSwap`, `zoned`, `doorSlide`, bastions;
- court promenades, zones, landmarks and **court floors** (the new `floor` grid field and save v72): these wait until
  courts are planned parcels;
- `stationQuality` adjacency (the bench replaces it);
- `lamp_concepts.py` (concept scratch);
- `decor.py` and `landmarks.py` art (no decoration until layout quality improves);
- the `space` ranges per kind are worth keeping as data. v2 reads them as a room-size target, not as stretch.

**Open question for the user:** which art has been approved (the lamps in particular, and the decor and landmarks
sheets)? Only approved art goes into E4.

## 6. PR sequence

1. **This proposal plus the v2 prototype** (branch `stationgen2/proto`, built on #234's head so it can reuse the room
   fit-out now; rebased onto `main` once E1 to E3 land). The prototype covers trading stations at `station` size, with
   concentric and wheel templates. Deliverable: before/after sheets on fixed seeds and the bench report over 60 seeds.
   **Stop here for review.**
2. E1, E2, E3 in parallel with the prototype (independent of it).
3. Bench to `main`.
4. v2 for trading at all sizes, then archetype transforms (a second harbour, a market on the concourse, a clustered
   medbay).
5. Only after v2 is shown to beat #234 on trading: research and farming rings, then military (archetype "keep"), mining
   and pirate (non-ring families need a different geometry stage, but the same plan, graph, strategy, bench and
   selection).
6. Retire the old ring code path.
