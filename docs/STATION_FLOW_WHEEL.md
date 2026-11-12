# Station flow wheel: design note

Branch `stationgen/architecture-integration`, November 2026. Experimental: a new station grammar, `stationFlow`, beside the
legacy wheel. No station kind uses it by default. This note records what was decided, what was measured and what is not
built, so the work can be picked up without the conversation it came from.

Read with: [STATION_ARCHITECTURE_HANDOFF.md](STATION_ARCHITECTURE_HANDOFF.md) (the brief this work answers),
[STATIONFLOWS.md](STATIONFLOWS.md) (the flow model), [LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md) and
[STATIONGEN.md](STATIONGEN.md) (the legacy generator, what was tried and dropped). `STATIONGEN2.md` is superseded (user).

## Where it stands

- The new stage generates a trading station from the real plan, hands it to the existing fit-out unchanged, and the result
  is furnished and valid: seeds 1-8 on the first attempt with no problems.
- It is one hard-coded arrangement. The flow is not yet an input, and every station comes out the same shape.
- **The look is not accepted.** User verdict on the first furnished sheets: it looks poor, as the legacy wheel did. The
  checks below pass; visual quality is the open problem and everything after this note has to serve it.

## Why the legacy wheel fails (baseline)

Ten forced-wheel stations (trading 1-4, farming 1-2, mining 1-2, trading outposts 1-2):

- **One skeleton for everything:** ring, four axis spokes, centre court, dock banks north and south. A mining station has
  the shape of a trading station. The defects below follow from fitting rooms into that fixed structure.
- Big rooms stand as islands in empty quadrants; departments are scattered round the band; band rooms are shaped by the
  arc (up to 8 rooms under 3 tiles wide a station); roles are spread (seven mess rooms on one farming station).
- 10-22 solid 2x2 wall blocks a station; none passes the V2 hull check (`stationHullIntegrity.ts`).
- The handoff's audit: 3-12 rooms a station with no direct public access; both mining stations have a split public network.
- **Where the wall blocks come from** (`tools/shipgen/slabSources.js`): the structure stage writes 81-145 a station, the
  `thinWalls` finishing pass removes about 85%, and the survivors sit where a straight band divider meets the stair-stepped
  ring wall near a diagonal. No clean-up pass can fix those without moving the divider.
- **The plan holds about 30 rooms** for a trading station (docks, office, armoury, five cabin blocks, two messes, medbay,
  seven holds, shields, reactors, core, gun bays). The 21 shops and three courts on legacy sheets are not in the plan: the
  structure stage adds them as filler. Courts take 500-800 floor tiles a station.

## Decisions

### 1. Replace the front half, keep the back half

The new stage fills a `Builder` exactly as the legacy wheel does; `finishLayout` (wall thinning, door pruning, cabins,
fit-out, validation) runs unchanged. The seam: one canvas chunk a room, its `RoomSpec` in `b.chunkSpecs` and its role in
`b.chunkRoles`, then one chunk of walls and doors. `stationGen.ts` treats a `stationFlow` profile as `placed` (no role swaps).

Do not fix legacy defects one at a time (the handoff's first instruction, and the user's): they are symptoms of the fixed
skeleton.

### 2. One wall writer (`stationRegions.ts`)

Layout code paints which region owns each tile and never draws a wall. `RegionGrid.compile` writes every wall by one rule:
**a tile becomes wall when it touches (8 ways) a region that outranks its own.**

- Space outranks everything, so a room's outer wall is the hull: no gap, no second layer, and floor never touches space.
- Halls outrank rooms, so a corridor keeps its painted width. Two halls are open to each other.
- Between two rooms the lower rank gives way, one tile thick.
- `SOLID` tiles are always wall: a margin (`street()`) that keeps a hall its width beside open space.
- Doors go on straight wall between a room and a region it may open onto (any hall by default). A `gate` forces a door
  between two halls: the single way through a solid line.
- `stranded()` lists floor that cannot be walked to. This matters more than it looks: the fit-out's `placeOne` refuses to
  place any solid module while a single floor tile is unreachable (`Layout.connected`), so one room without a door makes
  every airlock fail with "no airlock fits".

### 3. The lattice band (`stationFlowWheel.ts`)

The geometric fact behind the wall blocks: **a straight wall cannot meet a stair that steps one tile at a time without
making a 2x2 block**, whichever tile it lands on. A round hull on the tile grid has such stairs on its diagonals.

So the hull and the ring step `K = 4` tiles at a time, and the band between them is cut along that same lattice:

- Hull: tiles whose 4x4 cell centre lies inside the radius. Inboard floor: a cell is inboard when the cell `DEEP = 2`
  cells further out along its octant's axis is still hull, so every strip of the band is exactly two cells deep and the
  ring steps where the hull steps.
- The ring's own riser sits one tile nearer the axis than the lattice line; that column stays with the band and becomes
  the lower end of the divider, so a hull step's riser runs straight on down to the ring.
- Strips are K wide. A strip gives way on its side away from its face's axis (rank = distance from the axis), so every
  strip keeps 3 tiles of floor width.
- The two strips either side of an east, south or west axis are one double room. A strip with no ring frontage (the
  corner strips where two faces meet) folds into the strip beside it.
- Result: every band room is a rectangle with its own door onto the ring, all the way round, diagonals included.

Measured on a band of small rooms all round (`tools/shipgen/mocks/coarseTest.ts`):

| Outline | 2x2 wall blocks |
|---|---|
| Plain circle, equal-angle cuts | 15 |
| Faceted 16-gon, equal-angle cuts | 26 |
| 2-tile steps, equal-angle cuts | 16 |
| 3-tile steps, equal-angle cuts | 0 |
| 4-tile lattice, cut along the lattice | 0, hull check passes, no room under 3 wide |

A 3-tile lattice is smoother (cabins 2 wide, which the user accepts) but its corner case is unsolved: with the band three
cells deep it leaves two wall blocks at one corner. The 4-tile lattice was chosen as the one proven clean. The user finds the
lattice "avoids diagonals too hard" in the corners; keeping the corner cells helped, and at radius 40 the corners are
still boxy.

### 4. The program sets the size

`flowWheel` tries radii from 8 cells up and keeps the smallest that places every room; a cabin or two over double up
before the ring grows a step. Trading stations come out at radius 40 tiles (legacy: about 41).

### 5. Flows are the model for topology

[STATIONFLOWS.md](STATIONFLOWS.md) revision 2 (reviewed by the user): departments with an access type (open, clustered,
controlled) and typed links. Three trading flows are drawn (`tools/shipgen/flows.js`) and approved: A harbour and market,
B market street, C two harbours (the warehouse with its own dock). Decisions taken with them: the plan must size the
market (shops from docks and crew, one court); a controlled department is one entrance, structurally (the sim has no
locks); gun bays need no hull face on stations.

### 6. The plan class is the contract; the wall writer feeds it

`StationArchitecturePlan` (the handoff's class) is a data model and an audit, not a planner: regions with department,
access class and requirement, portals, named routes, and checks (access from the public network, rectangular cores,
contiguity, hull, route width and jogs). Its own wall compiler marks every non-floor tile beside floor as wall, so layout
code must leave the gaps itself and slabs are only reported afterwards; that is why the rank rule above is the wall writer.

The split decided (user: "I guess so"):

1. The new stage writes the plan natively (real departments, access classes and requirements, a portal for every door and
   gate, named routes for ring, concourse and streets), instead of importing tiles afterwards. Today a generated station
   imports with no routes, no anchors and no requirements, and every access class defaulted from the room's role.
2. `RegionGrid` stays the construction step; the plan's compile must reproduce the same tiles (a consistency check).
3. Two extensions: a corridor can be restricted; a "guarded" check that every way into a restricted cluster passes its gate.
4. Its edit types (`structuralFeedback`: add public frontage, move or deepen bay, connect public circulation, revise wall
   boundary) are the feedback loop's vocabulary.

### 7. The CP3 / CP4 band code (`stationNeighborhoods.ts`)

Read in full by a subagent. Nothing in it works unchanged on a rectangular slot. Reuse as is: `cabinProgram`,
`reserveGallery`. Keep the idea and rewrite: department sizing (area plus frontage), the greedy two-orientation core
packer, partitioning leftover floor to the nearest core, reserving a straight gallery before packing. Drop: `ringPortal`,
`constructProgramBayFootprint`, `buildNeighborhoodBand` (its plan, preflight, commit pattern is worth copying). Leave the
file alone until the flow-driven version exists, then decide on deletion. CP4 `programBay` output is worse than legacy
(lumpy outline, docks stretched to 20 tiles).

## Results (trading station, seeds 1-8)

| | Legacy (seed 1) | Flow wheel |
|---|---|---|
| First attempt, no problems | yes | 8 of 8 |
| 2x2 wall blocks | 18 | 0 |
| V2 hull check | fails | passes |
| Rooms with direct public access | 59 of 65 | all (45-48) |
| Rooms under 3 wide | 3 | 1-3 |
| Floor / court floor | 2,944 / 511 | 2,715-2,857 / 167-255 |
| Corridor floor | 492 | about 800 |
| Beds / airlocks | 20 / 5 | 20 / 5 |
| Time | about 1.0 s | 0.5-0.75 s |

## Known problems

- **Looks poor** (above). Boxy, cross-shaped, the same skeleton on every seed.
- The flow is in the code, not an input: freight east, secure west, shops round the court are written into the layout.
- Corners: two-cell steps on the diagonals and oversized L-shaped corner cabins.
- Bigger band rooms that cross a hull step come out stepped; they should keep to the flats.
- Departments are mixed in the band (cabins, gun bays, mess, plant alternate).
- Gun bays are in the band, not inside the secure core.
- The two gates end up as open archways (the fit-out's `openArchways`), not doors.
- The audit reports one `invalid-region`: the "streets" hall is one region in three disconnected pieces.
- Outposts come out too big (radius 36, many spare strips); they want flow B.
- The only response to a layout that does not fit is a bigger radius.
- Not run: anything in the game (crew paths, docking, security). Lint and typecheck errors in the handoff's test files
  (5) are parked (user).

## Next

Make the flow the input, so the layout code knows no particular station:

1. Program to departments: floor and frontage needs, access type, needs (hull face, large floor); shops and court sized.
2. Flows as data: the three trading flows as drawn.
3. Skeletons that expose slots: each piece of circulation offers slots with a frontage, a depth, public or gated,
   hull-facing or not.
4. Assignment by a small search: hard rules from the flow, preferences scored, street lengths and radius solved from
   what was assigned.
5. Realise and furnish (exists), writing the plan class natively.
6. Validate the built tiles against the flow; on failure a structural edit and a retry.

**The test:** flow A reproduces roughly today's station, and flows B and C come out by changing data only. If either needs
new layout code, the model is wrong. Keep the layer small; abstraction ahead of results is what sank the earlier attempts.

## Tried and set aside

- **Hand-drawn mocks** (`tools/shipgen/mocks/`, two rounds). They gave the user's preferences and the wall rule, and no
  evidence about the generator. Kept as reference for per-kind skeletons: mining "ore spine", farming "greenhouse hub",
  trading "harbour wheel" and "faceted bazaar".
- **Faceted hull** (16-gon, as on the mocks: liked by the user). Clean only while no divider touches a 45-degree face, so
  each of those faces needs one long room. Octagon outlines were tried twice before and dropped (STATIONGEN.md).
- **Voids across the band's diagonals:** jagged.
- **Big soft rooms across the diagonals:** long curved slabs with small usable cores.

## What the user wants (as stated in this work)

Round stations first; the other station shapes later. The kind shows in the structure. Landmark halls, asymmetry, arms
and docks, interior spaces. Arms are inhabited wings, never a room on a stick; a warehouse with its own dock is good.
Voids where they make sense. No solid 2x2 wall blocks anywhere. Departments readable on the sheets. Sheets through the
original views (`labels.ts`, `views.ts`), never an HTML page.

## Tools

```bash
# Sheets: labelled, silhouette / structure / departments, metrics.json. Entries: kind[:size]:seed[:grammar].
node tools/shipgen/mocks/render.js --only none --out <dir> \
  --legacy "station.trading:1,station.trading:1:stationFlow,station.trading:outpost:1"
node tools/shipgen/mocks/render.js --legacy "" --only lattice4,lattice4s,coarse3   # band experiments and mocks
node tools/shipgen/flows.js --out <dir>      # the trading flow diagrams (SVG)
node tools/shipgen/slabSources.js            # where the legacy wheel's wall blocks come from
```

On the labelled views: red frames are 2x2 wall blocks, cyan each room's largest rectangle, yellow a room under 3 wide.
