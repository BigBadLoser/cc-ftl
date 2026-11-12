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

## A second skeleton: the ore spine (`stationFlowSpine.ts`)

Built as a quick go / no-go on whether these pieces can make a station that looks designed: the mining "ore spine" from
the mocks, generated from the real mining program (grammar `stationFlowSpine`, experimental). A 3-wide haul street runs
tip to tip through the ring and out past the hull; works halls and warehouses line it at one depth a side; the harbour
rooms fill the band's depth at each end with a dock on each row's end outside the hull (airlocks face north and south:
the fit-out never turns one east); machine rooms on a gated north spoke; messes and medbay on a south spoke. The shared
pieces (lattice ring and band, rooms lining a street, the last checks) moved to `stationFlowKit.ts`; the trading wheel's
output is unchanged by that (same hashes).

One structural alternative to a bigger ring exists here: a room its spoke has no frontage for carries on along the haul
street's rows. Without it two small machine rooms grew the whole ring from radius 32 to 40.

Mining seeds 1-6: radius 32 on seed 1 (dense, 2,075 floor tiles, no filler), 36-40 on the others with 3-10 filler strips
and large voids; one 2x2 wall block on seeds 2 and 5; seed 2 took three attempts ("weapons do not fit"). No ore cages yet.

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

## The planner (in progress)

After review (the handoff's author and the user): the two layout functions above are hard-coded station designs, the
flow drives nothing, and the lattice had become the whole architectural vocabulary. The redirect: **no more
station-specific layout functions**; a compositional grammar in which flows change the architecture through data and
one flow supports structural variation; design intent and proportions as first-class constraints; visual quality as a
continuous gate (silhouette and department sheets before construction detail); the finished station validated. The
lattice and the region compiler stay as techniques, not as the vocabulary. If the planner cannot produce an intended
structure, the limitation is named, not worked round with another fixed layout.

**Step 0 (done): checks on the finished station** (`stationFlowChecks.ts`), applied to every flow grammar: content
parity, the hull check, regions in one piece, every room reachable, controlled departments behind exactly one gate.
Both hard-coded layouts fail them (the wheel: a split hall, and its gate sits on the court's edge where the fit-out's
archway pass opens it; the spine: missing beds and guns). A gate must stand between two halls to survive the fit-out.

**The model** (`src/sim/shipgen/flow/`):

- **Flow** (data, `src/content/stationFlows.ts`): departments (the roles they take, access open or controlled, the
  places they may take, docks, customs) and preferences between them (near, far), plus intent (the landmark department,
  the court).
- **Vocabulary.** One structural element does the work of street, wing and spine: an **arm**, a straight street from the
  court outward in one of four directions, with a reach (short of the ring, to the ring, or out through the hull as a
  wing) and frontage on both sides in three sections (inside the ring, the band's depth, beyond the hull). Round it: the
  **court**, the **ring** with its **band** (lattice strips, placed by department round an anchor direction), **gates**
  (customs at a wing's foot, the guard gate of a controlled arm), **docks** (on a wing's flanks or tip, wherever an
  airlock may face), and **voids** (inboard ground nothing is built on).
- **Planning.** Every way of giving the arm departments a direction and a section is enumerated, filtered by the flow's
  hard rules (a controlled department has its arm to itself, docks need hull), sized from the program, built, and
  scored: the flow's preferences, the proportion rules (a landmark that breaks the hull, streets lined not bare, the
  ring no bigger than its contents, no four-fold sameness), size. Candidates are grouped by structure (which arms run
  out, where the gated arm is, how the market stands); the seed picks among the good structures, so one flow gives
  several skeletons.
- **Limits named up front:** arms are axis-aligned (four directions); no inner ring, no hub of halls, no diagonal
  elements yet. The faceted-bazaar and greenhouse-hub mocks are outside this vocabulary until those operations exist.

**Order of work:** massing first (departments on the grid, rooms by the street-lining rule, no furniture) rendered
through the original views beside the legacy generator and the mocks, for the user's eye; then the plan class written
natively, layout-time validation, the fit-out and the finished-station checks; structural edits on failure.

**The test:** trading flows A, B and C come out as different structures from the same code, each with variation by
seed, every one passing the finished-station checks, and the user judges the silhouettes.

### Massing pass: first result (trading station, seed 1)

Code: `src/sim/shipgen/flow/` (types, departments, arms, band, planner), flows in `src/content/stationFlows.ts`, sheets
from `node tools/shipgen/flowSheets.js`. Unfurnished; not yet a registered grammar.

What it does:

- Flows A, B and C give different structures from the same code, three each: wings (harbour, freight, secure), a gated
  secure street, freight inside or out. Departments read as blocks.
- Filler (shops) sizes to the frontage left; band rooms the band cannot hold (cabins) line a street; a room too long
  for its street turns its short side to it; the last room of a row runs up to the ring wall.
- Walls: 7 of 9 structures have no solid 2x2 block and pass the hull check before any thinning. Two lattice rules did
  most of it (`stripsOf`): a *tongue* (a strip tile with the ring on one side and another strip or room straight
  across) goes to the neighbour, and a *sliver* (a strip run under three wide beside a wing's room) joins that room.
  Before them the bare lattice had 12 blocks at every radius.

What is wrong with it:

- **They are hoops.** Built share of the area inside the hull: planner 66 to 83%, legacy 89%, mocks 85 and 96%.
- Cause 1: 20 one-strip cabins on a single-loaded band need R 36 by themselves, and the rest of the program fills
  about half of what that ring encloses.
- Cause 2: the only way to put rooms inside the ring is along four radial streets. A radius is the scarce dimension
  (24 tiles at R 36, less the court); the quadrants between the streets stay empty. Five machine rooms behind a gate
  need R 44 on a radial street; two 15x9 warehouses inside need R 44 too.
- The mocks fill the quadrants with department blocks. That element does not exist here yet.

Missing vocabulary, in order of what it would buy: a **quarter block** (a department compound filling the quadrant
between two streets, entered from one of them, gated when controlled); a **lane** (a street off a street, the same arm
code in a shifted frame) to build it from; rooms on the ring's inner side (a double-loaded ring).

### The kit: independent skeleton choices (the direction since the massing pass)

The user's framing, adopted: not N station types but a few independent choices that multiply, each a part that works
without knowing which others were picked. One order on one grid: outline, streets, features that claim ground (wings,
corner rooms), then the band, then the ring's inner side, then whatever spills.

| Axis | Options built | Where |
|---|---|---|
| Outline | stepped disc; square with cut corners | `site(R, pad, outline)` in `stationFlowKit.ts` |
| Streets | cross (4), tee (3), spine (2, straight through) | `LAYOUTS` in `flow/planner.ts` |
| Corners | one room per cut corner, true diagonal hull | `flow/corners.ts` |
| Ring | rooms on its inner side as well as the band | `flow/inner.ts` |
| Extensions | wings (docks, freight, a gated machinery annex) | `flow/arms.ts` |
| Departments | which goes where, from the flow | `content/stationFlows.ts` |

`Kit { outline, streets }` is passed to `planFlow`; `node tools/shipgen/flowSheets.js --flow <id>` draws the grid
(outlines down, street patterns across).

Two findings that changed the picture:

- **The ring's inner side is frontage.** Rooms line its flats and take one tread each on its stair, the far wall carrying
  the riser on (`inner.ts`). The band's overflow goes there first. The same program then fits R 32 to 36 instead of 36
  to 44, and built share goes from 66-83% to 86-93% on the structures that use wings (mocks: 85 and 96%).
- **A true diagonal is clean when one room owns it.** A one-tile stair only builds thick wall where another wall meets
  it. A cut corner as a single room (its dividers on lattice lines, meeting the hull on the flats) has a 45 degree hull
  and no wall block at any size.

Still wrong: disc + spine is a hoop (a spine wants an oblong outline, not built); square interiors keep empty yards
between the streets; nothing here has been through the fit-out yet.

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
