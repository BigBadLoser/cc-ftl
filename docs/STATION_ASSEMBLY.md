# Station assembly

One modular system for station layouts, meant to replace the station grammars one at a time (issue #460). A recipe
(data) says what a station is composed of and how its parts stand to each other; one assembler builds every recipe from
the same few elements; one wall writer turns the result into tiles.

**State:** assembled and fitted out, not in the game. The assembler produces a floor plan (walls, floor, doors,
beams) that passes its own hard checks, and `assembleStation` (`assembly/station.ts`) hands it to the shared fit-out
(`fitShell` in `generate.ts`, the back half of `finishLayout`), which furnishes, validates and measures it as it does
the station grammars' structures. It is not a registered grammar, so nothing in the game spawns one; the layout lab
and the generator CLI load one by layout name (`assembly.<family>`, below). The station grammars (`stationGrammars.ts` and the files round it) are untouched and stay until a recipe replaces
them.

## Where things are

| What | Where |
|---|---|
| Recipes (data) | `src/content/stationRecipes.ts` |
| Recipe types | `src/sim/shipgen/assembly/recipe.ts` |
| The assembler: candidates, roots, the hard checks | `assemble.ts`, `asm.ts` (placing and taking back), `branch.ts` (rules into branches), `finish.ts` (trim, braces, the room check) |
| Elements | `elements.ts` (corridor, block, single room), `quay.ts` (the harbour), `ring.ts` (ring or arc with its band) |
| Frames and ports | `model.ts` |
| The wall writer | `regions.ts` (`RegionGrid`) |
| The lattice ring and band | `lattice.ts`, `band.ts`, `inner.ts`, `corners.ts` |
| The rooms a station is assembled from | `program.ts` (from `stationPlan.ts`), `quarters.ts` (cabins, barracks), `dept.ts` |
| Hull check | `hull.ts` |
| The hub inside a ring (the bazaar's market and spokes) | `hub.ts` |
| Fitting one out (the handoff to the shared fit-out) | `station.ts` (`assembleStation`), `fitShell` in `../generate.ts` |
| Sheets | `node tools/shipgen/assemblySheets.js [--seeds 1,2,3,4] [--out dir] [--versus]` |

`--program station.research:station` assembles a family's recipes for another kind and size than its own.

Sheets go through the shipgen views (silhouette, structure) plus a department view and a rooms view (the same picture
with each room named: MESS, REC, MED, B8 for a barracks of eight beds, C for a cabin), one row a recipe and one column a
seed. Nothing is filtered: a seed that cannot be assembled shows as a rejected panel with the reason.

## The model

Two layers. A recipe speaks only the first.

| Layer | Elements |
|---|---|
| Composition | Section (rooms on a street), Connection (a corridor, or a direct join), Void (space kept clear, as off a dock), Attachment (docks, cabins, beams) |
| Geometry | a block (a street with a row of rooms each side), a single room, a ring or arc with band strips |

- **Frames and ports.** Every element paints at a port's frame (a point and a heading) and returns its own ports: the
  end of its street, its flanks, a ring's rim at the axes, an arc's cut ends. Nothing names a coordinate.
- **Regions, not walls.** Elements paint which region owns each tile. `RegionGrid.compile` writes every wall by one
  rule: a tile is wall when it touches (8 ways) a region that outranks its own. Space outranks everything, halls outrank
  rooms, a later room outranks an earlier one. So a wall is one tile thick wherever two things meet, and no element
  draws a wall.
- **One procedure.** The assembler builds the root, then each rule's branches (an optional neck, then sections in
  series), then a ring root's own rooms. An element is tried at a port and taken back when it does not fit, stands
  nearer than `spacing` to something it is not joined to, leaves a single tile of space between two sections, or builds
  a solid 2x2 wall block. Then the next port is tried. There is no search beyond that.
- **Size comes from the rooms.** A block is laid out from its rooms by the shared lining code (`line`), so what it
  holds is what was drawn. A ring grows a lattice step at a time until its strips hold its rooms.

### Recipes

A recipe has a root, branch rules, and a few settings.

- Root: `trunk` (a corridor everything hangs off), `core` (no root: the first branch stands at the centre and the rest
  grow from the sections, a cluster), or `ring` (a ring or arc that takes some departments in its band; `outline` disc
  or square, `gap` cuts an arc, `inner` lines the ring's inner side too).
- A branch rule takes departments (each as its own branch, or together), names a host (trunk, a ring's rim by
  direction, an arc's tip, the end of another rule's branch, or any section already standing) and describes its
  sections: rooms in each, `rowDepth` for a slab of one depth, `cap` for a room across the far end, `cross` for a passage
  across it with a port on each flank. `gated` puts a gate at its foot. `docks` makes its first section the dock block,
  or with `quay` the harbour (below).
  `mix` deals rooms to sections across departments.
- Off-centre joins, for a scrapper's tree: `jog` on a rule bends its neck into a dogleg (it steps a few tiles sideways
  halfway along, either way as the seed has it), and `cross: 'any'` on a section puts its cross passage anywhere along
  the block instead of midway. Modules then stand off each other's centre lines.
- `quarters`: how the crew sleeps. Default: quarters rooms, cut into one-bed cabins where they stand. `'scatter'`: every
  bed a small cabin among the other sections' rooms. `{ barracks: [min, max], singles }`: shared rooms of that many
  beds in double bunks, with a few private cabins scattered.
- `braces`: the chance that a gap between two sections gets a beam (the game's open truss tile, `=`). A truss of two
  chords where the gap is long and there is room, one beam otherwise; none through the clear space off a dock.
  A beam touches hull at its two ends only: along its run at least two tiles stay open on either side, or it is not
  built.
- `hall` on a rule: its neck and its links are halls, not corridors. A hall is a room-sized piece of street the
  street behind runs into; the street beyond leaves it a few tiles to one side (`shift`), and each flank has a port
  for a wing. Host `{ on: 'flank' }` puts a branch on any flank along the street as the seed picks it, a hall's more
  often than a section's, less often straight across from a flank already taken (a cross is one arrangement, not the
  rule) and less often on a wing of the same rule. It is how a long street steps aside instead of running in one line.
- `cross: 'end'` on a section puts its passage after the last rooms, right before the end room: both rows run up to
  it, so a wing can carry another wing beside its end room with no notch. `cross: 'inner'` puts it partway down, on
  each flank whose row has a room either side of it; a row of one room runs through and has no passage. A list
  (`['end', 'inner']`) lets the seed pick for each section.
- On a section: `width` is its street's width (default 2; a main street 3), `cap` names the role of the room across
  its end, `far` the roles that stand at the far end of its rows.
- `spacing`: clear ground between sections that are not joined.

### Hard checks and preferences

Hard, or the candidate is rejected with the reason, and another is tried:

- Every room of the program stands as a region with floor in the compiled grid, counted by role; quarters by beds.
- Every dock has a berth with the space off it kept clear.
- A gated branch is joined by its gate alone; nothing stands within two tiles of it.
- Nothing is placed off the grid. No floor is stranded. No solid 2x2 wall block.
- A recipe that takes no part for a department the program has is rejected at once.

Preferences: where on the rim, pairs across a trunk, which port a section grows from. A cluster has no outline to hold
it together, so of eight candidates that stand the most compact is kept.

### The lattice ring

Hull and ring step four tiles at a time (`K`), and the ring steps where the hull steps, so the band between them cuts
into strips four wide and two cells deep. Every band room is one or more whole strips: straight walls all the way
round, diagonals included. Three rules in `stripsOf` keep it clean at every radius: a strip without ring frontage folds
into its neighbour; a tile with the ring on one side and another strip or room across from it goes to that one (a
tongue); a run under three wide beside a room that is not the band's joins that room, and one tile wide stays open.
Square outlines get one room a corner with a true 45-degree hull (`corners.ts`).

### The harbour

`quay` on the rule that takes the docks (`quay.ts`). The harbour is one open concourse along the station's outside.
An airlock is a unit of three by two tiles standing in the concourse against a wall, its hatch in the wall: part of
the hall, with no room and no door between a hatch and the concourse (the user's rule; walled-off dock rooms were
rejected). Behind the concourse, in the middle, customs: an open hall the quay runs into, with the harbour's only gate
on its far side, where the street leaves. The harbour's rooms stand along the quay's inner side and open onto it.
The ground off a wall with airlocks in it is kept clear (shuttles dock at airlocks, not ships: a berth is 4 by 5).

Three forms, all chosen by the user from mock sheets (`form`):

| Form | What it is |
|---|---|
| `quay` | the airlocks along the outer wall at an even pitch |
| `gatehouse` | the control room stands out in front of the quay, in the middle, the airlocks in a wing either side |
| `basin` | two arms of concourse run out from the quay's ends, the airlocks in their inner walls facing each other |

`shape`: `taper` (one room either side of customs, the rest on the street inland; stations that are not round) or
`block` (every room in one row along the quay, the harbour one rectangle; round stations, the user's call).
`face` (the bazaar ring; picked by the user from mock sheet 4, "fitted to the face"): on a ring's rim the harbour's
rooms are the band of the flat face it stands on and no longer than it, customs in the band at the axis with its gate
onto the ring, the quay along the face outside the hull. It holds the rooms the face has length for (control, then
the armoury, then by size); the rest (`Built.left`) go to the ring's band beside it. A trade station has three
airlocks at outpost and station size and six at hub size (`assemblyDocks`), so the quay is no longer than the face.

An airlock may face any way, east included (the user's call; the old ring generator's "never east" rule is not
carried over). The old dock block (`docks` without
`quay`) is still in `elements.ts`; no recipe uses it.

Open: which station gets which form is set per recipe for the sheets, not rolled; customs is empty (no furniture);
rooms beside customs are stretched to the quay's length.

## The bazaar ring (trade stations): prototype

Reference: the faceted bazaar mock (`docs/refs/station-mocks/tradingB-*.png`). The user: "not necessarily the
placement of any specific department, but to me that has a decent trading identity". Recipe family `bazaar`
(`stationRecipes.ts`), on the trade station's program; sheets with `--family bazaar`.

- `hub.ts`: what stands inside the ring. A market at the centre, a square with round corners like the outline (the
  user: "might as well make the center round too", then, of the full circle tried first, "we could do a rounded
  square like the outline"): a square court, the stalls round it one depth all the way, so the rim is straight along
  the court's sides and an arc about each of its corners, and a road round the lot. A spoke runs on each axis from the
  court through the road to the ring. The first room of each line on a spoke runs in to the road where it is deep
  enough to reach past the straight; at such a room's far wall the road widens to a flat, or that wall would run into
  a step and build a thick wall. The
  north and south spokes are gated at both ends and carry the machinery as a slab of one depth either side; the east
  and west spokes (the main axis) carry rows of cabins, as many of the quarters as fit, and what does not fit goes to
  the ring's band (`Built.left`). The cabins on those spokes are one pool laid at one size (the user: "the cabins
  being different sizes on either side of the street is odd, and the size distribution could probably be more
  equal"): the widest that lets the lanes hold them all, the same number either side of a street where the count
  allows, a lane's spare length shared along its row, its other rooms (the shop) at its head by the market. An odd
  count leaves one lane a cabin short, so its cabins come out wider than those across the street. The ground between the spokes stays open.
- A `market` department: stalls in the trade station's assembly program (`assemblyAlso`; racks and a console as
  placeholder fittings, no stall module exists).
- The harbour on one side of the main axis (shape `face`, above), the warehouses as a wing on the other.
- Outline: a square cut to eight even sides (`cut: 'octagon'`) with the corners rounded (`round`; the user: "if
  we're not gonna subdivide the corners why aren't we just using circular corners"). The corners are true arcs, hull
  and ring both, cut tile by tile (filling the lattice's steps was not round enough). The stepped ring and the
  straight-cut octagon were tried and dropped ("so terrible"). The four corner faces are one room each:
  the common rooms take them, biggest first and opposite each other (the mess with its pantry as the cell at one end),
  and a face with none is a garden gallery.
- The band by sectors round a hub: cabins on the north and south faces, guns either side of the east and west faces,
  common rooms on the diagonals. No rooms on the ring's inner side.

The user's verdicts so far: first prototype "really ugly", the centre "square and not as nicely cohesive" (then an
octagon, a circle, now the rounded square), the harbour's join to the stepped ring "so bad" (now `face`). Then, asked for: machinery behind gates,
cabins off the ring's inner side, the octagon's gardens, the ragged band. Open: on the stepped ring the band is still
stepped and now mostly garden (the octagon is the cleaner of the two); no dock on the warehouse wing; the ring is
about 107x90 at station size, and some seeds come out one ring size bigger (about 120x98). The full circle was
dropped because its stalls came out as small wedges, the curved walls taking much of the floor.

## Seeing one furnished: the fit-out and the layout lab

`assembleStation(def, id, size, seed, defs, recipe)` returns what `generateStation` does (a template, its rooms, its
problems). The assembly's regions are the rooms: each keeps the role and the planned modules it was given, so the
fit-out needs no builder or canvas in between.

- Layout lab (`npm run dev`, `/tools/layout/`): Import, Generated station, Layout `assembly.bazaar` (every recipe is
  listed after the kind's own grammars, for any kind and size). By URL:
  `/tools/layout/?station=station.trading&size=station&layout=assembly.bazaar&seed=2`. The preview pane is the game's
  renderer, and the checks panel runs the game's validators.
- CLI: `node tools/shipgen/cli.js station.trading --size station --layout assembly.bazaar --count 4`.
- What the handoff changed in the assembly: an airlock unit on a quay is three by three (the airlock module's own
  floor, its walkway innermost) and its hatch becomes plain hull at the handoff, since the module is the door; airlocks
  may face any way there (`airlocksAnyWay`; the arranger's hulls keep theirs off the stern); a gun bay in a ring's band
  keeps its long side on the hull (`stripsFor`), or its second mount has no hull to stand against; the dock count the
  station rules ask for is the assembly's own (`docksOf`).

## Ring stations: what was decided, and where they stand

The record: the user's own messages in this work (the review that redirected it, the kit, the inventory, the assembly
model), and `docs/STATION_FLOW_WHEEL.md` on the branch `stationgen/architecture-integration`. Read both before
changing the ring recipes; do not redesign from scratch.

- The compound (an enclosed ring or arc joined to a substantial rectangular industrial section) is one of the two
  cases the assembly model was proved on. The user's verdict on its first sheets: "it's convincing. my issues aren't
  necessarily with the chosen architecture." The issues named: the harbour ugly and the same everywhere (since
  replaced by the quay forms); on the arcs with the works on a tip, the secure department "feels just stuck on after";
  many very small walkways that make a layout feel as if it could fall apart.
- Standing rules from the same discussion: one modular system, simple, not a general solver; structural parts declare
  their dimensions and attachment points and rooms fit into intentional bays (do not fill the middle by dividing
  whatever space is left; unused space may stay open on purpose); coherent composition over variation for its own
  sake; a recipe describes relationships and preferences, never every room's position; weak outcomes shown, nothing
  filtered.
- Liked on the earlier mocks: arms as inhabited wings (never a room on a stick), a warehouse with its own dock, a
  faceted hull.
- The mocks themselves are in `docs/refs/station-mocks/` (see `docs/refs/README.md`): the mining ring with the ore
  spine through it, the faceted trading hull.

**Regressed since, not redesigned:** the rooms added to the program after that review (ore store, pod deck, workshop,
breaker shop, battery room) all went into the one works block, so it grew from about two thirds of the ring's width
to the ring's full width and reads as a tail. The recipe was not rebalanced. Ring stations are parked at the user's
call; when they come back, start from that proportion, not from a new composition.

## The rooms

The assembly has its own station plan (`stationProgram` in `program.ts`), built from the kind's `StationDef` at a size
tier. The station grammars keep theirs (`planStation`), which goes when they do. Nothing here is taken from that one;
where `main` has something better or new (the arcade cabinet and game table, power-drawing grow beds) it is wired in.

- Rooms grow past what their contents need by the kind's spaciousness (`space` on the def: a navy depot and a pirate
  den are tight, a trade station roomy).
- Quarters are blocks of one-bed cabins (four beds a block), or, where the kind sets `barracks` (the mining station,
  the navy depot), barracks of 6 to 8 beds each (3 or 4 double bunks) with a few one-bed cabins beside them.
- Common rooms: one for every 12 crew. The first (two at hub size) is a mess with a galley and mess tables, one
  for every eight crew (a table seats four on its chairs, which come with it at fit-out); from station size up the
  next is a rec room with arcade cabinets and a game table (`withCommons`). With no rec room the game table stands in
  the mess. Each mess has a pantry (racks) beside it.
- A workshop on every station (two at hub size): the fabricator with racks and lockers, in the works.
- From station size up: a battery room behind the gate (a bank and a console), and a suit-up room by the docks
  (lockers and a bench). A pod deck has its own suit-up room beside it.
- The station chief's cabin stands by the bridge, in the harbour: a bed, a desk and chair, a locker (crews of six up).
- Kind rooms: laboratories on a research station (research modules, consoles, lockers), a breaker shop on mining
  stations and pirate dens (the scrapper, scrap cages, a pallet), drone bays on a navy depot (defence).
- An `annex` on a room is a small room of its own that stands against it and opens into it, never onto a hall: the
  mess's pantry, the ward's trauma room, the pod deck's suit-up room. In a row it is the next room, with its door in
  the wall they share, and a passage across the block never parts them. An end room's annex is cut from one end of
  it. In a ring's band it is the last strip of the room's run.
- Shield rooms and the core get floor round the machine on a station that is not tight. Gun bays keep the mount size.
- Reactors: the smallest tier the size allows that powers the station from one room of two; rooms of two at most.
- Crate rooms merge into warehouses of up to 24 crates.
- Medbays: one for every 20 crew; a large station has a clinic (a ward and a treatment room). From 16 crew the ward
  has a trauma room beside it: the recovery pod and a cot.
- Plant rooms: one for every reactor room, two at least.
- A pod deck where the tier has mining pods (`pods`: the mining station, 2 / 4 / 6 bays): one hangar, the bays in a row
  (two rows past four) with an aisle.
- An ore store with it: two ore bins a pod, a works room (not merged into the warehouses).
- Shuttle bays where the tier has them (`bays`: the navy depot). Farms on the agri station (`assemblyRooms`).

| Department | Rooms |
|---|---|
| harbour | control room, armoury, docks |
| habitation | quarters, common rooms that are not the mess or the rec room, medbays |
| commons | mess, rec room, courts |
| freight | warehouses |
| secure | reactors, shields, the AI core, plant rooms |
| defence | gun bays, point defence |
| works | refineries, farms, shuttle bays |

A room's `dept` overrides its role's department (`deptOf`). The mess and the rec room carry role `support`, tagged
`commons`.

The list was checked room for room against the experimental branch it came from (six kinds, three sizes, four seeds):
60 of 72 identical before the mess and rec room are dressed; the 12 agri stations have one more reactor room, because
a grow bed draws power on `main`.

## Results

Eight recipes on four seeds each (tree: the pirate hub's rooms, 30 to 32; compound: the mining station's, 28 or 29):
32 of 32 assemble, every room and bed stands, no solid 2x2 wall block, the hull check passes.
`stationRecipes.slow.test.ts` asserts it. Trees are 1,150 to 1,280 floor tiles against 1,270 to 1,420 for the old Tree,
which has 43 to 56 solid wall blocks.

### The spine (in progress)

`stationRecipes.spine`, on the mining station's rooms (`--family spine`, `--versus` for the old Spine as the first
row): the harbour at the head of a main street 3 wide, habitation with the commons and the guns along it, the
machinery behind a gate at the tail. Between the parts the street runs through a hall and steps to one side. Works
and freight are wings on stubs off the flanks along the street. The works wing is a line: the refineries, the ore
store, a passage (before the pod deck or partway down, as the seed has it), and the pod deck across its end. The
freight wing stands on a street flank or on that passage, off the works wing. The crew sleeps in barracks (the mining
station's default), so the body is short and thin against its 3-wide street. 24 of 24 assemble with every room standing.

Tried and dropped: ore cages (a rail with ore holds in a row and beam teeth between). They were sealed rooms of crates
off the ore's path from pod bay to store to refinery, and the part most often refused. The ore store replaces them.
A container yard on open truss by the docks is a possible outside feature, not built.

Open: the body is nearly all cabins; the mess does not face a hall; no open space is kept off the pod deck; seeds
differ little.

## Known limits

- **Not in the game.** `assembleStation` furnishes and validates one; registering a recipe as a grammar (so the game
  spawns it) is the step left. Only the bazaar has been taken through the fit-out and seen in the layout lab; the
  other families are untried there.
- **Barracks need a double bunk module** (a bed's footprint, two beds). There is none, so a barracks cannot be furnished
  as drawn.
- The mess and the rec room have no room recipe of their own (`support` furnishes as a mess), and medbays and plant
  rooms have none at all. The rooms added since are the same: planned with their modules, no room recipe (workshop,
  battery room, suit-up rooms, chief's cabin, pantry, trauma room, laboratory, breaker shop, drone bay).
- Rooms waiting on modules: a pantry's cold store, a workbench for the workshop, comms and sensor consoles (traffic
  control, ops), a medical console, armoury storage, storage tanks (a tank farm), a bar counter, hall furniture.
- A band room that overhangs a section's corner by a tile is trimmed back (`mend`); it is a repair after the fact,
  not a rule of the band.
- Seeds change little within one recipe on a ring: the recipe's preferences decide, the seed rolls lengths and sizes.
- Up to three rooms a station come out under three tiles wide (cabins; two wide is accepted for a cabin).
- Not built: arcs of varying depth, ports on a curve other than at the axes and cut ends, the
  spine recipe (next).
- A cluster takes about 2.5 s to assemble (eight candidates); a ring 0.2 to 0.5 s.
