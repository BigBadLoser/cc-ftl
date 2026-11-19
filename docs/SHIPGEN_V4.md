# Ship generation v4: one pipeline, sized before it is built

**Status:** proposal, for review. Nothing is built yet. It replaces the ship side of [SHIPGEN.md](SHIPGEN.md) family by family;
stations ([STATION_ASSEMBLY.md](STATION_ASSEMBLY.md)) are the model and share the result.

## Why

Ships are built, then checked, then thrown away. A ship at depth 9 takes 2 to 3 builds on average, a civilian one 12
(sweep of 12 seeds per faction and depth, 2026-11-18). Stations stand on the first try for every kind and size.

| Rejection | Share | Cause |
|---|---|---|
| Not enough power, reactors do not fit | the largest from depth 4 up | room sizes come from fixed numbers in the grammar blocks; more than two reactors get no room and are squeezed into engine and cargo rooms |
| No AI core fits | 56 of about 135 civilian depth 9 rejections | the core room is a fixed 3x3 |
| Floor touches space, hull parts too thin | cartel at every depth | the walls are drawn by each block and repaired afterwards |
| Equipment short (shields, drone bays) | a few a faction | the same fixed room sizes |

The code shows the same thing. Shipgen is 109 files and about 16,000 lines:

| Part | Lines |
|---|---|
| Five ship families, each with its own blocks, kit and grammars (navy, civilian, drones, scrappers, ruins) | 4,700 |
| The arranger, builder, canvas, profiles, hull fill | 1,150 |
| Plan, fit-out, validation and the repairs between them | 2,100 |
| The station assembly | 4,650 |
| Rooms and furnishing | 2,400 |

- **Each family owns the whole path.** A fix in one rarely reaches the others: reactor tiers touched about 20 places.
- **Grammars are code, not data.** A faction names `componentFrigate` or `twinHull`; what those are lives in
  `navyGrammars.ts`. Station recipes are data in `content/stationRecipes.ts`.
- **Repairs after the fact.** Between the arranger and the fit-out a layout passes through `thinWalls`, `trimThin`,
  `fixDoors` (twice), `pruneDoors`, `erodeHull`, the hull fill's seam plates and pocket fill. After the fit-out come the
  extra-reactor squeeze, the `ELSEWHERE` fallback, the engine top-up rebuild (up to 3 builds) and the reseed (up to 24).
  Each one exists because an earlier step can produce something wrong.
- **Two furnishers** (before step 1). Stations furnished by rule and proved each room walkable (`rooms/rules`); ships
  used the older greedy recipes. That is why barracks looked the way they did.

## The rule

**Every step owns one question and hands the next a guarantee.** A step that cannot meet its guarantee fails there,
tries its next local option, and never passes the problem on. A late failure is a bug to fix, not a reason to reseed.

## The pipeline

1. **Program** (what the ship holds). The faction budget at the depth becomes rooms, each with its modules, and each
   sized from those modules' footprints plus a walkway, as `stationProgram` does (`assembly/program.ts`). Ships are
   tight (spaciousness 0). The engines and reactors are solved here, not by rebuilding:
   - Engines from the hull the program implies (rooms × the family's hull per room tile), against the tier's capacity.
   - Reactors last, from every other room's draw plus lamps, the smallest tier that does it in rooms of two, and one
     room per two reactors. No reactor stands outside a reactor room.
   - The two depend on each other (engines draw power, reactor rooms add hull), so the program iterates until both are
     stable, a few steps at most.

   Barracks are sized from their bunks (`barracksSize`, `barracksOf`), so the room is the one its rule fills: bunk pairs
   along the longest wall (B1).

   *Guarantee:* every planned module has a room big enough for it.
2. **Composition** (the ship's shape). A faction recipe (data, like a station recipe) says what sections the ship has and
   how they stand: a spine with sections in series, sponsons, a citadel, nacelles, an island; a truss with sockets for a
   drone; donors welded at seams for a scrapper. Ship elements paint regions at a port's frame and return their ports,
   exactly as station elements do. An element sizes itself from the rooms it is given; one that does not fit is taken
   back and the next port is tried (`asm.ts`).

   *Guarantee:* every room stands with at least its planned floor.
3. **Walls** (`RegionGrid`, `assembly/regions.ts`). One rule writes every wall: a tile is wall where it touches a region
   that outranks its own. Walls are one tile thick everywhere, by construction. `thinWalls`, `trimThin`, `erodeHull`
   and the door fixes go.
4. **Hull shaping.** Tapers, armour plate and collars are regions of hull rank painted on space, never on a room. The
   faction's transition style picks them.
5. **Doors.** From the regions: a room opens onto the hall it stands on (halls outrank rooms), never into a hall twice.
   `pruneDoors` goes.
6. **Fit-out** (`fitShell`, shared). Every room is furnished by rule with the walkability proof (`furnishByRule`); a
   room no rule fits gets its planned modules placed plainly. Rules pick by the room's contents and shape, never by
   ship or station: a ship's narrow room takes the rule that suits a narrow room. Engine rooms hold their engines
   and nothing else.
7. **Validate.** The same checks as now. A failure here means an earlier guarantee broke: the test sweep counts it,
   and the generator reseeds only as a safety net.

## Progress

**Step 1 (program and fit-out, every family), 2026-11-18, branch `fix/room-contents-581`.** Sweep of 8 factions at
depths 1, 4 and 9, 8 seeds each (192 ships): 435 builds before, about 255 after (2.27 to 1.33 a ship). Civilian
depth 9 went from 11.8 builds a ship to 1.0; navy builds first time.

- Done: barracks of bunks (ships and stations), sized as the rule lays them, one wall on a ship; life support in
  plant rooms with a machine-room rule; a helm bridge rule (the helm on the back wall, the consoles beside it or on
  the side walls), bridges planned wide enough; crate closets two deep; crewed ships' shield rooms 4x4, the core a
  tile wider; patched scrap reactor rooms of two at most, no longer dropped by a fixed offset; the packed reactor
  rule. Guns may stand anywhere in their room (the gun room keeps to the hull by the layout, a style choice). The
  room recipes are deleted: ships furnish by rule alone, as stations do.
- Not done: deeper reactor rooms (the wall thinning broke the navy's mirror symmetry; for the regions step); the
  extra-reactor squeeze still runs; empty filler rooms the grammars leave (no plan behind them).
- What fails now: scrapper and pirate hull shape (floor touching space, hull parts too thin), from the welding.

Notes for the later steps:
- Engines need no walls between them: one engine room may hold several. The navy's walled pairs are a choice for
  symmetry, not a rule.
- The pirate factions (raider, cartel, zealot, mercenary) use the scrapper hull families and welding for now; they
  are told apart by loadout only. They want recipes of their own.

## What stays

- Content: factions, hull families, budgets, liveries, module defs, the engine and reactor tiers (`CoreKit`).
- What each room holds (the room-contents decisions of #581), the room rules (`rooms/rules`), the equipment count (`equipment.ts`),
  `fitShell`, `validate.ts`, `metrics.ts` and the faction metric bands.
- The tools: `cli.js`, the labelled view, sheets, the layout lab.
- Structural helpers that describe shape, reworked to paint regions: `profile.ts`, sockets, `navyMounts.ts`, the
  transitions.

## What goes

The five per-family block, kit and grammar sets become ship elements plus recipes; the `Builder`, `Canvas` and
`Arranger` give way to the assembly's frames, ports and regions; the repairs listed above go with them; so do the
engine top-up loop and the extra-reactor squeeze.

## Migration

One family at a time, behind a field on the hull family (as `assembly` on a `StationDef`), with `--versus` sheets
showing old and new side by side. The old code for a family is deleted when the family moves, not kept beside it.

1. **Program first, for everyone.** Footprint-sized rooms and reactors last, fed to the existing grammars. It is the
   step every later one stands on, and it should cut most of the power and core rejections on its own.
2. **Navy.** The most seen and the cleanest grammars; it proves ship elements (spine, section, sponson, citadel,
   nacelle) and hull shaping on regions.
3. **Civilian.** The worst retry numbers today, and its topologies (rings, lattices, end pods) are close to the
   station elements already.
4. **Scrappers.** Their donors are built by the navy and civilian generators, so they come after both.
5. **Drones.** The furthest from rooms on a street: trusses, sockets, pods. Last of the ship families, or folded into
   the drone rework the user plans.
6. **Ruins** consume finished ships and move last, with no change of their own beyond the inputs.

## How it is measured

- **Attempts:** at most 1.1 builds per ship on average across factions at depths 1, 4 and 9 (`cli.js`, the attempts
  sum), and the slow test asserts each family's number when it moves.
- **Look:** labelled-view and silhouette sheets for each family, approved by the user before the family's PR merges.
- **Metrics:** each faction's bands still hold.
- **Time:** build time per ship no worse than now (stations run 0.2 to 1.7 s; ships must stay well under that).

## Open questions

- Can regions carry the navy look (long slim hulls, tapers, sponsons) as well as the arranger does? The navy step
  answers it with a prototype sheet before anything else moves.
- Ships and stations: two recipe types that share elements is the working assumption (the user leans that way, not
  settled). Revisit once navy recipes exist.

Settled: barracks use the bunk (`module.bunk`, in the game but not yet placed by either generator: station barracks still
plan single beds; switching both is part of step 1) and the existing rules; drones move last, or with their rework.

## Hull shape decisions (navy, outline first)

Settled one part at a time on option sheets (the same body, one part varied), before any room work:

- **Fronts:** A2 (stepped taper, long, mid front), D1 (rounded, short, flat front), D2 (rounded, long), DG (rounded
  shoulders onto a long straight cheek), AD (stepped, steep at the front, gentle behind). Long spears, chisels, tiered
  prows and hammers are out.
- **Gun mounts:** many small bump sponsons are out (they read as lumps). Big gunships: embrasures cut into the side
  (5a, two deep), with a swept wing pair where it helps (3+5), or one long raked wing root (3c). Smaller ships with
  fewer guns: one swept wing pair (3a) or two with cut trailing edges (3d); two small low pairs (3b) situationally.
- **Small families feel agile:** corvettes and frigates stay sleek. Asymmetry only where it reads as designed; parked
  until the symmetric parts are settled.
- **Sterns:** S1 (square drive bank, engines across a flat stern), S2 (quarter flares), S7 (a flared drive section,
  also with a gentler flare); S3 (drive pods on pylons) to judge in a real ship; S4 (tapered tail, drives on the centre
  line) maybe.
- **Body plans:** P1 (plain) as a base at most; Q7's swept wings, but at the rear (blending into the drive section); the
  original split carrier (a V-notched launch lane in a broad, stepped body); an offset command pod (a flat-fronted pod
  that tapers back into the body).
- **Type identity** (fit-out requirements and theme; behaviour stays the shared doctrine):

  | Type | Role | Fit-out slant | Shape |
  |---|---|---|---|
  | Corvette | Skirmisher | Big drives for its size, 1-2 light guns (often ion), thin shields | Small, slim, drives large: rear swept wings or a flared drive section |
  | Frigate | Escort, screen | Point defence and defence drones, two shield layers, steady light guns | Medium, compact, a wing pair for the point defence |
  | Destroyer | Striker | A heavy forward battery (missiles, mass drivers), thin shields | Long and lean, embrasures forward, the command pod |
  | Cruiser | Ship of the line | Many mixed guns, 2-3 shield layers, a big crew | Big and heavy: embrasures and a raked wing, a square drive bank |
  | Carrier | Launcher | Few guns; shuttles, defence drones, point defence | Broad, the split hull with a launch lane, an open hangar |
- **Corridors three wide**, so the hull is odd-wide about a centre row and rooms centre on it.
- **Carriers:** an open hangar with the bays spread inside it, not a walled room a bay.

## Room layout (outline ships): corridors, blocks, one splitter

The first outline assembler sliced paired rooms into a band along each side and grew a rule for every hull feature
(guns wait for the wing, docks at the widest stretch, plants tucked beside the dock, a store behind the engines, slack to
the quarters...). Each fixed one sheet and made the next case harder. It is replaced by three generic steps; no step
names a room type except through its needs.

1. **Corridors cut the hull into blocks.** The spine (three wide) runs from behind the bridge to the stern. A cross
   corridor (three wide) runs from the spine out to the hull wherever the side is too deep for one room (deeper than
   two rooms' minimum, so a room on either tier is at least three deep), one for each such stretch, at its deepest flat
   point. There is always at least one cross corridor pair, at the widest flat stretch, because the airlocks stand at the
   hull ends of cross corridors (an airlock needs a flat outer wall). The bridge, the spine and the cross corridors leave
   blocks: on each side, the floor between two cross corridors, or between one and the bridge or the stern. Blocks are
   laid out on one side and mirrored.
2. **Rooms that need a wall claim it first.** A need is a property of the room's equipment, not of its role:
   - an engine needs the aft hull: the stern block's rows that end at one aft wall take engines four rows each, with a
     walk column ahead of them; the stern block's other rows are ordinary floor for step 3;
   - an airlock needs a flat hull end of a cross corridor;
   - a gun needs the side hull (the outer tier), the wing first where there is one;
   - the bridge takes the bow.
3. **One splitter fills every block.** A block next to a cross corridor and deep enough for two tiers splits into an
   inner tier (doors on the spine) and an outer tier (doors on the cross corridor; only as many outer rooms as touch it).
   Each tier is cut along its length into rooms in zone order (guns forward, stores aft), each taking columns until its
   planned area is met; the outer tier takes the smallest rooms left. Slack is shared out over the block's rooms in
   proportion to their planned areas, so no one room takes it. A room is at least three deep and at most three times as
   deep as it is long.

Every room touches a corridor, every wall is one tile thick (plating between blocks and tiers), and nothing in the
three steps knows what a plant, a store or a barracks is: a small room lands in a small slot because it is small.

## Room sizes and fillers (outline ships, #581)

The splitter above shares slack over a block's rooms, so spare floor goes to whatever room is nearest: gun rooms the
size of a hangar, cargo holds taking half a side, cabins squeezed beside them. Each patch for it (growth caps by kind,
storerooms cut from the leftover, cabin blocks cut from a long barracks, back slots merged into a neighbour) was its own
special case. The hull cannot give the floor back either: hull and interior walls are one tile thick and continuous, so
every tile inside the hull is floor of some room or corridor (plating left over is trimmed off the outline, which costs
silhouette). The hull stays first and keeps its shape; spare floor becomes more rooms, never bigger ones.

**One rule: every room is within its size range.** Each room kind has, as data:

- `min`: the planned area (its modules fit, the furnishing rules hold), and a minimum length and depth;
- `max`: how far past its plan it may grow (a factor of the plan, and an absolute cap in tiles);
- `aspect`: the longest side over the shortest, at most (one value for all, three today; no strips).

| Kind | Grows to | Cap (tiles) | Note |
| --- | --- | --- | --- |
| guns, shields, core, reactor, plant | 1.3x plan | 48 | equipment rooms stay tight |
| bridge | 1.3x plan | 60 | the bow's taper takes the rest |
| barracks, mess, medbay | 1.6x plan | 60 | |
| hangar | 1.5x plan | 120 | |
| cargo (a planned hold) | 1.5x plan | 60 | |
| trauma, pantry, brig | 1.3x plan | 40 | |

**A slot over its room's max is cut, the rest goes to fillers.** A slot is a piece of a tier: columns along the band,
rows from the corridor out. The room takes the front of it (the rows on its corridor, the columns its planned length
asks) up to its max; what is left, along the band or behind, is cut into filler rooms. A filler is a room the plan did not
ask for, from a ranked list, each kind with its own size range and access rule (roomAccess.ts, unchanged):

1. **Cargo hold**: crates, 9 to 30 tiles, opens off a workshop or a hold (cargo's access rule) or a corridor.
2. **Small farm**: hydroponics, 12 to 24 tiles, on ships that carry a farm (cruisers and up).
3. **Workshop**: a fabricator, 12 to 30 tiles, on a corridor.
4. **Cabin**: while the ship's spare beds allow (below).

**Crew sleep in a barracks or cabins, with a few spare beds.** The plan gives every crew member a bed, plus two to four
spare (seeded, more on bigger ships). The beds are laid out by the space they get: a slot the barracks fits as one room
stays a barracks; a barracks slot well past its max becomes a cabin block, one bed a cabin (bunks only where cabins are
fewer than sleepers). A cabin block is cabins either side of a corridor of its own (one to three wide, so both sides
are equal), every door on that corridor, each cabin three rows by three to four floor columns (nine tiles at least). A
filler cabin, or a cabin block's extra cabins, adds a bed only within the spare allowance; past it, leftover goes to
the other fillers.

The filler kind for a leftover is the first one whose size range and access fit it (a cabin block needs a corridor stub
from a hall; a storeroom behind a workshop or hold needs none). Leftover too small for any filler joins the room in
front up to that room's max, else the neighbour along the band; only a sliver under three rows or columns does so past
a max.

**What this replaces in blockLayout.ts:** `GROW` and the slack sharing in `split()` (a room takes its target, the rest
is filler), `stores()` (small holds are a filler), the cabin-block special case (cabins are the barracks' form for a
large slot), the empty back slot merge
and the L-shape extension (a back slot is filler, or joins the room in front within its max). What stays: corridors and
blocks (steps 1 and 2 above), zone order, mirror pairs, the scale search, room access, the furnishing rules, power
planning (fillers are added to the plan before reactors are sized, as the ship commons are).

**Measured by:** the sheet of eight seeds per navy type, and a test over seeds 1-16 per type that every room is within
its kind's max (fillers within theirs) and its aspect.

Later: officers in cabins and ratings in a barracks on bigger ships.
