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
| Elements | `elements.ts` (corridor, block, single room), `quay.ts` (the harbour), `pierhead.ts` (the harbour as the head of a street), `ring.ts` (ring or arc with its band) |
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
  or square, `gap` cuts an arc, `inner` lines the ring's inner side too). On a square outline: `cut` is how far the
  corners are cut (cells of the lattice, `'octagon'` for eight even sides, `{ flat: n }` to leave flats of n cells),
  `round` makes them arcs, `shoulders` lets the band run on into a round corner as far as its side walls can meet both
  curves (found by trial, `shoulderCells` in `corners.ts`), so the corner room is only the steep middle. `waterfront`
  names departments whose rooms stand on the ring's inner side by an arc's gap, split between its two arms. An arc's
  corners on its open side are not cut: its arms run straight to their ends.
- A branch rule takes departments (each as its own branch, or together), names a host (trunk, a ring's rim by
  direction, an arc's tip, a `spoke` (a port on the ring's inner side at an axis, heading for the centre: a pier in an
  arc's basin), the end of another rule's branch, or any section already standing) and describes its
  sections: rooms in each, `rowDepth` for a slab of one depth, `cap` for a room across the far end, `cross` for a passage
  across it with a port on each flank, `behind` for departments whose rooms stand behind its rows as sheds (one a
  side, as long as the street, their doors onto the hall the section grows from). `gated` puts a gate at its foot. `docks` makes its first section the dock block,
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

Four forms, all chosen by the user from mock sheets (`form`):

| Form | What it is |
|---|---|
| `quay` | the airlocks along the outer wall at an even pitch |
| `gatehouse` | the control room stands out in front of the quay, in the middle, the airlocks in a wing either side |
| `basin` | two arms of concourse run out from the quay's ends, the airlocks in their inner walls facing each other |
| `head` | the end of a street (`pierhead.ts`): the harbour's rooms are the street's last rooms, then customs across it, then a head the street's own width with an airlock in its end wall and the rest alternately in its two side walls |

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

## Which family for which station kind

The user's call: a kind has its own family (its look), and the recipes inside a family are the seed's variations. Each
still to be discussed and tweaked one by one.

| Kind | Family |
|---|---|
| Mining | the spine only |
| Trading | the bazaar (designed for it), and maybe the crescent |
| Pirate | the tree |
| Military | the star fort (`fort`), and the ring with barracks (from the compound); not the square |
| Research | the crescent and the half ring (arcs), the labs down the half ring's spine; never the square |
| Farming | a family of its own, not built: like the spine, one main street with long wings off it |

The compound stops being a family of its own once its recipes move to military and research.

### Ring interiors: a street down the middle

The user: "basically all the variations that do it look haphazard and scattered. if we need rooms on the inside of
the wing, i'd say we run a street down the middle". `inner: 'street'` (`assembly/street.ts`), on every compound ring:
what the band cannot hold stands in rows either side of one straight street through the middle, promenade to
promenade. Rows keep three tiles off the ring, so bracing crosses the open ground behind them. Tried in order until
every room stands: one street, rooms short side on; one street, rooms long side across (deeper rows); two streets
crossing at the first one's middle (hubs). A department keeps one depth along a side of a street: its first room sets
it and the rest grow to meet it (the user: the odd thin room "could grow to meet the others"). Guns and rooms with an
annex choose first in the band, so a gun stands inside only when the hull has no place left.

An arc's street is its spine, from the ring to the open side, and nothing else (the user: "we don't need cross on half
ring"). `street: Dept[]` on a ring root puts those departments on the street first: the research half ring
(`half ring: works down the spine, quarters on one tip, machinery on the other`) has its labs on the spine and its
cabins in a block on the tip (the user: "labs should be on the center spine, not cabins").

Harbours: the compound rings take the pier (`harbour('head')`, the crescent's pier head on a rim port): a street out
from the face with the harbour rooms down both sides at one depth, customs and the airlock hall at its head. Picked
by the user from zoomed mocks (block, pier, long quay, side pier). Military hubs failed because the harbour section
held six rooms and a hub's harbour has seven; the seventh went to a second section after a pier head, which ends its
branch, and was dropped without a word. A branch now fails when a section ends it with rooms left over, and the
compound's harbour section holds ten.

Gun batteries (`battery: true` on a ring root; the barracks ring and the square): each corner is one gun bay holding
several guns instead of many small bays crowding the street (the user: "expand the gun bays as far as they can go in
the curve instead of multiple small ones"). A corner takes guns, biggest first, while their bays' floor stays within
35% of its own (at half, the fit-out could not mount every gun at hub size); a hall too big for the band (the main
mess) keeps the first corner. The room check counts guns by mount, so a battery counts for every gun in it; the
recipe test fixture now uses that same check (`missingRooms`) instead of its own count.

Still open: the square reports hull slivers narrower than three tiles (it did before batteries); the fit-out drops a
gun it cannot mount without reporting it (the square without batteries lost one or two at station size).

### The star fort (military)

The square with bastions did not hold up at size (the user: "military square is just not working out at those
sizes"): its corners were cut so deep that it came out a diamond, thin rooms on long stepped faces round an empty
middle, 124 to 134 tiles wide at hub size. Its replacement, picked from a mock of two cross forts (bastions on the arm
ends, or on the hall's corners) as F2: a `fort` root (`assembly/fort.ts`). A parade hall at the centre (the drill hall,
later), and an arm off each side on a four-tile neck: the harbour pier north, the works, freight and drone bays east,
the barracks and messes south, the machinery west behind its gate. In each corner between two arms a gun battery,
one room holding a quarter of the guns (shared out by floor): a point on the corner's diagonal whose sides fall back
a tile and a half for every tile across, so it reaches out between the arms and wraps the hall's corner, opening onto
the hall (the user picked this from three shapes: a round fan filling the corner, this sharp point, a 45-degree
diamond). The four are one shape (the user: "make them equal, and bigger"): the open ground every corner has, mirrored
across both axes and each corner's diagonal, grown until its floor is the biggest corner's gun bays over 0.3 plus 20
tiles. The arms' streets are three wide on the hall's centre lines, so the arms are as wide either side. It keeps no
tile with fewer than two neighbours in it (the tips left lone tiles that broke the hull). Where a corner's arm stops
short of the others', the battery there takes the open strip a tile or two from the arm, so no gap shows. It opens onto the hall alone, so it may stand against the gated arm. The fort keeps barracks (6 to 8 beds,
4 singles). Sizes, seeds 1 to 4: outpost 62 to 64 by 73 to 76, station 74 to 79 by 87 to 91, hub 94 to 100 by 116
to 123, with every gun and shield generator mounted.

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

## The crescent (trade stations): prototype

The user liked the old arc grammar as a concept ("this just reminds me of the arc grammar which i liked"; a concept
from the assembly's own parts, not a port). Recipe family `crescent` (`stationRecipes.ts`), on the trade station's
program; sheets with `--family crescent`.

- Outline: a rounded square open to the west (`cut: 5`, a fixed corner radius so the flats grow with the ring; `round`, `shoulders`, `gap` on the west). The two
  east corners are arcs, the arms run straight west. A true circle was tried first and dropped: room dividers that meet
  a curve build thick walls nearly everywhere, and the stepped lattice arc before it was "just so ugly".
- A pier on the main axis from the ring's east side into the basin (host `spoke`), the harbour as its head (form
  `head`; the user: the harbour block was "wide and on a stick", then picked "docks round the head" from a mock
  sheet). The machinery is a gated wing on the rim, east.
- Three freight arrangements, all kept as variations (the user: "keep all 3"):

  | Recipe | Freight and market |
  |---|---|
  | freight pier, stalls on the waterfront | the pier is the warehouses; the stalls stand on the ring's inner side by the arm ends (`waterfront`) |
  | warehouses at the pier foot, stalls beyond | warehouses first, then a market street, then the harbour |
  | market street, a warehouse behind the stalls either side | the pier is a market street, one long warehouse behind each row of stalls (`behind`) |

- The crew sleeps two to a cabin in the band (`quarters: { barracks: [2, 2] }`; the user: crew blocks on the arms
  "are odd", cabins belong in the band, and cabins for two are fine). One-bed cabins did not fit: the straight band
  does not grow with the ring.
- What the band cannot hold stands in a second row along the arms' inner side (`inner: 'rows'`: the inner runs with
  the longest open stretch first). The user picked this for hub size over a bigger ring or a second pier.
- At station size: 79 to 92 by 74 (freight pier), 102 to 116 by 66 (pier foot, R 32 with a short inner row),
  94 to 101 by 66 to 74 (market street). 12 of 12 assemble and pass the shared fit-out with no problems (three
  airlocks, six guns, crew of twenty).
- At hub size (crew 44, twelve guns): 12 of 12 assemble at R 44 to 52: 117 to 129 by 106 (freight pier), 153 to 165
  by 90 (pier foot), 173 to 187 by 90 (market street). The pier doubles in length and runs far past the ring; the old
  trade hubs are 107 to 126 by 105. A ring may now grow past R 48 (its grid grows with it).
- Per-size recipes: `Recipe.sizes` replaces fields at a size tier (`recipeAt`). At hub size the pier-foot crescent puts
  its warehouses on the basin floor against the east side, either side of the pier (ring option `inboard`; the user
  picked mock P2), and the pier carries the stalls and the harbour: 124 to 129 by 98 to 106, every seed fitted out
  with no problems (six airlocks, twelve guns, crew of 44).

- Arm ends: each arm ends in a gun bay past its cut (`noses: 'weapons'`, `noses.ts`; the user: "rounded ends, and
  make them gun bays"), as wide as the arm (band, promenade and its inner wall) and rounded off in a half disc. A few
  radii and straight lengths are tried and the first that builds no thick wall is kept. The two biggest guns go there.
- Corners: no gun bay or crew quarters takes a crescent's corner (stretched over a curve they are halls with a gun or
  two beds in them); common rooms first. With nothing big left, a corner is a garden gallery (the north-east one).
- The pier head is as wide as customs and the pier's rows (the user's call, after a narrower head was tried).
- The market street fails the game's size limit at hub size (173 to 187 wide, over 160): it should not roll at hub.

Open: the north-east corner is a garden gallery; the arm ends are plain (the promenade stops at a wall); the north-east corner arc is one big gun room; the
head is one open hall with three airlocks; the market street's warehouses open onto the ring, not the market; seeds
differ little; no stall module exists.

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
  may face any way there (`airlocksAnyWay`; the arranger's hulls keep theirs off the stern); guns may stand anywhere in
  their bay (`gunsAnywhere`): the game has no rule that a gun touches the hull, only the ship generator's fit-out
  chose to put them there, and in a ring's band a two-gun bay stands end on to the hull with room for one beside it
  (the user: "a gun does not have that rule"); the dock count the station rules ask for is the assembly's own
  (`docksOf`).

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

Reworked (the user: "it's not the concept itself, it's the lattice and the gaps it's leaving"): the round rings are
the bazaar's rounded octagon, not the stepped lattice; the works and freight are one wing and the machinery another on
the opposite side of the ring, each about half the old wing (the user: "split the one big wing into 2 half size wings
either side"); the square with bastions gets the same two wings, its faces cut as wide as a wing (`cut: { flat: 3 }`,
`rowDepth: 7`) so a wing meets the bastions either side with no gap. The arc open to the south is dropped: the
crescent is that station. A corner whose annex end lies in an arc's cut puts the annex on its other end.

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
32 of 32 assemble, every room and bed stands, no solid 2x2 wall block, the hull check passes. The three crescents on the
trade station's rooms: 12 of 12, the same checks.
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
  spawns it) is the step left. Only the bazaar and the crescent have been taken through the fit-out (the bazaar also
  seen in the layout lab); the other families are untried there.
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
