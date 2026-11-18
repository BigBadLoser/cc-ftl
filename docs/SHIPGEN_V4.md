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
- **Two furnishers.** Stations furnish by rule and prove each room walkable (`rooms/rules`); ships use the older greedy
  recipes (`rooms/*.ts`). That is why barracks look the way they do.

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
6. **Fit-out** (`fitShell`, shared). Required modules first, into the rooms planned for them. Then every room is
   furnished by rule with the walkability proof (`furnishByRule`). Rules exist for every role but the engine room, the
   dock, the garden and the drill hall (`rooms/rules/rules.ts`); ships only skip them today (`fitOut.ts`, the `immobile`
   gate). The engine room gets a rule, and the greedy recipes (`rooms/*.ts`) go.
7. **Validate.** The same checks as now. A failure here means an earlier guarantee broke: the test sweep counts it,
   and the generator reseeds only as a safety net.

## What stays

- Content: factions, hull families, budgets, liveries, module defs, the engine and reactor tiers (`CoreKit`).
- What each room holds (`rooms/` contents, the room-contents decisions of #581), the equipment count (`equipment.ts`),
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
