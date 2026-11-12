# Station assembly

One modular system for station layouts, meant to replace the station grammars one at a time (issue #460). A recipe
(data) says what a station is composed of and how its parts stand to each other; one assembler builds every recipe from
the same few elements; one wall writer turns the result into tiles.

**State:** composition only. The assembler produces an unfurnished floor plan (walls, floor, doors, beams) that passes
its own hard checks. It is not handed to the fit-out yet and is not a registered grammar, so nothing in the game uses
it. The station grammars (`stationGrammars.ts` and the files round it) are untouched and stay until a recipe replaces
them.

## Where things are

| What | Where |
|---|---|
| Recipes (data) | `src/content/stationRecipes.ts` |
| Recipe types | `src/sim/shipgen/assembly/recipe.ts` |
| The assembler: candidates, roots, the hard checks | `assemble.ts`, `asm.ts` (placing and taking back), `branch.ts` (rules into branches), `finish.ts` (trim, braces, the room check) |
| Elements | `elements.ts` (corridor, block, single room), `ring.ts` (ring or arc with its band) |
| Frames and ports | `model.ts` |
| The wall writer | `regions.ts` (`RegionGrid`) |
| The lattice ring and band | `lattice.ts`, `band.ts`, `inner.ts`, `corners.ts` |
| The rooms a station is assembled from | `program.ts` (from `stationPlan.ts`), `quarters.ts` (cabins, barracks), `dept.ts` |
| Hull check | `hull.ts` |
| Sheets | `node tools/shipgen/assemblySheets.js [--seeds 1,2,3,4] [--out dir] [--versus]` |

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
  across it with a port on each flank. `gated` puts a gate at its foot. `docks` makes its first section the dock block.
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
- Every dock has a berth on a side an airlock may face (never east), with the space off it kept clear.
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

## The rooms

The assembly has its own station plan (`stationProgram` in `program.ts`), built from the kind's `StationDef` at a size
tier. The station grammars keep theirs (`planStation`), which goes when they do. Nothing here is taken from that one;
where `main` has something better or new (the arcade cabinet and game table, power-drawing grow beds) it is wired in.

- Rooms grow past what their contents need by the kind's spaciousness (`space` on the def: a navy depot and a pirate
  den are tight, a trade station roomy).
- Quarters are blocks of one-bed cabins (four beds a block), or, where the kind sets `barracks` (the mining station,
  the navy depot), barracks of 6 to 8 beds each (3 or 4 double bunks) with a few one-bed cabins beside them.
- Common rooms: one for every 12 crew. The first (two at hub size) is a mess with a galley and a game table; from
  station size up the next is a rec room with arcade cabinets and a game table (`withCommons`). The fabricator stands
  in a plant room.
- Shield rooms and the core get floor round the machine on a station that is not tight. Gun bays keep the mount size.
- Reactors: the smallest tier the size allows that powers the station from one room of two; rooms of two at most.
- Crate rooms merge into warehouses of up to 24 crates.
- Medbays: one for every five quarters blocks; a large station has a clinic (a ward and two treatment rooms).
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

- **Not furnished, not in the game.** Next: stamp the grid into a builder (`RegionGrid.stamp`, which does not carry
  beams yet), run `finishLayout`, register a grammar, and validate finished stations.
- **Barracks need a double bunk module** (a bed's footprint, two beds). There is none, so a barracks cannot be furnished
  as drawn.
- The mess and the rec room have no room recipe of their own (`support` furnishes as a mess), and medbays and plant
  rooms have none at all.
- Seeds change little within one recipe on a ring: the recipe's preferences decide, the seed rolls lengths and sizes.
- The harbour is one design, the dock block.
- Up to three rooms a station come out under three tiles wide (cabins; two wide is accepted for a cabin).
- Not built: arcs of varying depth, ports on a curve other than at the axes and cut ends, the
  spine recipe (next).
- A cluster takes about 2.5 s to assemble (eight candidates); a ring 0.2 to 0.5 s.
