# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-10-22 (asteroids on `asteroids`, merged with stations and galaxy from `main`).

**Ship generator (branch `genint`):** see [SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md) for the handoff (scope, file
map, sheet commands, backlog) and [SHIPGEN.md](SHIPGEN.md) for the design history.

## Where things are

**On `main`** (live at https://cc-ftl.bigbadloser.workers.dev):
- **M0–M2:** the core sim (ECS, grids, commands, saves), crew, jobs, priorities and drafting.
- **R1:** the PixiJS isometric pixel-art renderer with the Blender sprite pipeline. Tiles are 64x32.
- **Walls:** autotiled, with low cut-away blocks, full-height versions, ghosts for the exterior walls
  nearest the camera, and tall door frames. Floors use one main plate plus rare variants.
- **Crew art (A1):**
  - Body: the CC0 Quaternius base, variant D (stylised and upright).
  - Settings: 4 shading bands, smooth shading, no eyes, one composite outline plus a cool rim
    (renderer filter).
  - Engineers get the cyan cyber eye.
- **M3a ship systems:** power, per-tile atmosphere, fire, light, temperature, vitals,
  downed→bleed-out→death, rescue to beds, overlays, alerts, the module inspector and the build menu.
- **M3b economy:** items, storage with filters, hauling, build costs with delivery, the fabricator
  (orders: make N / keep N), the stock drawer, and item and fabricator sprites.

**In progress** (not merged; each branch has its own worktree):

| Branch | Worktree | What | State |
|---|---|---|---|
| `m4-combat` | (base) | M4 combat **sim** (sector, ships, weapons, shields, consoles, AI core, projectiles, enemy AI, wrecks, flee) | Done, 138 tests. Not merged because its modules have no sprites yet. |
| `m4-assets` | `/home/user/cc-ftl-m4art` | M4 sprites: weapons, engine, shield gen, consoles, AI core, roof tiles, projectile and fx sprites. Review sheets in the scratchpad `m4art/` | Done, pushed (3 commits). Review sheets sent to user, awaiting approval. Integration notes: small shield gen def must use `module.shield_gen_small`; moduleArt needs `.charged` (weapons) and `.active` (engine) suffixes; roofs are `roof.<kind>.m<mask>` (N1 E2 S4 W8); projectiles point screen-right (renderer rotates) |
| `m4-ui` | `/home/user/cc-ftl-m4` | M4 combat overlay, targeting, projectiles, fx, roofed enemies, Spawn raider debug. Fallback sprites via `src/render/assets/fallback.ts` (real ids swap in automatically once in the manifest) | Built, pushed (08e9d7c). Fixed: transparent hole in overlay preview, roofed enemy hides interior (fallback roof = light slate, red/cyan/amber module roofs), bigger fallback projectiles. Open: phone sheet slightly translucent; preview 0.5 scale breaks integer zoom; raider downs player crew in ~2 min (tune in m4-combat) |

NEXT (handoff): user has NOT yet approved the m4-assets sheets (review sheets: re-render with `tools/blender/review/` if needed). Reviewer flagged: roof floats above hull walls in the roofed mock; roof markers quiet. After approval: swap the fallback ids for the real ones, take screenshots, get user approval, then merge
m4-combat + m4-assets + m4-ui to main.

Old branches (`m0`…`m3b-ui`, `r1-*`, `walls-*`, `asset-pipeline`, `crew-art`, `a1-readability`)
are already merged or superseded. Don't build on them.

## Asteroids (branch `asteroids`; slices 1-3; not merged; visual: needs the user's screenshot approval)

**User decisions (2026-10-21):**
1. Asteroids are real tiles in the sector grid, mineable and buildable like any other region.
2. Default mining uses **mining pods**: they deploy from a new small vehicle bay (about 3x3), fly to an asteroid, laser-mine its ore
   veins and bring the ore back; a field takes several trips. **Pods are piloted** (one crew pilot) and nearly fill their 3x3
   bay (correction, 2026-10-21).
3. Two scales: **very big asteroids** you (or enemies) can build a base or outpost on, and **fields of smaller asteroids** with
   ore for pods.
4. Asteroid bases are either **dug** (rooms carved into rock mass) or **built on the surface**, never both on one asteroid.
5. **Two rock forms** (replaces the hollow-core design, 2026-10-21): rock **mass** (full-height solid block, airtight, blocks
   sight) and rock **ground** (flat levelled rock: walkable, airless, a buildable foundation). Big asteroids are mostly ground
   with mass as features (ridges, boulders, crater rims, one or two massifs) and roll a coverage class: open, mixed or dense
   (dense is common and mostly just rock). `Struct.CoreRock` and the hollow roll are gone. (Veins: superseded by decision 8.)
6. Build on ground at normal speed; a footprint may clip a little rock mass (up to 25%), which its job levels at a small extra
   cost; a real ridge needs clearing first. Digging (a crew job, slow on purpose) turns rock mass into floor; the mass left
   around is a natural airtight wall; the outer layer (mass touching space or ground) cannot be dug; a dig through a vein
   yields its ore. Outposts: surface (trading, farming, mining: prefab habitats on open plains, tubes, a dock at the edge) and
   dug (pirate, criminal, covert: rooms in dense rock, a tunnel to an airlock in a rock face, a rock roof so it looks like
   plain asteroid from outside). Enemies use the same generators.
7. **Finished rock walls (2026-10-22, save v32).** New `Struct.RockWall` (dressed stone): a normal 1-tile wall (wall height,
   airtight, blocks movement and sight, doors go into it, no integrity so weapons do not chip it). Crew **finish** rock mass into
   it: `job.build` with struct RockWall on rock mass, free, 8 s (`FINISH_TICKS`; dig 15 s, level 6 s), only on a tile with a floor
   or door 4-neighbour; the outer-layer rule does not apply (the wall stays sealed). Digging a rock wall gives floor like rock
   mass (same 15 s and outer-layer rule); a Door can be built on one. Works in claimed bases ("Finish rock" in the build menu
   beside Dig and Level). **Dug outposts are walled entirely in rock walls** (`stampOutpost` turns every metal wall of a dug base
   into `RockWall`, room partitions and faces against rock alike; doors stay doors); surface outposts keep metal station walls.
   Planner's calls: deconstructing a rock wall is refused (`nothingToDeconstruct`; no refund, no revert to rock mass); a metal
   Wall cannot be built over one (`rockMass`); hull-edge modules (guns, engines) may sit on a rock wall row. Rendering is a
   placeholder: the metal wall sprites with a stone multiply tint (`ROCK_WALL_TINT`, `artKind` in render/tiles.ts maps RockWall to
   Wall for all the wall-piece logic); the Blender art is pending.
8. **Big asteroids carry no ore (2026-10-22, save v32).** Only fields (small rocks for mining pods) have ore, as pockets;
   `OreDef.weight` is now one number (the pocket odds). The big-asteroid veins, "richer in massifs" and `BIG.vein*` are gone, so
   digging a big asteroid yields nothing, and the asteroid panel shows "No ore" and offers no Mine button there. Mining stations
   and outposts on big asteroids are fine without ore.

**Slice 1:** rock and ore tiles, the `AsteroidC` region model, the seeded generator, stamping with the gap rule,
`debug.spawnAsteroid`, placeholder drawing and contact sheets. Planner's calls: own `AsteroidC` (not a ShipC kind); mined rock
becomes Space (no rubble); ores yielded existing items at first (superseded: see "Raw ores and refining"); `ASTEROID_GAP` = 4 tiles; weapons do not damage rock.

**Raw ores and refining (done):** `item.iron_ore` and `item.rare_ore` (raw, ore) are what `ore.iron` and `ore.rare` yield; ice stays
`item.ice`. `module.refinery` is a real 3x4 player-buildable crafting module (access on the middle of the east long side, power -8,
cost 30 metal + 8 electronics + 4 parts); recipes `recipe.refine_iron` (3 ore -> 2 metal) and `recipe.refine_rare` (2 ore -> 1
electronics). Mining stations stock and sell ore; their industry rooms are 10x7. Art pending: the fallback is an orange crate per
tile. Save v29.

**Slice 2:** `module.pod_bay` (3x3) and `vehicle.mining_pod`, `mining.order` / `mining.recall`, trips until the ore is gone.
Planner's calls: hold 24, speed 6 tiles/s, laser 2 units/s; the laser works from above (buried vein tiles too); crew haul the
ore from the bay's access tile through the existing cargo hauls (a full storage leaves the pod waiting, loaded); no pod item
yet (template or `__cc.stage.vehicle(def, bay)`); no mining UI yet.

**Slice 3 (done):** the two rock forms, coverage classes, dig / level / auto-level, outposts, piloted full-size pods. Save v28 after the merge with main (stations v26, galaxy v27).
Planner's calls:
- Dig and level are **folded into `job.build`** (no new commands): Floor on rock mass digs (15 s, free), Ground on rock mass
  levels (6 s, free), anything else on rock mass is refused (`rockMass`); Floor, walls and doors build on ground as on a deck.
  The outer layer can still be levelled. A dug tile's ore drops on it as a loose stack that crew haul (not into the digger's
  hands). A levelled tile keeps its ore (pods can still mine it).
- Auto-level: up to 25% of a module footprint (2 of a 3x3) may be rock mass; the job gets 3 s of extra work per rock tile and
  levels them to ground when it finishes. Modules stand on floor or ground.
- Coverage odds open 3 : mixed 3 : dense 4; rock-mass share open 6-20%, mixed 30-55%, dense 78-100%. Field rocks are all rock
  mass (solid boulders).
- Pods: the best free pilot (not drafted, not reserved, of the ship's side, on the ship; highest piloting) walks to the bay and
  embarks; they stay aboard between trips and climb out when the order ends or is recalled; with nobody free the order waits
  (`mining.waiting`, reason `noPilot`). Pods are 2.6 tiles across (`VehicleDef.size`). Couriers and boarders skip class 'pod'.
- Outposts are a `ShipC` region over the base rectangle, never 'disabled' (`immobile`); surface ones are neutral, dug ones
  hostile. **Outposts are real stations (2026-10-22, save v31):** the hand-made habitat kits are gone. `generateOutpost` builds a
  `station.<kind>` at the 'outpost' tier (trading, farming, mining; pirate, criminal and covert all use `station.pirate`) and fits
  it onto a big asteroid: the dock airlock (the north- or south-facing one nearest the template edge with nothing built beyond it)
  is set on the rock face with its collar cut to open space (`outposts/site.ts`). Surface: ground pad one tile around the
  station on an open asteroid. Dug: `carveInRock` turns every hull wall bordering outside into rock mass (rooms and one-wall
  partitions stay) and drops outside cargo frames and crates; the rect plus ring is packed with rock on a dense asteroid. Crew,
  security, trader and station life come from the shared `outfitStation` (stations/spawn.ts), so the director, alarm and crew AI
  run them; they have no `CombatC` until woken. Planner's calls: kept the station's other airlocks (on ground or rock, not
  space; only the dock opens to space); base tiles that overhang the outline are filled with ground or rock (at most 20%);
  the asteroid is asked for `minSize` (new `AsteroidGenOptions`) so a 40-65 tile station fits; stations' guns and shields stay.
- **Dormant until provoked; dug ones hidden until discovered (user decision, 2026-10-21).** A dormant outpost is no combatant
  (combat trigger, alerts, combat panel enemies, auto-target), whatever its faction; it is stamped `immobile` + `dormant` like a pirate den (one mechanism: `combat/dormant.ts`, `wake`, event `ship.provoked`) and has no `CombatC` until it wakes. A hidden
  one is not listed (node strip, shuttle targets, trade/hail), not targetable (`combat.setTarget` refuses it), not pickable
  (clicks fall through to the rock) and keeps its rock roof whatever the roof toggle. Discovery (alert "Hidden base discovered"):
  a player crew member or a player vehicle out of its bay within `DISCOVER_RANGE` = 6 tiles (Chebyshev) of the box of the base's
  tiles, checked every 10 ticks, or a breach; it is then listed and selectable but still dormant. Provocation (alert "<name> turns
  hostile"; it gets a `CombatC`): the player aiming weapons at it (`combat.setTarget`; planner's call: aiming is the attack,
  since weapons are only manned in combat), a shot landing on it, player crew standing on its walkable tiles (boarding), a
  build or dig order into its region, or a floor it does not own touching its floors (a dug breach). Surface outposts are never
  hidden. Both flags are saved on `ShipC.outpost`.
- Venting fx fix: the dug base looked like it leaked (air puffs along every rock edge). The sim was airtight; the vent emitter
  read the region's art kind, which shows rock as Space. It now reads the real tile and vents only into Space or ground. Test:
  every room of both styles within 1% over 120 s, no breach or low-O2 events.
- Rendering (placeholder): rock mass is a 1.2-tile-high block, ground a flat paler diamond with crater pits; a roofed dug base
  is capped by rock blocks (`rockRoofView.ts`) and its own layers hide; pods hover above the tallest rock. Rock drawn in the floor
  layer does not sort against crew yet.
- Debug: `?hook`, then `__cc.dispatch({ type: 'debug.spawnOutpost', style: 'dug', seed: 1 })`, `__cc.focus(x, y)`.

**Slice 4 (done): mining UI, pods from the build menu, claiming a base.** Planner's calls:
- Mining UI: click plain asteroid rock (or a hidden base under it) or the asteroid tile in the node strip to open the asteroid
  panel: ore left by kind, the player's pods (status, pilot, hold, trips) with Mine (sends `mining.order` for the whole
  asteroid) and Recall, and Claim for a base. The vehicle panel (select a pod bay) lists the pods too. Alerts: "Mining pod waits for
  a free pilot", "Mining done". No tile/area paint mode for `tiles` yet (the command takes them).
- Pod: **the pod bay comes with its pod** when crew build it (`vehicleBay.builtWith`); its cost covers both (28 metal, 12
  electronics, 4 polymer; 18 s of work). No separate pod item or recipe. The pod bay is in the modules build menu.
- Claiming: build menu "Claim asteroid", drag a rectangle (4-60 tiles a side, inside the asteroid's box, at least half on its
  rock, clear of other regions' frames) -> `asteroid.claim`: an immobile player `ShipC` with `base` (never disabled or wrecked by
  the ship-state system). Build tools now paint on any player region under the cursor (home ship or base). Tiles crew build or dig
  there become the base's. It is listed in the node strip, saved, and stays in the node's archive on a jump like a prize.
  "Dig rock" and "Level rock" are in the build menu (free; the outer-layer rule holds).
- Reaching it: a shuttle hovers beside the base (`vehicle.hover` takes the base like any ship) and suited crew EVA out; they now
  land on open rock ground as well as the hull ring, and walk the ground in suits. Because of the outer-layer rule, nobody digs in
  from the open: build a sealed habitat (floor and walls on the ground) against the rock, then dig inward from its floor. Missing
  for a smooth loop: crew cannot walk between the home ship and the base (separate regions, ships are never close), so every
  trip is a shuttle run; no "send crew to the base" order or base supply hauling yet; the base has no power until crew build it.
- A pod bay job whose footprint lies across a busy corridor can wait for a long time: crew walking through block the finish
  (an existing rule for solid modules).

**Next slices, in order:**
1. Base logistics: carry materials and crew between the home ship and a base (shuttle cargo runs, a "go to base" order),
   and the tile paint mode for mining orders.
2. (Crews, trader and director done, see Slice 3.) Still open: enemy outposts defending when woken, NPC factions picking outposts by kind, an outpost dock the player's shuttles can use.
3. Asteroid art at the 2x scale (`art-2x`, 128x64 tiles), including rock mass that depth-sorts against crew; pod and pod-bay art.

## Stations, slice 1: generation (branch `stations`; not merged)

**User decisions (2026-10-21):** stations come in sizes from small frontier trading posts up to system hubs, and a hub is
much bigger than any ship. All five kinds are wanted: trading, mining, farming, military depot and pirate den. A player can
try to board and capture any station. Stations carry many NPCs, security among them, and most are armed to the teeth. Pirate
dens are weaker on purpose, so they can be conquered.

What exists (generation only, nothing spawns yet):
- **Sim** (`src/sim/shipgen/station*.ts`): `generateStation(def, id, size, seed, defs)` returns a normal `GenResult` plus
  `station` (kind, size, crew, security, docks, guns, shields). `planStation` makes the rooms from the tier, the station
  grammars (`stationRing`, `stationLattice`, `stationHub` core ring with satellites on spokes, `stationWelded` pirate den)
  build them from the civil ring and lattice builders, and `finishLayout` (split out of `generate.ts`) runs the ship
  fit-out and validators. The engine rule is off (`validateTemplate(..., { immobile: true })`, and no engines or
  thrusters are planned). Station rules on top: enough airlock docks, everything inside the template rect, and a size
  cap of `STATION_MAX` = 160 tiles a side.
- **Content** (`src/content/stations.ts`, `satisfies StationDef`): `station.trading|mining|farming|military|pirate`, each
  with tiers `outpost | station | hub`. Crew are 8 / 20 / 44 times a kind factor (farming 1.1, depot 1.2, pirate 0.8).
  The security share is depot 0.55, trading 0.3, mining 0.25, farming 0.2 and pirate 0.15. Guns per tier: depot
  4/12/24 (50% heavy), trading 2/6/12, mining 2/5/10, farming 2/4/8, pirate 1/3/6.
- **New content pieces:**
  - room roles `farm`, `industry` and `armoury`, with recipes in `rooms/station.ts`;
  - `module.refinery` (now a real 3x4 refining module; orange crate fallback art until the Blender sheet exists);
  - `RoomSpec.items` for per-room stock: armoury lockers hold rifles and sidearms;
  - `HullFamilyDef.cages` for the ore cages that mining stations hang off the structure.
- **Armed NPCs:** no new field. Security crew are `role.security`, whose existing `loadout` fetches rifles and sidearms
  from storage. Every station's armoury lockers hold at least one hand weapon per security crew member (a test checks this).
- **Fixes on the way:** lattice stations were not centred on x, so wide ones lost modules off the local canvas
  silently (now centred, and a lost module fails the build). Frozen blocks reused room chars after 59 labels, which
  merged rooms. There are now 315 chars, so ships are unchanged.
- **Numbers:** the largest hubs build in under about 1 s each (mean 0.3–0.7 s), are 140–160 tiles a side, and take
  1.5–2.3 attempts on average.
- **Sheets:** `node tools/shipgen/cli.js station.all --size outpost,hub --count 6 --scale 6 --out <dir>`
  (`station.<kind>`, `--size outpost|station|hub|a,b|all`).
- **Tests:** `src/content/stations.test.ts` checks validity per kind and size, determinism, doctrine module counts,
  crew and security scaling, defence ordering and armoury stock. `stations.slow.test.ts` sweeps 12 seeds per kind and
  size.

**Layouts (round 2, after user feedback "more layouts, some circles"):** ten station grammars. The new ones:
- `stationWheel`: a round ring on a rasterised circle (`stationRings.ts`), rooms fitted outboard and, when they don't
  fit, inboard; the hub on 2 to 4 spokes, sometimes with rooms beside it.
- `stationConcentric`: two round rings joined by four spokes. The inner ring has rooms on both faces, which fills the
  centre. Docks stay on the outer ring.
- `stationArc`: a partial ring (180 to 270 degrees), rooms on both faces, docks at the ends.
- `stationSpine`: a 2-wide spine with pods flush or on stubs both sides, docks at the ends.
- `stationCross`: four arms from a core room, rooms on both faces, a dock at every arm end.
- `stationTree`: quads and towers grown branch-wise off the newest modules, with airlocks hung off them.

Hub satellites (and the hub core) can now be wheels. Welded pirate modules bring no airlocks of their own.

Per-kind weights live in `SHAPES` in `src/content/stations.ts`:

| Kind | Outpost | Station | Hub |
|---|---|---|---|
| Trading | wheel 3, cross 2, ring 1, arc 1 | wheel 3, concentric 2, cross 2, ring 1 | concentric 3, hub 3 |
| Mining | spine 3, cross 2, arc 1, tree 1 | spine 3, cross 2, lattice 1, wheel 1 | hub 3, cross 2, concentric 1 |
| Farming | wheel 2, arc 2, ring 1, lattice 1 | wheel 3, concentric 2, lattice 1 | concentric 3, hub 2 |
| Military | cross 2, spine 2, ring 1 | spine 2, cross 2, ring 2, concentric 1 | hub 2, concentric 2, cross 1 |
| Pirate | tree 3, welded 2, arc 1 | tree 2, welded 2 | welded 2, tree 2 |

Spines and arcs stay below hub size, because they outgrow the 160 cap. Hubs build in a mean of 0.4–0.65 s each
(worst 1.8 s) with 1.4–3.1 attempts. CLI: `--layout stationWheel` forces one layout.

**Round 3 (user feedback: "courtyards as rooms, rooms that follow the ring, walls far too thick everywhere"):**
- **Thick walls, every generator.**
  - Causes:
    - taper and plating wedges and filled pockets were solid wall slabs (`hullFill.ts`);
    - blocks and rooms joined side by side kept both walls (double partitions);
    - welded and tapered outlines left spare hull layers and stair-step shells.
  - Fix: `thinWalls.ts` runs on the final canvas before fit-out, for ships and stations alike:
    - slab interiors become floor of the neighbouring room, keeping one wall along open space, so outlines stay;
    - spare hull layers peel off;
    - double partitions fold into one wall. The outboard or western room grows, so mirrored hulls stay mirrored.
  - Sealed pods, docks, engines and hangars keep their boxes.
- **New metric `thickWall`:** wall tiles with no floor, door, beam, container or module among their 8 neighbours. It
  shows in the sheet summaries and is bounded in tests: ship mean at most 0.02 and max 0.05 per faction; stations at
  most 0.03.
- **thickWall before → after** (mean over seeds):

| | Before | After |
|---|---|---|
| Scrapper | 0.118 | 0.003 |
| Navy | 0.093 | 0.000 |
| Civilian | 0.038 | 0.000 |
| Drones | 0.016 | 0.001 |
| Stations | 0.00–0.08 | under 0.01 |

  No armour doctrine is kept yet: navy tapers now read as floor inside a stepped one-wall outline.
- **Courtyards as rooms** (`stationCourts.ts`): every space pocket a ring block encloses becomes one open room. That
  covers ring centres, the sectors between spokes and the band between two rings. Each court gets up to four doors to
  its corridors, plus some "shop" doors from soft rooms. Roles and recipes (`rooms/station.ts`):
  - `plaza`: trading 0.8, mining 0.4 (stalls, benches, a food court);
  - `garden`: farming 0.85 (hydroponics);
  - `drill`: military 0.6 (open floor, racks).
  The chance is drawn per block, so some stations keep empty centres.
- **Ring rooms follow the band** (`stationBands.ts`), on wheels and arcs: soft rooms (quarters, holds, messes, farms,
  refineries, armouries) are ring segments cut by one-wall radial partitions. They are stair-stepped polygons;
  fit-out handles non-rectangular rooms.
  - System rooms (guns, shields, the core, reactors, the bridge) stay rectangles on the rim beyond the band, because gun
    bays need square floor and open space beside them.
  - Docks sit on the rim near the top and bottom, because airlocks face north or south.
  - **Concentric rings still use rectangles.** As bands, every airlock failed: the band wrapped round the docks. They
    now keep system rooms and docks on the outer ring.

**Round 4:**
- **Wall thinning keeps the outline.** Round 3's peeling had squared off stair-stepped tapers and chamfers. Now no tile
  touching space (8 neighbours) is ever removed or turned to floor; a double hull is thinned by folding its inner wall
  into the room instead.
  - `GenResult.thin.outlineChanged` is checked to be 0 across a sweep.
  - The 32 depth-9 ship sheets have exactly the outline tiles they had before the pass existed.
  - The ruin pass now keeps the piece with the most floor.
- **Readable sheets.**
  - A legend strip: room tints and module glyphs.
  - Courts drawn as plain floor; furniture as solid blocks.
  - Plaza stalls laid out as clusters with aisles.
  - Zoomed crops come from `--count 1 --scale 12`.

**Slice 2 (stations in the node, real station trade):** see ARCHITECTURE "Stations".
- `debug.spawnStation {kind, size, seed, x?, y?}` stamps a generated station as an immobile ship with crew, security and a trader. The
  debug panel has Trade outpost, Trade hub and Pirate den buttons, and `?station=trading:hub` spawns one at start.
- The instant trade fallback is deleted. Station deals fly the player's shuttle (hover beside the station, swap cargo with its
  stock, fly home): the existing branch 1/2. **Not built:** docking at a station's own airlock and hauling through its storage.
- Kinds:
  - trading, mining and farming are neutral and hailable;
  - the military depot is neutral and its quartermaster sells no hand weapons (stock list only; it still buys them);
  - the pirate den is hostile but dormant until aimed at, damaged or boarded.
- Crew names repeat once the pool runs out, because hub crews outgrew it. The camera can zoom out below 1 to frame a hub.
- UI note: the hostiles button still lights for a dormant den (the sim is not in combat).

**Slice 3 (user answers 2026-10-21):**
- **Station trade docks at the station's airlocks**, and station crew haul both ways (ARCHITECTURE trade, branch 3). The hover swap
  stays as the fallback when no station airlock is free.
- **Depots sell "surplus":** every hand weapon up to `ItemDef.tier` 2 (blade, sidearm, ion pistol; never the tier-3 rifle), at a
  1.1 markup, labelled "surplus" in the trade window; they still buy weapons. No armour items exist yet.
- Defaults the user did not answer, noted here:
  - the hostiles button stays dark for a dormant den until it is provoked;
  - the node growing to fit a hub is fine for now.
- **One zoom ladder** after merging main's 2x code: whole levels from 1 up; below 1 the fractions 1/8, 1/6, 1/4, 1/3, 1/2, 0.75,
  with 1 / ART_SCALE among them. Every level below 1 is drawn smoothed.

**Slice 4: station life and security (2026-10-21).** Design in ARCHITECTURE, "Crew AI" and "Stations".
- **Principle (user):** NPCs use the same crew AI as the player's crew; the only differences are the command source and a per-ship
  director (data and config). Patrols are `patrol` jobs posted by `stationDirector`; alarm response withdraws them and leaves the
  hunting to the shared fight code. No bespoke NPC movement besides the idle stroll fallback.
- Decisions made here (defaults, not user answers):
  - station crew get hungry and eat, but hunger floors at 25 (no starving NPCs; resupply is off-screen);
  - the "Watch" (patrol) priority column is hidden in the player's grid until the player has patrols;
  - invited trade crew cannot start a fight with a neutral station (`crew.attack` needs hostility); if they are engaged on station
    crew, or the station is damaged, they become wanted;
  - alarms track wanted crew per station (`WantedC`), not a faction-wide hostility flip, and are forgotten 30 s after it calms.
- Perf: a trading hub in the node, 2000 ticks after a 300-tick warm-up: 7.25 ms per tick before, 7.8 after (station crew now eat,
  stroll and patrol; the alarm scan groups crew by grid each tick).
- **Player-only assumptions left for the next slice** (outside this slice's path):
  - `systems/cargoJobs.ts`: the unload branch runs for player ships only;
  - `crew/mood.ts`: mood is player-crew only (station crew have no mood);
  - drafting is player-only (`isPlayerControlled`, the `crew.draft` commands): a director cannot draft yet, so "battle stations"
    is the withdrawn patrols plus fighter roles' own engage rule;
  - enemy ships still use `systems/enemyAi.ts` and `boardingAi.ts`, separate policy code that should become directors;
  - `systems/dormancy.ts` and `stationAlarm.ts` treat only the player as invitable or provoking.

**Airlock-only docks open into their corridor (user decision, 2026-10-21).** `shipgen/openDocks.ts`, run after fit-out for
ships and stations alike: a dock room that holds only its airlock (and lamp), with at most 12 floor tiles, loses the partition
and door to the corridor (hall room) it borders, and its floor joins that corridor. Never into a non-corridor room; docks with
lockers or racks keep their wall and door; only partition tiles touching no space go, so the hull stays airtight. Docks that
border no corridor stay walled (placement-time fixing was not cheap: dock placement differs per grammar). Sweep counts are
printed by `content/airlockDoors.test.ts`: ships merged 47 / walled 4 over 24 layouts, stations merged 74 / walled 19 over 45.
The generic door sprite is also no longer drawn on an airlock's pod (render/airlockArt `airlockDoorTiles`, ported from
`airlock-int` 0e5a50d, which never reached main).

Next slices (not built):
1. Directors for enemy ships (fold `enemyAi` and `boardingAi` into director policy), director drafting, and the leftovers above.
2. Boarding and capture balance for stations: many security NPCs, and pirate dens as the soft target.
3. Station art at the new 2x scale (128x64 tiles): refinery, hydroponics and armoury lockers, plus the ore cages.
**Round 5 (generator polish, branch `stations-polish`):**
- **Dock banks** (`stationDocks.ts`): wheels and the outer ring of concentric stations reserve their docks before the band
  is cut. Docks stand side by side (shared walls) on the ring's north and south faces (west once a bank passes about 30
  degrees), each a straight 3-wide spur from the corridor wall out past the band, so the airlock faces space. The band
  splits into arcs at the bank centres and the rim rooms keep clear of the collars.
- **Concentric rings are ring bands:** the inner ring has segment bands on both faces (the inboard one round the hub),
  the outer ring one outboard band; spokes cut the bands into arcs. System rooms stay rectangles on the outer rim
  (guns get a second pass; reactors, shields and the core fall back inboard of the outer corridor). The court between
  the rings is at most 14 tiles across (`COURT`): the inner ring grows when many guns make the rim big.
- **Courts lit to scale:** rooms of 120+ tiles get a lamp grid (pitch 9) plus a pass that lights any tile still dark,
  with no 12-lamp cap; every court floor tile is within 6 tiles of a lamp (tested). Courts may take up to three extra
  reactors for their lamps.
- **Faster fit-out:** `Layout.walkable` is a lookup (a solid mask kept by push/pop), which the per-candidate
  connectivity check calls on every tile.
- **Numbers** (`node tools/shipgen/bench.js`, 12 seeds; trading 48):

| Hubs | Mean before → after | Worst before → after | Attempts before → after |
|---|---|---|---|
| Trading | 1.45 s → 0.40 s | 3.0 s → 0.55 s | 2.17 → 1.08 |
| Mining | 0.78 s → 0.28 s | 1.7 s → 0.73 s | 1.33 → 1.25 |
| Farming | 1.86 s → 0.21 s | 8.1 s → 0.32 s | 4.33 → 1.08 |
| Military | 1.75 s → 1.84 s | 4.4 s → 3.2 s | 3.42 → 1.83 |
| Pirate | 0.36 s → 0.19 s | 0.71 s → 0.45 s | 2.58 → 2.58 |

  Trading round share (wheel, concentric, arc): outpost 25% → 46%, station 25% → 56%, hub 4% → 60% (weights say 57%,
  62%, 50%). Military hubs now come out concentric 9 times in 12 (was 5) with two drill halls each, so their mean
  stays about the same.

4. Generator polish:
   - military concentric hubs are the slowest (mean about 1.8 s): two drill halls and 24 guns to furnish. The slow test bounds the hub mean at 3 s and the worst at 8 s;
   - an armour doctrine for walls (navy belts, depots) is not built: every wall is one tile now;
   - wheel hubs with one hub room leave a big empty centre, so wheels are weighted only for outposts and stations;
   - spines have no doubled form for hubs.

## Aliens on derelicts (branch `aliens`, based on `derelict-ingame` plus `art/alien`; not merged; awaiting user review)

- **Sim** (`src/sim/aliens/`, `systems/eggSacs.ts`, `systems/aliens.ts`): `applyRuin` turns the ruin pass's `eggsac` and
  `nest` hooks into `EggSacC` / `NestC` entities (navy combat wrecks still get no alien hooks). A dormant sac (some spawn
  `leaking`, the cracked look) hatches when disturbed: a non-alien within 3 tiles with line of sight, any damage (crew
  attacks, fire), or a neighbour hatching within 6 tiles (1-3 s delay). Stages hatch0 -> hatch1 -> hatch2 (1.2 s each);
  the brood comes out on hatch2 (1 alien per 1x1, 2 per 2x2), then it bursts. Crew can attack a sac (`crew.attack` with
  the sac id; tapping a sac with drafted crew selected) and destroy it before hatch2: no brood. A nest lays a sac every
  60 s while a non-alien is aboard, at most 3.
- **Aliens** are crew entities of faction `alien` (at war with everyone) with no priorities or needs, so only crew combat
  and the alien system run them. `AlienC` leashes them to the ship they hatched on (paths are planned on that grid only;
  idle ones roam within 4 tiles of where they hatched). They never count as invaders (no console objective, no capture).
  They are airless (cross vented decks; decision: aliens do not need air, heat and fire still hurt). At 0 hp they die
  outright and leave a corpse (`SpeciesDef.creature`). Natural weapons: `SpeciesDef.natural`.
  - Hunter (weight 7): fast (3.6), 60 hp, claws 9 dmg / 0.9 s.
  - Brute (weight 2): slow (2.1), 180 hp, armour 0.2, crush 18 dmg / 1.7 s, 35% knockdown (2.5 s stun).
  - Spitter (weight 1): 45 hp, spit 8 dmg range 7 / 2.4 s, backs off from foes within 4 tiles while reloading.
  - All flee from visible foes when badly hurt (`creature.fleeBelow`).
- **UI**: aliens are in the hostiles list, light the combat button, and the first hatch on a ship raises "Hostile
  creatures aboard <ship>". Save v24.
- **Render**: real sac art by state (`eggSacView.ts`); aliens through the crew view with the `art/alien` sheets
  (attack / hurt / dead clips). Placeholder: the spit glob (drawn in code, and the hit lands at once in the sim).
- **Pipeline fix**: `crew_pack.union_box` was dropped by the per-clip crew refactor although `robot_render` and
  `alien_render` import it; restored (the robots family builds again too).
- **User answers (2026-10-20)**: numbers stay; aliens stay on their derelict (no airlocks, shuttles or the player's ship);
  the spit stays visual-only; no light avoidance yet. Done: drafted, armed crew with no order shoot an egg sac they can
  already hit (in range and sight; they never walk to one) when no hostile is in view; a brute's knockdown reads
  "Knocked down" (robots keep "Inert"); "is down" alerts fire for player crew anywhere, not only aboard the home ship.
- Debug: `?shipgen=derelict:civilian&ruin=0.6&cause=decay&genAt=0,45&hook`, Spawn raider, then
  `__cc.aliens(shipId)` lists sacs and aliens; `debug.spawnCrew` with `faction: 'player'` on the wreck sets them off.

## Trade (branch `trade`, based on `main` at 160e20b; not merged; awaiting user approval of the in-game look)

Model, commands, price rules and "how to add a trader or a price" are in `docs/ARCHITECTURE.md` ("Trade"); player-facing rules in
`docs/DESIGN.md` (Economy, "Trade"). New terminology (user decision): **node** (one playable location, formerly "sector"), **sector**
(a group of nodes), **hyperlanes** link sectors. What exists:
- **Sim** (`src/sim/trade/`, `systems/trade.ts`): player credits, `TraderC` wallets and seeded stock, `ItemDef.price`, price model
  (spread x faction x trader kind x tag x reputation), hail rule (relation + reputation, guns-on refuse), offers with barter, deals with
  escrow and a delivery state machine on the existing vehicle commands and cargo hauling, events, save (`SaveData.trade`, optional: no
  version bump).
- **Content** (`src/content/trade.ts`): start 500 credits, item prices, trader kinds `freighter liner mining station` (civilian) and the
  placeholders `corp navy pirate raider`, faction stances. `FactionDef.side` makes generated civilians `neutral`; `GenOrigin.role`
  records the hull family.
- **UI:** Trade button, ship list with Hail, trade window (bottom sheet on phones), credits chip, Hail in the combat panel, trade line
  in the shuttle panel, trade alerts. `?hook` + `?shipgen=civilian` then "Trade" in the top bar.
- **Decisions to review:** who flies (above); the instant station fallback (since removed on `stations`: stations are ships now); a hostile-side ship in combat always refuses
  (its guns lock on you at once), so the reputation thaw only applies to non-shooting ships; payment is escrowed at accept; a run
  carries 40 units; trade commands tick the sim once while paused; credits live in `sim.trade`, not on a ship, so they survive a ship swap.
- **Not done:** hyperlane/sector prices, restocking over time, NPC-to-NPC trade, selling floor stacks (storage only), several runs for
  a big deal, per-faction shuttle livery, art for credits and the trade window (plain UI).

## Galaxy sim (branch `galaxy`, cut from `main` at efd356b; sim only; not merged)

Port of the starmap sim from `starmap-macro-wip` (PR #16, 175 commits behind main) onto today's main. No UI, no app snapshot, no tools, no
visual change. Design in `docs/DESIGN.md` ("Starmap and factions"), model, pipeline and tuning in `docs/ARCHITECTURE.md` ("Starmap").

**User decisions (2026-10-22):**
1. The tier above sectors is a **cluster**, not a "region" (region collides with the sector-grid ship region). Renamed everywhere
   (`clusters.ts`, `ClusterField`, `CLUSTER_*`, `clusterName` / `clusterType`, ids `g.<rx>.<ry>`, docs). The sector name suffix "Cluster" became "Rim".
   When the UI is ported, `REGION_TYPE_LABEL` becomes `CLUSTER_TYPE_LABEL` (and `StarmapRegion` and the `regions` snapshot fields follow).
2. **Trade's reputation keys stay** (`traders`, `corp`, `navy`, `pirates`, `drones`). Events keep `'corp'` (no `meridian`). One faction table: each
   galaxy faction def carries its trade key in `reputation` (navy to `navy`; meridian, helix, vantor to `corp`; traders; pirates; rogue to `drones`).
   `standing()` reads `sim.story.reputation` through that key, no second store; trade's `reputationWith` and `hailVerdict` are untouched.
   `story.context.faction` is the territory owner's reputation key, so `corp` events fire in any corporation's space.

**What exists:** `src/sim/galaxy/*` (terrain, sites, clusters, gates and rift lanes, sectors with layouts and central bodies, generator, route, travel,
arrivals, standing, state), `systems/galaxy.ts` (pipeline, after `captureSystem`), commands `galaxy.jump`, `debug.galaxyReveal`,
`debug.galaxyTeleport`, `debug.chargeFtl`, events `galaxy.*`, `item.fuel` (16 in the starter crate), `content/galaxy.ts` (7 factions, 5 structure kinds,
names), the story `transit` trigger. `galaxy.jump` validates, pays and lifts the ship through the step 9 path (see below).
- **Save v27** (stations took v26 on `main`). `SaveData.galaxy` (chunk keys, regenerated from the seed) plus `generatorVersion`; a save of another generator version is refused.
  Bump `GENERATOR_VERSION` (`galaxy/tuning.ts`) whenever the generator or the galaxy content changes what a chunk key generates.
  **PR #20 (stations) also bumps to 26: whichever merges second takes 27.**
- `sectorEquiv.test.ts` (main's rewrite) runs on a `legacy` content copy whose starter crate has no fuel, and ignores `galaxy.*` events; the pinned hashes
  are unchanged, so the galaxy does not disturb the sim.
- `playerShip` clash: trade's `playerShip(sim): number` kept; the galaxy helper is `playerShipInfo(sim)`. 7d API: `spawnShip` returns the ship id.
- Tests: 19 new (9 `content/galaxy.test.ts`, 5 + 2 slow generator, 3 route). Whole suite 536 (503 fast, 33 slow). The 7x7 and 9x9 chunk tests are in
  `generator.slow.test.ts`.
- **`newGame` now costs about 350 to 450 ms** (warm, seeds 1 to 5; 25 chunks at `FRONTIER_RING` 2; now 270 to 450 ms with 9 chunks at ring 1), almost all of it generation; the review measured
  548 ms cold. Not optimised. Ring 1 is now set; the per-chunk part is small, so most of the cost is fixed (terrain and cluster seeds).

**Step 9 hookup (done on this branch).** See `docs/ARCHITECTURE.md` ("Starmap", Travel). Design choices:
- `galaxy.jump { ship, to, withDocked? }` is the only jump command. The raw `sector.jump` command is **removed**; its lift, archive and restore became the plain
  function `leaveNode` (`sector/jump.ts`), called by `galaxy.jump`, the player's `combat.flee` and `debug.galaxyTeleport` (free). A command never calls a command.
- Node ids are strings everywhere (`Sector.node`, `SectorArchive.node`, `archiveOf`, `restoreArchive`, `sector.jumped`). Save is v27.
- `galaxy.current` moves only after the lift; payment (edge charge and fuel) happens right before it, after every validation.
- **Flee = jump (user decision, 2026-10-22).** `combat.flee { ship, to? }` of the player charges nothing itself: FTL must already be charged, then it jumps to `to`, else
  the cheapest adjacent node it can pay for (fuel, then charge, then id). One escape path. AI ships keep the old flee (`'fled'`, they leave); not routed through `leaveNode`
  because they have no packet or archive.
- Contacts materialise at `sector.deploy`, the first time only; afterwards the archive owns the ships and the descriptors are emptied. All contacts become ships (hostile on
  their combat side, others `neutral`, so civilians can be hailed). Placement is rings around the player's ship with the deploy bounds and gap rule (`freeSpot` replaced `arrivalSpot`).
- The arrival story draw is owed at the jump (`GalaxyState.pendingDraw`) and drawn at deploy. Hostile arrivals only roll in an active node.
- `FRONTIER_RING` is **1** (user decision): 3x3 chunks around the node.
- Also fixed: `edgeBetween(a, a)` matched an edge touching `a`.
- Tests: `content/galaxyJump.test.ts` (materialise on first deploy, archive owns and no duplicates on return, pay only on the lift, draw at deploy, flee, string ids in a mid-deploy save),
  `galaxyJump.slow.test.ts` (determinism and save continuation over a trip), `jump.test.ts` and `combat.test.ts` updated.
- **Still to do:** the **9b UI** (jump confirm listing `jumpWarnings` with the `withDocked` toggles, the deploy picker/modal, empty-world handling while deploying) and the
  **starmap UI** (done in slice 4, below). Structures (`NodeData.structures`) are still descriptors; no grid places them.
Not taken from PR #16: `src/ui/Starmap*`, `src/app/starmap*`, `galaxyPrefetch`, the `bridge` changes, `tools/starmap`.

**User answers (2026-10-22):** `corp` events fire in any corporation's space as now; Helix and Vantor are placeholder names, hailing unchanged; `FRONTIER_RING` 1; fleeing is a jump (one escape path).

**Starmap UI (slice 4, on `galaxy`; visual: needs the user's screenshot approval before any PR).** Ported from PR #16 and restyled to main's design.
- Files: `src/app/starmap{Snapshot,Clusters,Shapes,Nebula,Tone}.ts`, `galaxyPrefetch.ts`, `src/ui/Starmap*.svelte`, `starmapApi.ts` (the types; `api.ts` only gains `starmap`, `planRoute`, `setStarmapOpen`),
  `starmapStyle.ts` (the one place map colours come from: theme tokens only, no hex; danger scale dim, amber, red, never green), `tempDeploy.ts`.
  Regions are clusters everywhere (`CLUSTER_TYPE_LABEL`, `UiStarCluster`, `StarmapCluster.svelte`). `UiStarSector.hull` is gone; galaxy faction defs lost their `color` (the view tints by faction kind: government cyan,
  corporation amber, civilian green, pirates red, rogue text).
- Look: sharp corners, `PanelHead` band with a back tile (`PanelHead` gained `backIcon`/`backTitle`/`backTestId`), icon + value cells for fuel, FTL charge, jumps and days, a `.sheet` card for a node (bottom sheet on phones),
  level tabs and zoom tiles, a small sharp legend. New icons: `map zoomIn zoomOut recenter clock`. The Map tile is the first tile of `NavStrip` (key `m`); the old top-bar text button is gone.
  Hover highlights (node, sector, cluster) with a pointer cursor; `grab` only while dragging.
- Three levels: Sector (nodes, lanes, exits, bodies, nebula), Cluster (sectors as patches), Galaxy (clusters, gates, rift lanes).
- **Flee target mode:** the combat panel's Flee opens the map in flee mode: only nodes one jump away can be picked, the cheapest affordable one is preselected, the card button sends `combat.flee { ship, to }`.
- ~~TEMP auto-deploy~~ (removed by the deploy picker below). In `main.ts`: on `sector.jumped` the renderer
  gets the new sector grid and drops its ship scenes, on `sector.deployed` it shows the ship (`Renderer.resetWorld`); 9b should keep that or replace it with its own handling.
- **Perf:** the world is not drawn while the map is open (`api.setStarmapOpen`). The starmap is no longer built in `createBridge`: outlines and nebula tiles warm in idle slots after load (`bridge.warmStarmap`, one small piece per slot),
  the snapshot is assembled on first open if not yet warm, and the prefetch no longer blocks load (it runs one chunk per few frames, ring 2). Measured in headless Chromium on a dev server, 390x844, median-ish of 4 loads: page ready to `__cc` 2.6 s (4.2 s cold) before, 1.9 s (3.0 s cold) after;
  first map open (click to drawn) 0.9 to 1.1 s before, 0.8 to 0.9 s after when warm (1.0 to 1.3 s if opened within 1.5 s of load).
- **Left:** art for the starmap bodies if wanted.

**Hyperspace, drawer, deploy picker (slice 4b + 9b, on `galaxy`; visual: needs screenshot approval).** Design in `docs/ARCHITECTURE.md` ("Starmap", Travel).
- **Model (user, 2026-10-22):** a jump enters hyperspace; the ship travels the plotted route hop by hop with the map open; "Drop from hyperspace" ends it. **The starmap is turn-based:**
  each hop entered is one turn (`GalaxyState.turn`; shown in the drawer and info row instead of days). The sim steps one hop per 16 ticks only as pacing; the glide on the map is a fixed
  700 ms tween (visual only). The packet is lifted and frozen during hyperspace. `onTurn(sim, turn)` (`galaxy/turn.ts`) runs once per hop and emits `galaxy.turn`; it is otherwise a no-op.
- **Choices I made:** FTL charge is paid once on entry (the largest any hop needs); fuel per hop as entered, the trip stops where it cannot pay; `galaxy.drop` mid-hop finishes the hop and drops at the
  next node (no wasted fuel, no falling back), at a node it drops at once; the node's ships appear (archive restored, or contacts materialised on first entry) at the drop, so the deploy picker shows them.
- **UI:** click a far node to plot (route highlighted, drawer shows sector info, fuel info, the hops); click the same node again to go (the drawer's Jump is the same thing, for touch). A jump that would leave
  crew or shuttles behind opens a confirm step in the drawer (docked hostile shuttles get a toggle that fills `withDocked`); with nothing to warn about it goes straight away. In hyperspace the drawer
  shows progress and Drop from hyperspace; closing the map shows a cheap hyperspace view (CSS streaks, status, Open starmap, Drop). After a drop the deploy picker (flat sector map, valid spots
  highlighted, keep-out frames, a ghost of the ship, Best spot, Deploy here) replaces the old TEMP auto-deploy. Flee from the combat panel opens the map in flee mode.
- **NEXT SLICE (user decisions 2026-10-22, not built): NPC traffic and interdiction.** A large slice, likely split into (a) the turn clock and NPC movement, (b) crossings and encounter events,
  (c) the event grid and interdiction UI.
  1. **Turns also tick from game time:** a fixed amount of in-node game time makes a map turn in the background, so NPCs can drop into a node the player has sat in alone. Proposal: **1 turn = 60 sim
     seconds** (1200 ticks, the same as `ARRIVAL_EVERY_SEC`). `onTurn` is called from both triggers and both share `GalaxyState.turn`. Rule against double counting: the time accumulator runs only
     while the sector is active and is reset when a hop's turn is taken and at `sector.deploy`, so a hop never also fires a time turn for the same stretch.
  2. **Crossing:** travel happens between turns. The player and an NPC passing each other on the same lane in the same turn (opposite directions or overlapping segments) count, and so does ending the turn in the same node.
  3. **Interdiction:** the player chooses evade (a roll), bribe (credits) or fight (drops into combat).
  4. **Where fights happen:** a separate deep-space pocket, an event grid: a temporary node holding the player's packet and the interdicting ship(s); afterwards travel resumes or the player continues from there.
  5. Crossings can trigger pirate interdiction, trader hails, patrol scans and distress calls.
  6. **NPC fleets are persistent:** the ships moving on the map are the same entities or descriptors that become real ships in a node the player enters and leave the node's archive when they depart; galaxy
     contacts and node archives must stay consistent with NPC movement.

**NPC traffic, slices (a) and (b) (branch `npc-traffic`, cut from `main`; sim plus starmap markers; visual: needs screenshot approval).** Design in
`docs/ARCHITECTURE.md` ("Starmap", NPC traffic). Save v34 (`galaxy.turnClock`, `fleets`, `encounters`, `nextFleet`); `GENERATOR_VERSION` unchanged (no chunk output changed).
- **Built:** the turn clock (hop turns and 60 s game-time turns share `GalaxyState.turn`; `onTurn(sim, turn, cause)`), persistent NPC fleets that move one hop per turn
  and materialise in / lift out of the player's live node, crossing detection, encounter kinds (`interdict`, `hail`, `scan`, `distress`) stored as pending encounters,
  interdiction halting the trip, `galaxy.dismissEncounter` (a stub), starmap markers (sector level) and a Traffic list in the node drawer, and an alert per encounter.
- **Planner's calls (user decisions above are followed as written):**
  1. Fleet ships are `Contact` descriptors, materialised by `spawnContact` (the one spawn path). Leaving a node, the fleet's ships are lifted out with `liftShip` and the packet is
     dropped, so **damage does not carry over** and a node's archive never holds a fleet ship (no duplicates by construction). `stampPacket` could keep the packet later.
  2. The player leaving lifts the fleet ships first (`galaxy.jump`, flee, teleport), then the archive freezes the rest. Fleets are descriptors everywhere the player is not.
  3. Crossings are decided when the player's hop ends, from the fleet's step of the same turn (`moved`/`from`/`node`): `pass` (opposite on a lane), `overlap` (same way on a lane),
     `node` (the turn ends in one node; a fleet resting there counts). A stationary player (a time turn) gets no encounter: arriving fleets just materialise.
  4. Kind from faction and role: hostile pirate/raider interdicts, a damaged non-hostile fleet is `distress`, patrols `scan`, everything else `hail`. Roles follow the faction kind
     (government patrol, corporation 70% trader / 30% patrol, civilian trader, pirates `pirate`, rogue `raider`). A fleet is not met again for ENCOUNTER_COOLDOWN (6) turns.
  5. Interdiction: the trip's route is cut at the node reached and it drops there (`galaxy.interdicted`); `galaxy.jump` is refused (`interdicted`) while one is pending, except the
     player's own flee. Pending encounters expire (3 turns for alerts, 6 for an interdiction) and `galaxy.dismissEncounter {id}` clears one; slice (c) replaces both with `resolveEncounter`.
  6. Spawning is hashed from (seed, turn, slot), never the galaxy Rng: 2 tries a turn at 40%, cap 14, origins and destinations among the nodes within 6 jumps of the player (all
     generated), stations weighted x2, never spawning at the player's node. 28 tries at 50% seed the first turn. A fleet lives 14 to 36 turns and despawns at a destination once it is
     spent, or when it falls out of the area. 7% are stranded and damaged (they never move; `distress`).
  7. A live node holds at most FLEET_NODE_SHIPS (3) other ships when fleet ships materialise (the sector is 200x120 and the deploy gap rule needs room); the rest wait as descriptors and
     are retried each second. A fight or a live trade deal holds the fleets in the player's node in place.
  8. Sensors: markers and the Traffic list show fleets within SENSOR_HOPS jumps of the current node only.
- **Slice (c) needs:** an `Encounter` UI (`map.encounters` is not in the snapshot yet; read `sim.galaxy.encounters`), the event grid node and choices that end in `resolveEncounter(sim, id, outcome)`
  (evade = roll, bribe = credits, fight = drop into combat with the fleet's ships, which `fleets[].ships` already describe), replacing `galaxy.dismissEncounter`, and fleet ships entering
  the grid (use `materialiseFleet`-style spawning into the pocket). Damage persistence (packets) if wanted.

**NPC traffic slice (c): resolving encounters (branch `npc-encounters`, cut from `npc-traffic`; visual: needs screenshot approval).** Design in `docs/ARCHITECTURE.md` ("Starmap", Encounters and event grids). Save v35.
- **Built:** `galaxy.respond { encounter, choice }` (replaces `galaxy.dismissEncounter`), the event grid (`event:<encounter id>`, a pocket outside the map), `galaxy.leaveEvent`, an encounter card in the
  starmap drawer (fleet, threat, choices with odds and prices, outcome line), an event-grid card in the game view (Resume travel / Flee), alerts for the roll, the bribe and the drop.
- **Planner's calls:**
  1. An interdiction halts the ship **in hyperspace** (`Travel.phase 'interdicted'`) instead of dropping it at the node: the trip is still there to resume, the starmap stays locked, and the drawer is the
     place to answer. `galaxy.drop` is refused until it is settled; interdictions never expire (no turns pass while halted), alerts still expire after 3 turns.
  2. Evade odds = 0.3 + evasion - 0.05 x strength, clamped [0.05, 0.9] (evasion is already engines x pilot skill, 0..0.75). Bribe = 12 x strength x (1 + 0.4 x danger) x (1 - 0.05 x standing, clamped [0.5, 2]),
     min 10. Strength = sum of 1 + 0.5 x depth per ship. Constants in `galaxy/tuning.ts`.
  3. Fight and rescue use the same event grid. The deploy picker places the player (same compact picker; the node name reads "Deep space"). The fleet is out of `fleets` while inside; survivors return as
     descriptors with a fresh cooldown, destroyed or fled ships are forgotten, a fleet with none left is gone. Damage does not carry over (as before).
  4. Leaving: free when no hostile ship is active; with hostiles about it needs a charged drive and spends it (a flee). The player's `combat.flee` in the grid is the same command. The player's crew or
     shuttles left outside the packet are lost with the grid.
  5. Hail and scan only acknowledge (no trade-hail hookup, no contraband fine). Distress `respond` works only in hyperspace (alerts last 3 turns); helping earns +2 reputation on the fleet's key.
  6. The grid draws nothing from the map: no turn clock, no arrivals, no story draw (`onDeployed` returns early), `galaxy.jump` and teleport refused (`inEvent`).
- **Not done:** salvage of the rescued ship, damage persistence for fleets, contraband fines, trade hail from the hail card.

**User decisions 2026-10-22: living world (rework of NPC traffic in 4 stages, after the user reviewed `npc-encounters`).**
- Turns: game-time turns are 3 minutes minimum (was 60 s); hops still each count as a turn.
- Fleets lean very strongly to ONE ship. Group size scales with ship size via a size budget: a navy patrol can be two small ships or one heavy; traders, civilians and miners are always single ships; pirates mostly a single small ship, occasionally a pair of small ones.
- Spawning and deleting fleets is the wrong model. NPCs have lives of their own outside interactions with the player (stages 2-4): a persistent population with home ports (stations, dens, depots, mining outposts) sized by port; ships live until destroyed; agendas per role (traders run buy-low/sell-high between stations; miners go to fields and back; patrols cycle their territory and chase pirates; pirates prowl near their den, rob traders and return); losses are rebuilt slowly at the home port; only the area near the player is simulated per turn, far regions catch up deterministically on approach.
- Passing a non-hostile fleet should usually NOT produce an event.
- Interdiction is a MODAL in the centre of the map screen, not a sidebar card.
- Evade: a very skilled pilot should get around 80%.
- Arrival warning: when a ship is travelling to the player's node the player gets a warning like "<ship> drops from hyperspace in 2 turns" (hostile = danger styling).
- Damage not carrying over is noted as wrong but deferred.
- **Stage plan.** 1: turn length, quiet passing, pilot-driven evade, interdiction modal, arrival warnings (done, below). 2: persistent population with home ports, single-ship fleets with the size budget, per-role agendas, rebuilds, near-player simulation with deterministic catch-up. 3: a SIMPLE economy (traders move real station stock and nudge prices; keep it small). 4: off-screen NPC-vs-NPC encounters decided by a stats mini-sim (three heavy navy battleships beat one small pirate) with real consequences (losses, wrecks, distress calls) and a news/rumours feed.

**Stage 1 (built on `npc-encounters`; save v36).**
- `TURN_SEC` 180 (the no-double-count and reset rules are unchanged). `ARRIVAL_EVERY_SEC` stays 60.
- Non-hostile crossings: `passingMeets(sim, fleet, turn)`, a hash of seed, fleet and turn against `PASSING_ENCOUNTER_CHANCE` (0.12), gates a hail or scan (the `galaxy.crossing` event is still emitted). Distress from a stranded fleet and hostile interdictions always happen.
- Evade formula (`galaxy/encounterOdds.ts`, constants in `tuning.ts`): `pilot = clamp(piloting skill / 5)`, `engine = clamp(raw engine evasion / 0.12)`, `odds = (0.32 + 0.57 x pilot) x (0.6 + 0.4 x engine) - strength x 0.06`, clamped to [0.05, 0.9]. The helm's skill is stored on `Combat.pilot` by `helmSystem` (new saved field, hence v36); no pilot or no powered engines means ship evasion 0 and the minimum 0.05. Against a lone depth-1 pirate (strength 1.5): skill 5 with one engine 0.80, skill 3 (pilot role) 0.60, skill 1.5 0.40, skill 0 0.23, half the engine power at skill 5 0.62; three depth-3 ships (strength 7.5) bring a skill-5 pilot to 0.45. The roll stays `unit(seed, encounter id)`.
- Interdiction UI is `ui/InterdictModal.svelte`, centred over the map area of `StarmapView` (a bottom sheet on phones); hail, scan and distress stay in the drawer.
- Arrival warnings: `incomingFleets(sim)` (`galaxy/incoming.ts`, pure query: fleets in sensor range whose route reaches the player's node, ETA = place in the route, nearest first, stranded fleets excluded) feeds `alerts.syncIncoming()` (app, called from `onEvents`), which keeps one alert per fleet ("<faction role> drops from hyperspace in N turns", kinds `galaxy.incoming` / `galaxy.incomingHostile`), updates it in place, drops it on arrival or a change of course, and does not re-raise a dismissed one for the same trip.

**Stage 2: persistent population (built on `npc-encounters`; save v37; `GENERATOR_VERSION` unchanged: chunk output is the same).** Design in `docs/ARCHITECTURE.md` ("NPC population").
- **Model:** no spawning or despawning. Every NPC ship belongs to a home port and lives until destroyed. Ports are derived from node structures (station, pirate den, navy depot, mining outpost, drone nest);
  a port's size (1 to 3) and kind set how many fleets it fields. Fleets are created when their chunk is generated (`populate`, about 1 ms for nine chunks), named, and saved as descriptors (about 350 bytes a fleet).
- **Budgets (content, `content/galaxyFleets.ts`, per galaxy faction):** size costs small 2, medium 3, heavy 4. Navy patrol budget 4 = two small, one medium or one heavy (or budget 2 = one small); pirates mostly 2 (one small), a fifth 4 (two small),
  sometimes one medium; traders, civilians and miners `maxShips: 1`; drones up to two. Hull families map to size classes (navy corvette small, frigate medium, cruiser and carrier heavy; civilian mining small, freighter medium, liner heavy;
  scrapper raider small, hauler and gunrunner medium; drones picket small, lancer medium, swarm heavy). A ship's generator seed is searched so its first attempt builds the family asked for (`previewHull`).
- **Agendas:** rest at home, an outing of a few stops, home. Traders: stations within 6 hops, dwell 2 to 4 turns, `onDock` hook (`dock.ts`) for stage 3. Miners: one of the three nearest ore fields within 4 hops of home. Patrols: nodes of their faction's territory within 4 hops of home.
  Pirates and raiders: any node within 3 hops of the den or nest. All one hop per turn.
- **Losses:** a wrecked or captured ship is gone; its port owes a replacement (one every 12 to 20 turns by port kind, a single-ship fleet of the lost role and size). A ship that jumps away survives (its fleet runs for home). Distress comes from real damage (a disabled or under-40% ship
  strands its fleet) or a rare breakdown (0.15% per hop away from home); stranded fleets repair themselves after 12 to 24 turns unless rescued.
- **Scale:** only fleets whose node or home is within 6 hops of the player are stepped; the rest are frozen and caught up on approach, turn by turn up to 40 turns (exact), else home plus the last 40 turns (deterministic, the cycle phase differs).
- **Planner's calls:**
  1. Free traders also keep ships at any market (trade or research station) whoever owns it (weight 3 against the owner's own groups), so navy trade stations still have merchants. Navy hulls are patrol-only, civilian hulls trader or miner, so corporations field both.
  2. Mining outposts are asteroid fields a faction owns in its territory (only factions that field miners); drone nests are derelicts in rogue territory. No new structures were added, so chunk generation is untouched.
  3. A port homed in the player's own node (the start station) starts its fleets one hop out and coming in, so nothing materialises around a new game. Hostile stranded fleets only hail (no interdiction from a hulk).
  4. Ship names are `prefix + name` per faction (CNS, MCV, HBV, VHI; free traders "Lucky Margin"; scrappers "Rust Jackal"; drones "Unit Reap 31"), unique among living ships; a fleet shows as its first ship, "+n" for the rest.
  5. Hostile arrival rolls (`rollArrival`, while the player stays) and node contacts are unchanged: they are node ships, not fleets.
  6. Damage still does not persist beyond "crippled strands the fleet"; salvage, NPC-vs-NPC fights and the economy are stages 3 and 4.
- **Perf (headless, one core):** `newGame` cold is 270 to 340 ms (seed generation as before; baseline commit measured 275 to 336 ms), warm 3 ms; a turn with a full area (19 simulated fleets of 132 in an 81-chunk world) 0.12 ms, baseline 0.10 ms with 14 fleets;
  catch-up of a whole area after 300 turns away 2 to 4 ms. The real cost of a turn is materialising a ship in the player's node (generator, about 20 to 50 ms), unchanged.
- **Tests:** `content/galaxyPopulation.test.ts` (determinism, rosters match port kind and size, budgets and caps, agendas, nothing disappears, rebuild after N turns, catch-up equivalence, save mid-trip, materialise and lift without duplicates, stranding, fled ships),
  `.slow.test.ts` (all port kinds over four seeds, long run, catch-up beyond the cap); `galaxyTraffic` and `galaxyEncounters` updated; the arrival-warning alert test checks the ship name.
- **Next:** stage 3 (below, done); stage 4, off-screen NPC-vs-NPC encounters with consequences and a news feed.

**Stage 3: a simple NPC economy (built on `npc-encounters`; save v38).** Design in `docs/ARCHITECTURE.md` ("NPC economy"). Small on purpose.
- **State:** `GalaxyState.markets[portId] = { turn, stock }`, only the items whose level differs from the port's baseline; no entry = baseline at turn 0. `Fleet.cargo` (item, count lines) and `Fleet.pick` (the stop a trader bought for). `Trader.port` / `Trader.base` on a live station that is a port's market.
- **Market model** (`galaxy/market.ts`): baseline = the port's trade profile stock (`rollTrader`, so a live station shows the same economy); each turn a stock moves 4% of the way to `baseline + net / 0.04`, net = (production - consumption) x port size; clamped to [0, cap], cap = max(40, 3 x baseline). Closed form, so a frozen port catches up in one step over any gap (no loop, no cap on the gap) and an untouched port is "matured" the first time anyone looks.
- **Production table** (`content/galaxyMarket.ts`, per turn at size 1): mining outposts dig iron ore 2, metal 1, ice 1, rare ore 0.2 and eat rations 1, parts 0.2; farms grow rations 3, ice 0.5 and eat polymer, parts, metal; trading stations make electronics 0.4, polymer 0.5 and eat rations 1.5, electronics 0.5, parts 0.4, metal 0.8, missiles 0.2; depots eat rations, metal, parts, missiles, electronics; dens make scrap 1 and eat rations, ice, parts, electronics. Port kind picks the profile (station: trading, 30% farm by hash; den: pirate; depot: military; outpost: mining; nest: no market).
- **Prices:** `unitPrice` gets one extra factor, `stockFactor(stock, baseline) = clamp(1 + 0.6 x (baseline - stock) / max(baseline, 20), 0.5, 1.6)`, applied only to a live station bound to a port (`Trader.port`); plain stations and every existing trade test are unchanged. NPCs compare `marketValue` (base price x kind mods x the same factor, no spread).
- **Traders** (`galaxy/dock.ts`, `onDock(sim, fleet, port, stops)`): sell the whole cargo into the port (what does not fit under the cap is dumped), then for each of the nearest 6 next stops price every commodity here and there and take goods whose price there beats here by 15%, best margin first, up to half the stock and the hull cargo (small 20, medium 40, heavy 80 per ship). The stop with the most profit becomes `Fleet.pick` and the agenda goes there (else it picks as before). Credits are not tracked (ports are bottomless). Miners load 80% iron ore and 20% rare ore at a field and sell it into their home outpost.
- **Sync with the live station:** entering a node (`drop`) or each turn binds unbound station traders to the node's ports (profile, baseline and stock from the market), leaving (`jump`, flee, teleport) writes the trader's stock back as the port's state. While bound the trader is the only copy (player deals and NPC docks both change it); each turn it steps toward its level with a hashed dither so slow rates still show.
- **UI:** the node drawer shows a "Market" line (up to two cheap goods with a down chevron, two dear with an up chevron) for nodes in sensor range, and "Carrying 40 Ration" on a trader's row.
- **Planner's calls:**
  1. No credits for NPCs: a trader's gain is only visible as goods moving; a wallet would be one more number to balance for no gameplay yet. Easy to add on `Fleet` later.
  2. A market is touched lazily (a dock, the player, the UI), never per turn, so the per-turn cost is the docks only. Markets of ports no fleet visits stay at their level and never appear in the save.
  3. NPC trades use the mid price (no 1.25/0.6 spread), otherwise no price gap could ever beat it; the player still pays the spread.
  4. Galaxy nodes do not spawn live stations yet (only `debug.spawnStation` does, pending the sector refactor), so the live sync binds whichever station traders stand in the player's node to its ports, matching by profile first and then in order.
  5. A live station's profile is overwritten with its port's, so prices match the galaxy market even for a debug station of another kind.
  6. The live market is paused for time the player is away and during a stay it moves one dithered step per turn; a station destroyed while live loses its stock (the stale entry stays valid).
  7. Only ten commodities are traded by NPCs (`market.goods`); weapons and vehicles only follow the price factor on the player's side.
- **Perf (headless, one core, 6 seeds x 280 turns, 25 to 34 fleets):** turn 0.083 ms average against 0.025 before; the worst turn 12 ms when the first docks build their economies (cached per port). A market read or catch-up is O(items) (about 12), so no catch-up cost to speak of.
- **Tests:** `content/galaxyMarket.test.ts` (production and consumption, prices from stock, drift and bounds, closed-form catch-up equals stepping, trader buys low and picks the more profitable stop in either order, nothing when no stop pays, full shelf, miners deliver, a running world, save mid-trip with cargo, live bind / player trade / write-back / jump away and back).
- **Next:** stage 4, off-screen NPC-vs-NPC encounters with consequences and a news feed.

**Node population (built on `npc-encounters`; save v39).** Design in `docs/ARCHITECTURE.md` ("Node population"). Before this a galaxy node was an empty grid when the player dropped in (only `debug.spawnStation` made a live station), so the stage 3 market sync had nothing to bind. Now a node's structures become real on the player's FIRST drop (`populateNode`, `galaxy/populate.ts`, `populateSpawn.ts`).
- **What becomes what:** a station structure is a generated station (kind and size from its port: den = `station.pirate`, depot = `station.military`, a market = the kind its trade profile names, trading or farming; port size 1, 2, 3 = outpost, station, hub), made by `spawnStation` (crew, security, trader, director) and bound to its port market (`bindStation`), so player trades move the world economy. An asteroid field is a field of rocks (`generateAsteroid` + `stampAsteroid`); a field that is a mining-outpost port also gets a surface mining outpost on a big asteroid (`generateOutpost` + `stampOutpost`), bound to the port. A derelict is a ruined wreck of the node's faction (any non-rogue faction in unclaimed space); a drone nest (derelict in rogue space) is a heavier ruin of the rogue AI, infested with robots (the existing `ruin` pass). Every spawner is a function of (galaxy seed, node, structure index).
- **Once only:** `NodeState.populated`. After the node is left its archive owns the stations, rocks and wrecks; a return restores, never repeats. Order inside `drop`: archive restore or contacts, fleets, then population (east of everything already there), then `bindMarkets`. The start node is populated by `newGame(seed, content, ship, true)`, which `main.ts` asks for; the default stays an empty node so the many tests that start in an empty sector are unchanged. The starter ship is never moved: structures go at least 70 tiles from the west edge and 30 tiles east of everything before them.
- **Layout:** west to east in structure order, centred on a mid line with a small hashed offset; the sector grows (width and height) to hold them, as it does for hubs.
- **Planner's calls:**
  1. A pirate den in a node that also has an asteroid field is not an orbital station but a dug pirate outpost (the existing hidden-in-rock style, `style: 'dug'`, `hidden`), so the player finds only a big rock until the base is discovered; with no field nearby it is an orbital pirate station. The dug base is always the `outpost` tier (the generator has no bigger dug bases). A dug den is bound to the den market like any other.
  2. A mining outpost is a field AND a surface outpost (two things in the node), since miners work the field and sell to the outpost.
  3. Research stations are built as trading stations (no research station kind exists); non-port stations use the `station` tier.
  4. Derelicts: the node's faction hull when it has one (a navy node has navy wrecks), else a hash pick over the non-rogue factions; cause and intensity from the seed (nests are always combat ruins at 0.7).
  5. Hubs are real: a size 3 port makes a hub (up to about 150 x 150 tiles). Generation is the cost (below); no cap was added.
  6. Structures that fail to place (the generator refuses a seed, no layout) are skipped rather than retried; the node is still marked populated.
- **Perf (headless, one core, noisy machine):** a first drop populates in a median of 22 ms (40 structured nodes over 7x7 chunks), worst 430 ms (a size 2 navy depot), a hub-size market or depot in the 300 to 600 ms range; return visits cost nothing (the archive). The start node adds about 300 ms to a new game with a trade station (seed 3: 11 ms warm to 316 ms; seed 21: 363 to 626 ms cold, the chunk generation dominates).
- **Tests:** `content/galaxyPopulate.test.ts` (stations, outposts, dens dug or orbital, derelicts and nests, layout and gap, restored not duplicated, determinism whatever was visited first, save and load, station bound to its port and a player deal moving the port market, the start node).
- **Next:** stage 4 (below).

**Stage 4: off-screen life (built on `npc-encounters`; save v40).** Design in `docs/ARCHITECTURE.md` ("Off-screen life"). The world now fights without the player.
- **Mini-sim** (`galaxy/clash.ts`, tuning in `tuningWar.ts`): when fleets of factions at war meet outside the player's node, a stats mini-sim decides it ("three heavy navy ships against one small pirate: the winner is obvious"). Ship power = size class (small 1, medium 2.4, heavy 5) x role (patrol 1.25, pirate 1, raider 1.1, trader 0.12, miner 0.1) x (1 + 0.08 x depth); a fleet's power is the sum, halved while stranded. Each side's power is scaled by a bounded random factor (+-35%), and the share p decides: p >= 0.82 the loser is destroyed (the winner is hurt with chance 1.6 x (1 - p)); p >= 0.62 the loser is driven off (each ship lost with up to 0.7 chance, survivors run home); otherwise a draw: both stranded and each ship lost with 0.15. All rolls are hashes of (seed, both fleets, turn). Overwhelming strength decides (three heavy patrol ships against a small pirate: the pirate is destroyed in over 99% of the fights it does not avoid); an even match varies (driven off, draws, either side winning).
- **Who fights:** factions at war (relation sum <= -0.3 either way, or the rogue AI against anyone) with at least one armed role (patrol, pirate, raider): two haulers never fight. Pirates (not drones) avoid a patrol with under 45% of their strength (80% of the time): no fight, they run home. Patrols and pirates also hunt: with chance 0.6 per planned leg a patrol makes for a pirate or raider it can take, a pirate for a trader or miner (never a patrol), within its normal range (`agenda.ts` `hunt`); without it armed fleets would hardly ever meet, since territories hardly overlap.
- **Detection** (`meetings.ts`): each turn, among the fleets that stepped, outside the player's node (a fleet in it, or that just left it, never takes part): opposite directions on one lane (settled at a hashed end), or the same node at the end of the turn. A fleet fights at most once per turn; fleets and nodes go in id order. Frozen fleets that catch up play their meetings too (`catchUpFleets` takes an `after` hook), among the fleets caught up together.
- **Consequences:** a destroyed ship is forgotten, its port owes a replacement (stage 2 rebuilds), and its hull becomes a wreck waiting at that node (`NodeState.wrecks`, at most 4 a node); the next drop there (first visit or return) generates the same hull ruined by combat, nobody moved in (`spawnDerelict`, `placeWrecks`), east of everything, found and salvaged like any derelict. A driven-off side runs for home (`retreat`); a patrol that drove a pirate off follows it two hops (`chase`). Stranded survivors call for help (`strand`: the stage 2 breakdown path, a navy patrol gives a distress call, repaired alone after 12 to 24 turns). A pirate or raider that wins takes the loser's cargo (all of it from a destroyed fleet, half from one that ran, up to its hold), heads home and sells it into the den market on arrival (`dock.ts`).
- **News** (`galaxy/news.ts`, `GalaxyState.news`, at most 40): facts only (kind, turn, node, who, faction, foe, item): destroyed, raid (a patrol destroyed a ship at its den), driven off, clash, trade route cut (a trader lost where there was nothing to take; with a pirate's loot the loot line says it), loot, shortage (a trader took a shelf under 10% of its baseline; once per port and item per 80 turns), rebuilt (a port launched a replacement). `newsFeed(sim)` marks each item precise (its node is within sensor range) or not; `app/newsSnapshot.ts` words them: precise news names ships and places ("CNS Valiant destroyed Rust Jackal", Kessa Alpha), distant news is a rumour (factions and the sector only, italic and dim, "Rumour"). UI: a News tile in the starmap's tool column opens `ui/StarmapNews.svelte` (PanelHead, theme tokens, 14 items, age and place under each).
- **Planner's calls:**
  1. Meetings are rare by nature (pirates live in their own dangerous space, patrols and traders in safe space, and hunting only reaches ranges of home): the start area (navy and free traders) has none, pirate country near a den with traders and patrols around has a few dozen a thousand turns. Tuning lives in `tuningWar.ts` (`HUNT_CHANCE`, `WIN_ALL`, ...).
  2. Meetings never touch ships: no real fights are simulated, no damage state beyond stranded, and a fight in the player's node stays real combat.
  3. Wrecks are the exact ship that died (same generator key), ruined 0.6 by combat, never infested; they sit east of everything at the node, in a revisited node too.
  4. Frozen fleets that catch up meet only each other, so a catch-up equals stepping when the whole region is caught up together (tested over 40 turns); a fleet rebuilt during a long catch-up cannot meet within it.
  5. News turn stamps are the fleet's own turn, so a catch-up reports its past turns at the right turn. News ids have their own counter (`nextNews`), so a log entry never shifts the ids fleets are made with.
  6. A lane meeting is settled at a hashed end of the lane, which is where the wreck and the news go.
- **Perf (headless, one core, 600 to 1000 turns):** 0.03 to 0.11 ms a turn with 3 to 15 simulated fleets (the busiest start areas of 24 seeds: 15 fleets 0.086 ms, 13 fleets 0.058 ms; pirate country around a den 0.11 ms), against 0.083 ms for 25 to 34 fleets in stage 3 (a simulated area is only the fleets within 6 hops). Meeting detection is a group-by over the fleets that stepped. A 400-turn replay is byte for byte the same; save and load round-trips the log and the waiting wrecks. Full `npm run check` (134 files, 775 tests, slow tier included) and `npm run build` pass.
- **Tests:** `content/galaxyWar.test.ts` (strength decides: three heavy patrol ships against a small pirate, an even match varies, haulers are prey, a pirate avoids a strong patrol, determinism, who fights; destroyed ships leave wrecks, owe rebuilds and make news; the wreck is found on the next drop once, also at a node visited before; driven-off runs home and the patrol chases; a draw strands both and the patrol sends a distress call; the pirate's loot reaches the den market; the player's node is exempt; lane crossings; the log is bounded and precise only in sensor range; a 400-turn world replays identically; save and load; catch-up equals stepping, fights included), `app/newsSnapshot.test.ts`.
- **Not done:** salvage of an off-screen wreck beyond what derelicts already allow, damage persisting for fleets (still only "stranded"), a news alert when the player is nearby, rebuilt fleets meeting inside their own catch-up.

## Crew sprite pipeline (branch `crew-pipeline`; merged to `main` with user approval)

Details in `tools/blender/README.md` (Crew layers, Incremental builds) and `docs/ARCHITECTURE.md` (Asset pipeline, Crew).
- **Per-clip sheets:** `crew.human.torso.tee.walk` (+ `.glow`), one per item and clip; layer ids are unchanged and the manifest
  layer lists `clips.<name> = {sheet, start: 0, frames, fps, loop}`. Items only get the clips they need (no `sit_*` for
  `gear.back`, `eva_float` only for body and suit). Runtime: `resolveClip` (`src/render/loadout.ts`): a missing clip plays idle,
  a missing `sit_idle` hides the layer (a standing pose would clip through the chair), `sit_work` falls back to `sit_idle`.
  Robots keep their single-sheet format (`LayerAsset.sheet`, clip without `sheet`); the loader handles both.
- **Fixed frame:** `crew_spec.py`, 128x120, feet anchor (64, 94) (was a union box of 104x91 / 52,76). Current gear needs 76 above,
  15 below, 52 to each side. Changing it re-renders all crew.
- **Render cache:** `.cache/sprites/crew` (gitignored). `npm run sprites -- -- public/assets crew [--item S] [--clip C] [--force] [--plan]`
  renders only misses and prints hits/misses. Keys cover the item's geometry digest, its holdout items, the clip (its own pose code
  only) and the global inputs (rig, GLB, render code, palette, frame). Item registry `human_items.py` and clip table
  `crew_clips.py` are outside the global hash on purpose. A changed default item re-renders the layers above it (inherent).
- **Numbers (4 cores):** old full crew build 40m15s (7400 frames). New full build 29-38m (6296 frames; the spread is machine
  load); re-run 100% hits 2-4 s; new dummy item 65 s (248 frames); new dummy clip on all items 94 s (400 frames); one forced
  item+clip 17 s. Reverting a dummy returns the manifest byte for byte.
- **Not pixel-identical to the old sheets, and cannot be:** Cycles hashes its per-pixel sample jitter from the pixel position in the
  canvas, so the larger canvas (art shifted 12/18 px) re-rolls shading: 0.01% of pixels change silhouette, 14.7% of opaque pixels
  one shade band (silhouettes and look unchanged; `crew_check.py` sheets and in-game screenshots match). Rebuilding the OLD code
  reproduces the committed sheets exactly. Compare tool: `tools/blender/review/crew_sheet_compare.py <old dir> <new dir>`.
- **Bug fixed on the way:** `human_base.Regions` picked the dominant bone of a face with `max(set(...))`, so ties depended on the
  string hash seed and the body/arm/torso geometry differed between processes (4 faces). Now sorted: builds are deterministic.
- **Sampling-noise caveat:** a single entry re-rendered in another process after a scene change can differ at a few pixels; the cache
  is the source of truth.
- **Follow-up (not built):** render rigid, non-deforming gear once per direction and attach it per frame at runtime
  (needs per-frame attachment offsets in the clip data); robots on the same per-clip layout and fixed frame; lazy loading of
  clip sheets (now about 200 crew images load up front).

## Event system (branch `events`, based on `eva`; not merged; awaiting user approval of the in-game look)

Design in `docs/DESIGN.md` (Exploration & events); schema and "adding an event" in `docs/ARCHITECTURE.md` (Events). Sim in
`src/sim/story/` (no grids or sectors: context is a parameter, physical outcomes are stubbed into `story.physical`), content in
`src/content/events.ts` (11 starter events), UI `StoryModal.svelte` (centre card / phone bottom sheet) plus notices through alerts.
- Decisions pause the game (bridge holds the speed until `chooseStory`). Periodic draws are off until `story.setContext {periodicSec}`;
  `main.ts` sets one draw per 3 min, danger 1, no faction.
- Open: physical outcomes are not realised (after the sector refactor add a system that consumes `story.physical`); no implant system
  exists (`ImplantsC` is a placeholder events read); reputation lives only in `story.reputation`; `item` requirements and `items`
  effects use all player-ship storage (grid-independent); crew skill xp is new (`SkillXpC` + a stat modifier source).
- Debug: `?hook` then `__cc.fireEvent('event.distress_call')`.

## Needs: hunger, food and mood (branch `needs`, based on `eva`; not merged; awaiting user review)

Rules and values are in `docs/DESIGN.md` (Crew, "Needs and mood"). What exists:
- **Sim:** `Needs.hunger` (lazily created for player-side crew of a species with `SpeciesDef.hunger`; robots have none),
  `EatC` (trip and meal), `MoodC` (score, factors and memory counters). `crew/eating.ts` (`goEat`: galley else a crate with
  food; `decide` calls it after the sleep check), `systems/needs.ts` (decay, meal countdown), `systems/mood.ts` (staggered
  recompute), `crew/mood.ts` (factors, `moodModifiers` registered in `stats.ts` for work speed, `breakdownRisk` hook).
  Starvation harm is in `vitals.ts`. Events `crew.ate`, `crew.starving`, `crew.moodLow`. No save version bump: everything is
  optional or created on use.
- **Content:** `item.ration` (`food: { nutrition: 50 }`), `recipe.ration` (2 scrap -> 3 rations, 40 work ticks), `module.galley`
  (2x1, -3 power, `crafting` + `galley`, cost 8 metal + 3 electronics), human `hunger: { decayPerSec: 0.12 }` and `mood: true`.
  `ShipTemplate` modules gained `orders` (the starter galley keeps 12 rations; the starter crate holds 12).
- **UI:** hunger and mood bars with the factor list on the crew card, `crew.starving` (danger) and `crew.moodLow` alerts, the
  galley in the module build menu. `?hook` `stage.needs(crew, hunger, rest?)` and `stage.mood(crew)` for screenshots.
- **Art needed (placeholders now):** `module.galley` (+ `.active` while printing, rotations) is the fabricator tinted mint
  through `fallback.ts`; rations draw as the plain crate (`item.ration.s/.m/.l/.held` and a UI icon); no eating pose (the crew
  member stands idle at the galley's access tile); optional mood and hunger icons.
- Not done: breakdowns, beauty or room quality, drafted crew eating on order, a "no food" alert, food for crew on shuttles.

## Shuttle bay (branch `opus-bay`, not merged; awaiting user approval of the in-game look)

- `module.vehicle_bay` is a solid 4x5 pit (nothing walkable inside). Its access tile is outside the footprint beside the
  long side in the hatch row (r0: (4, 3), rotating with the module). Starter bay moved its fabricator to (19, 12) so the
  boarding tile (18, 16) stays reachable; raider bay moved to (2, 3).
- Sprite family `vehicle_bay` (`tools/blender/sprites/vehicle_bay.py`, model `shuttle_bay.py`, shuttle `shuttle_craft.py`):
  per rotation `module.vehicle_bay.r<r>[.empty|.fold.f0-1|.open.f0-2]` and `vehicle.shuttle.parked.r<r>[.fold.f0-1]`
  (40 sprites). The parked shuttle is rendered with the bay as a holdout and drawn after it, feet 0.85 above the pit
  floor (`shuttle_bay.FEET_Z`). Both are cut into depth strips per footprint diagonal in `moduleView` (`ModuleLayer.strips`).
- `vehicleBayArt.ts` plays launch / return sequences (claws fold, doors open) when the vehicle leaves or returns.
- Flight art: family `shuttle` (`vehicle_bay.craft_jobs`): `vehicle.shuttle.fly.d0..d7` (wings spread, nozzle glow; d0 = +x, d2 = +y)
  and `vehicle.shuttle.docked.d0/2/4/6` (legs up, wings folded, nose out). `shuttleView.ts` (replaces the old placeholder box)
  draws them in the sector layer: nearest of 8 headings in flight, docked sprite offset 1.5 tiles beyond the dock point (rear
  against the door), and the lift off / settle into the pit floor over the bay's open-door frames (timed by `LAUNCH_LIFT` /
  `RETURN_LAND` in `vehicleBayArt.ts`; the lifting sprite is drawn over the near lip, not cut by it).
- Missing: per-faction livery (the player's blue/ochre is baked; the export keys mkP/mkS have no runtime remap), pod bays.

## EVA and spacesuits (branch `eva`, based on `airlock-int` plus `art/spacesuit`; not merged; awaiting user approval of the in-game look)

Design is in `docs/DESIGN.md` (Crew, "EVA and spacesuits"). What exists:
- **Sim** (`src/sim/eva/`):
  - `SuitC` carries `air` (seconds) and the `airlock` it came from. `AirlockC.suits` counts the suits stowed (def value `airlock.suits`).
  - Suit up / off are personal `suitUp` / `suitOff` jobs at the airlock's inside tile (`errands.ts`, `jobs.ts`), swept by `systems/suits.ts` when nobody carries them.
  - `planWalk` (`route.ts`) prefers a path that keeps out of thin air (`findPath` option `avoidThin`) and flags one that cannot (`thin`). `decide` uses it: a job that needs thin air sends the crew member for a suit first and resumes the job (`Job.resume`).
  - Ships are never close (user decision): no ship-to-ship docking or crossing. `isEvaWalkable(grid, x, y)` lets suited crew onto the Space ring touching a hull (to be replaced by walking on the hull roof, see "EVA on the hull roof").
  - Cross-grid EVA starts at a shuttle: `vehicle.hover {vehicle, gridId}` (dest `hover`, `hoverPoint` in `vehicles/geometry.ts`, then `Vehicle.hover`), `eva.out {vehicle, crew?}` (suits from `Vehicle.suits` / def `eva.suits`, crew land on the nearest exterior tile within `floatRange` and drift there under `EvaFloatC`) and `eva.board {crew, vehicle}` (float back, board, suit stowed; `systems/evaFloat.ts`). The shuttle refuses to move while crew are out. Shuttle panel: Hover beside, Crew out (EVA); crew card: Back to shuttle.
  - `systems/suits.ts` drains the tank in thin air (rooms, airlock, hull outside). `vitals` treats a dry tank as no suit. `eva/conditions.ts` slows suited crew, `fight/weapons.ts` scales hit chance.
  - Commands: `eva.suitUp {crew, airlock}`, `eva.suitOff {crew, airlock?}` (drafted crew). `suit.set` stays as the debug/test shortcut. Events: `suit.donned`, `suit.doffed`, `suit.airLow`, `suit.airOut`.
  - Docking airlock cycling no longer waits for crew standing in its two door tiles (the lock has no chamber), and pumps both door tiles. Without this crew could not leave through the new layout.
- **Content values** (`src/content/suit.ts`): 240 s of air, 5 s to put on, 3 s to take off, move x0.8, work x0.9, accuracy x0.8, `module.airlock` holds 3 suits.
- **Render:** `crewLoadout(atlas, crew, suited)` swaps in the EVA layers (no hair or eyes); `eva_float` plays on exterior tiles and while drifting (interpolated between the hatch and the hull); a tank bar over the wearer. **UI:** Put suit on / Take suit off in the drafted crew card, suit air readout and bar, `suit.airLow` / `suit.airOut` alerts.
- **Debug hook** (`?hook`): `stage.suitAir`, `crewInfo` (plus `dispatch` / `sim` for `vehicle.hover` and `eva.out`).
- Not done: beams (seam only), jobs on the hull exterior, suit use by the enemy AI, art for the suit-up pose (crew stand idle), a tooltip for the free-suit count on the airlock inspector.

## Docking airlock (branch `airlock-int`, not merged; awaiting user approval of the in-game look)

- `module.airlock` is footprint [3, 4] (`hullEdge: 'n'`, solid with open tiles) with `airlock.layout`: pod (inner door) (1,1), hull tile
  and outer door (1,0), inside tile (1,2), collar (1,-1) outside the footprint, two unloaders (body tiles, chute, keep-out
  tile). Keep-out tiles stay walkable; other modules cannot be built on them (they are in the footprint).
- Dock point = the collar tile's centre. Cargo hauls to and from a docked shuttle use the keep-out tile nearest the storage
  (`cargoTile`). Starter airlock now y = 9..11 (row y = 11 opened up, a light moved), raider y = 11..13 (shield gen and a light
  moved), rogue x = 8..10. The old 1xN line airlock form is still supported (no `layout`; portals tests use it).
- Render: `airlockArt.ts` layers per tile, collar sequence on dock/undock, `?hook` gained `sim`, `dispatch`, `stage`.
- Docked shuttle: lies parallel to the hull with its round side hatch (shuttle u 0.817 / v 1.40, axis z 1.30) on the collar's mating
  face (`vehicle.shuttle.dockside.d0/2/4/6`, d = hull outward direction; legs up, wings folded). `shuttleView.ts` slides it in
  alongside (heading turned parallel, offset `COLLAR_FACE + HATCH_V` out and `HATCH_U` back along the hull, axis at 0.95) and
  swaps to the folded sprite half way. `vehicle.shuttle.docked.*` (nose out) stays for the bay lift off / settle.
- Docking tube: the shuttle holds off `HOLD_OFF` = 1.1 tiles from the flush position and extends a 4-ring telescoping tube from its
  side hatch to the collar (`vehicle.shuttle.tube.d<k>.f1..f3`, same origin as `dockside`; nothing drawn when retracted). Sequence
  (`dockSequence.ts`): slide alongside (wings fold half way) 1.4 s, tube f1..f3, then the collar clamps (`airlockArt` delays its
  `.docked` frames by `DOCK_CLAMP_DELAY_MS`); undocking is the reverse (collar unclamps, tube retracts, slide out). Collar: thin 0.1 mouth ring,
  dark bore in the open frames, darker clamp ring when docked. Ships never dock with each other (they cannot move), so one fixed tube length.
- Floor marks (keep-out, walk zone) are faint painted outlines now; cargo on an unloader is a larger crate standing out of the
  chute mouth. Balance test limit restored to 0.975 (starter's north quarters door moved to (17, 8)).

## M4 art rework (session 2026-10-17, supersedes the m4-assets sheets)

The user did not approve the first m4-assets sheets: modules were far too small. Agreed direction:
- **Style:** ENGINES ONLY get the Space Haven-like industrial detail (brass, pipes, bolts, valves,
  greebles; helpers in `tools/blender/sprites/detail.py` and `greeble.py`). Consoles and weapons
  stay clean and sleek (smooth panels, seams, colour from screens/lights/emissive strips). Every
  detail >= 2 px at game scale; flat bands, no texture noise. Run the overlap check
  (`overlap.py`) on every new model.
- **Consoles:** the user likes the chairs and screens of the `m4-art-consoles` prototype.
- **No module floor slabs:** modules sit directly on the ship floor (no plinth/deck plate).
- **Walls redesign** (branch `walls-tall`, not merged): height alone was not the problem (tried 2.2
  and 3.0; settled ~2.4, crew are 1.5). Space Haven-like profile: base covers the whole tile, thin
  top, ONE slope that always faces the camera, vertical back. Hull is a separate chunky
  colour-blocked armour band. Interior walls get their own colour and subtle seams (lockers and
  lights are placeable modules, not wall art). Doors are deep recessed portals in a strong colour,
  ~1.5x crew height; a lower cutaway variant exists.
  CORRECTION (pass 3 got this wrong): only the BASE is sloped. A low sloped skirt (the lower ~15–25%)
  spreads across the tile on the camera side, and above it stands a thin vertical flat wall with a
  flat cap. Hull corners are chamfered at 45°. Doors are framed portals set into the vertical face,
  ~1.6x crew, shorter than the wall. Study `images/11.jpg`-style references closely (crop and zoom)
  before modelling.
- **Engine:** the v7 bell is approved. Add real rocket plumbing (torus manifold, turbopump,
  ducts, tubes down the bell); no valve wheels on posts.
- **Weapons picked** (Opus concepts, branch `opus-weapons`): burst laser = S Sponson, mass driver =
  H Halo, R Revolver's six-barrel rotary = point-defence turret asset. Bay core column runs full
  height to the roof. Engine stays with Sol (the Opus engine preview on `opus-engine` is reference).
- **Roof:** keep v1 (`roof-art`) ochre/blue-grey multi-tile plates, seams and edge trim; remove all
  scattered details (lights, vent squares, hatches, nubs, hazard tape). The structure-driven v2 was
  rejected.
- **Weapons art APPROVED for now** (`opus-weapons` d629ae2: S burst laser, H mass driver, R point
  defence, bays with slim full-height cores, hazard-seam hatches). Remaining nits: rear glow ring
  reads like a muzzle at some aims; hazard seam reads dashed. Other 3 weapons not designed yet.
- **Roof APPROVED** (`roof-art` v11 246414a, plus a v12 pass making the paint near-opaque): flat
  0.2 slab (1.85–2.05), 4x4 modules with girders, bevelled plates, per-plate insets, C palette and
  patch plates, livery system (10 schemes, 78 tinted masks, registry digits painted along the deck).
  Integration: build the sprite set, port the module/livery rule to TS, add the recolour shader.
- **Roof v8 direction (user-approved):** combine C palette + patch plates, B raised belts with
  bevelled steps and trenches (no blisters), and a LIVERY SYSTEM: several deterministic schemes per
  ship/faction (spine stripes, pinstripes, saddle bands, bow chevrons, registry block, emblem),
  each with its own colour pair, ideally as tinted motif masks. No hazard-tape-like edge bars.
  Turret/dish/mast props stay on the roof.
- **Roof:** Opus v5 (`roof-art` a25cf44) is the best so far (4x4 modules, girders, bevelled
  plates, 136 sprites); user says it "could use work" — v6 in progress.
- **Walls pass 5:** thinner walls (~0.22–0.26), hull as layered plate courses (not a
  checkerboard), denser shaded wall faces, muted dusty-rose doors.
- **Heights (DECIDED):** walls.HF = 1.85 (Space Haven measures ~1.85 with the same 1.5 crew); the
  roof is a 0.2 slab on top (top at 2.05); the hull rises to the roof top. Doors sized from the
  reference. Wall-top thickness ~0.34–0.36 tile (measured), skirt ~0.3 of wall height.
- **Sitting crew and roof** handed to Opus (high effort) after repeated misses.
- **Point defence** is its own module (2x2 bay + R Revolver turret), OPERATED by the AI core
  (needs a powered AI core with its mast up), the way the weapons console operates weapons.
- **Three wall view levels (user-confirmed):** walls up; cutaway (front walls/hull cut or ghosted,
  rear hull full height); shortest (the whole hull is a ghost rim, as in the Space Haven whole-ship
  cutaway reference).
- **Wall view rules (user):** the skirt is identical in both modes (only the wall above it is cut);
  in cutaway the REAR (far) hull stays full height; cut hull sections get a black top cap like cut
  walls; doors are never cut; the FRONT hull extends below the floor and curves away underneath
  (carries the chunky armour) while above the floor it is a low ghost footing plus glass.
- **Sitting crew: APPROVED / COMPLETE** (`crew-sit` d981ad9). Clips `sit_idle` and `sit_work`, 8
  directions; chair occlusion cut into the crew sheets via a Blender holdout; engineer backpack
  hidden while seated; armrests raised slightly. Game layering: console sprite at K, seated crew
  at the chair tile at K+0.02 (r0 offset (-32,-16) px, r1 (0,-32) px, crew dirs r0=d6, r1=d0),
  `module.<c>.front.r{n}` desk overlay at K+0.03 (anchors in the d981ad9 report/commit). Still to do
  at integration: full crew sheet bake, renderer wiring, r2/r3 console renders.
- **Engine and weapons art handed to Sol** (user's choice, 2026-10-18) using the prompts in this
  session's scratchpad `sol/` (shared context + engine + weapons). All of our engine passes and
  weapon concepts were rejected; keep them only as code reference.
- **Weapons (history):** square-barrel prototype rejected. Restarting with round barrels; concept sheet
  with 3 directions for the user to pick.
- **Roof parts fold away:** turrets, shield-gen dishes and the AI core mast stow into their
  modules when not in use and deploy (~2 s, 5 frames) through a roof hatch. Turrets and dishes
  deploy in combat or with an enemy in range; the AI mast whenever powered; unpowered stows.
  Gameplay effect (for now, tunable): weapons can't fire and shields don't come up until fully
  deployed. Ghosted on the player's ship only while deployed.
- **Consoles APPROVED** (branch `m4-art-consoles`, pass 5 plus pass 6 cabinet removal): helm 3x2,
  weapons 2x2, shield 3x2 with counter ending at the projector, seat centred on the monitors, and
  one empty walkable tile inside the footprint (modules can have several walkable tiles).
- **Sizes:** engine 4x5 (4 along the hull); helm 3x2, shield console 3x2, weapons console 2x2, each
  with its chair as a walkable access tile inside the footprint (needs per-tile solidity in the sim);
  light weapons 2x2, heavy 3x3; shield gen 2x3, small shield gen 2x2, AI core 2x2. Ships get bigger
  (starter ~30x20, raider ~24x16 with fewer modules).
- **Engines replace the hull wall** where placed and carry their own armoured bulkhead (it
  is always full height: it never collapses in the cutaway view). One big bell per engine
  (~2.6 tiles), in the cleaner v5 bell style (few rings). Bells protrude into space. Engines may block the view. A destroyed
  engine just stops working (no breach).
- **Weapons:** a floor module (the bay: breech, feed, loader) anywhere under the roof, plus a turret
  on the ROOF above it that aims (8 pre-rendered directions) and fires. On the player's own ship
  the turret is drawn semi-transparent at roof height. Shield gens and the AI core also get roof
  parts (emitter dish, antenna mast). These roof parts replace the quiet roof markers.
- **Process:** engine prototype first (`tools/blender/sprites/engine_proto.py`,
  `tools/blender/review/proto_*.py`), user approves the look, then the other modules, then sim and
  layout changes, then balance tuning (raider currently wipes the crew in ~2 min).

**m4-combat sim updated** (075b63a, 5993855, 1b0e482): `ModuleDef.openTiles` (walkable tiles in a
footprint), `hullEdge` engines that replace the hull wall (airtight, no breach), weapons as floor
bays with `WeaponC.aim` 0..7 (`turretSystem`, `turretPosition()`), new footprints, starter 30x20,
raider 24x16, save v5. Balance tuned with fixed-seed scenario tests (manned player wins, no deaths
in 4 min unmanned). User approved: repair rate 12 → 3/s, starter ion cannon → second burst laser.

**Integration in progress: branch `m4-integration`** = m4-ui + crew-sit + walls-tall + roof-art +
opus-weapons + Sol's `art/low-ceiling-modules` commits (d391f5a, 9b89fbf cherry-picked). Checks pass
(161 tests). An Opus agent is building production sprites, wiring the renderer (sit layering, roof
module rule and livery shader, real ids, ROOF_H = 2.05) and taking in-game screenshots. Walls are
still pending approval (walls-tall pass 8); re-merge walls-tall when it changes. Not on main.

**M5 (boarding, derelicts) — decisions so far** (branch `m5-boarding`, foundation in progress:
portal graph across grids, cross-grid pathing, crew grid membership, airlock module):
- Ships don't move, so crossing between grids needs a **vehicle system**: shuttles dock at
  **airlocks** on other grids, or sit in **vehicle bays** in their home ship. Docking creates the
  portal link.
- **Shuttles are entities, not grids** (no visible interior). Crew embark at a vehicle bay or at a
  docked shuttle and ride hidden; shuttles fly through the sector and can be shot down (weapons and
  point defence target them). One generic shuttle to start. The shuttle bay is a buildable 4x5
  INTERIOR pad module (not hull-mounted); 3x3 pod bays for mining/construction pods come later.
  Shuttles are crafted, and the starter ship comes with one. Enemies board you by docking shuttles at
  your airlocks.
- **EVA** only on derelicts or on the outside of enemy ships, after shuttling over.
- **Crew combat:** real time via drafting, weapons as items (sidearms, rifles, melee), cover from walls
  and doorways, existing downed/bleed-out.
- **Capture:** all enemy crew downed or surrendered AND you control their bridge. Captured ships are
  not flown; maybe sold to a ship broker later.
- **Enemies can board you.**
- **Crew combat built** (`m5-boarding` ce8f298, 091615d): weapon items (sidearm, rifle, blade), equip and
  loadouts, LoS and cover, engage and flee behaviour, boarders hunt crew then head for consoles,
  surrender (`isSubdued`). The starter ship has NO security crew (user decision); its storage holds a
  rifle, two sidearms and a blade.
- **Derelicts:** combat wrecks plus event-spawned derelicts with hazards, loot and hostile aliens.

## Sector grid decision (user, 2026-10-19; plan on branch `sector-plan`)

The many-grids sector (one `Grid` per ship, cross-grid portals, per-grid scenes, docking by gridId) was always temporary.
**Each sector becomes one large chunked grid with everything placed on it.** The plan is "Sector grid (planned)" in
`docs/ARCHITECTURE.md`. User answers:
- Sectors are big with no fixed limit. Distance should feel like distance (shuttle trips and shots take noticeable time)
  without being tedious.
- Ships never move or dock with each other; deployment places them.
- An FTL jump takes the player's ship plus anything docked to it (bay or airlock vehicles). Captured prizes stay behind.
- The combat panel stays, as a second camera on the same map.
- Vehicles (shuttles, later pods and cargo carriers) are free entities with continuous position and heading. They attach to
  an airlock or bay, and crew can EVA off a hovering shuttle.
- Ships are tile regions tagged by ship id. Capture, integrity, wrecks, AI, targeting, livery and roofing stay per ship.

**Progress:** step 1 on `main` (`GridLike`, `SectorGrid`, `GridWindow`, `ship` field and `SHIP_EMPTY`). Step 2 on branch
`sector-2` (not merged): ships are stamped into `sim.sector.grid`, `sim.grids` holds windows, save v13 stores chunks and old
saves are refused (no migrations). Step 3 on `sector-2`: field systems loop over `regions(sim)` through `load()`/`set()`
with per-region active tile lists (bit-identical results, pinned by hash tests). Step 4 on `sector-2`: `ship` owner layer (stamp and
build), `shipAt`, `shipFrame` (`REGION_PAD`), `regions(sim)` and the `MIN_SHIP_GAP` rule in spawns. Steps 1–4 are on `main`.
Branch `sector-8` (not merged): step 6 fixture prep (multi-ship fixtures stamped at their ShipC, `windowShipMismatches`
asserted) and step 8 (`BodyC` vehicle bodies, `homeShip`, `hover`/`vehicle.hover` by ship id, EVA drift in sector space,
air-layer rule by altitude, save v14). Vehicle screenshots match main pixel for pixel apart from real-time animation phases
(scratchpad `sector8/new` vs `sector8/main`). Next: step 5 (render), after `genint` lands; `debug.spawnGenerated` from
`genint` must call `placementGapError` like `debug.spawnEnemy`. Step 5 must pick up the TODO in `shuttleView.ts` (low bodies
in the shared world layer, `alt` driving the lift).
Branch `sector-5` (not merged, visual: needs the user's screenshot approval): render steps 5a (one world layer stack, regions
as decorators at sector offsets, cross-ship depth sorting), 5c (combat panel as camera pass B into a texture; `miniScene`
deleted), 5d (picking in sector tiles), the §5 visibility rule (crew outside a roofed hull always drawn) and the step 8 TODO
(low bodies in the world layer). Not done: 5b (chunk tile views), `alt` driving the lift (it does not ramp). `origin/main`
merged in (new UI, per-clip crew sheets; no conflicts, `selectGrid` and the node strip frame through the sector-frame
`frameShips`). Screenshots and comparisons vs main in the scratchpad `sector5b/` (`main/`, `new/`, `cmp_*`, `cmp.txt`
explains every difference). The user confirmed the cross-ship wall ordering in the overlap scene is correct on sector-5.
Known side effect: lamp halos draw over a low (lifting or settling) shuttle, as they already did over a docked one.
Branch `sector-5b` (not merged, needs the user's screenshot approval): step 5b, chunk tile views. Floors, walls, doors, roofs,
cracks, flames, atmosphere emitters and the field overlay read `SectorGrid` chunks (`render/regionTiles.ts`), keyed and
rebuilt per sector chunk; see ARCHITECTURE "Step 5b done". Step 5 is complete apart from per-chunk culling and `alt` driving
the lift. Comparison vs main in the scratchpad `s5b/` (`cmp.txt`).
Branch `sector-6` (not merged): step 6, the coordinate flip. Every component holds sector tiles; windows read sector
coordinates and keep their rectangle as bounds; geometry sums and `sectorPos` are gone, and a lint guards against new
ones. Region tile art stays ship-local, placed at the region's top-left. Save v15. Both `sectorEquiv` hashes are
unchanged (positions mapped back to local before hashing). See ARCHITECTURE "Step 6 done". Screenshots vs main (starter
up, overlap cut, combat panel picked) in the scratchpad `s6/` (`cmp.txt`): starter identical, the rest differ only in
time-driven pulses that differ between two main runs too.

Branch `sector-7a` (not merged, no visual change): first slice of step 7 (cleanup). `ItemStack.gridId` is gone (owner read from
the `ship` layer via `gridIdAt`), `crew/pathfind.ts` and `eva/route.ts` use `load()` (no `raw()` left in `src` outside tests and
`GridWindow`), module / job / airlock readouts show ship-local tiles. Save v16. Hashes unchanged. Step 7 is split into 7a-7d,
see ARCHITECTURE "Step 7 split". Next: 7b (Module, Job, Drafted, Position).

Branch `sector-7b` (not merged, no visual change): 7b, first half. `ModuleC.gridId`, `JobC.gridId` and `Drafted.target/planned.gridId`
are gone (membership from the tile via `gridIdOf` / `gridIdAt`); `Position.gridId` was left for 7b2. Save v17. Both `sectorEquiv`
hashes unchanged (the test's `legacyWorld` writes `gridId` back into module rows). See ARCHITECTURE "Step 7 split".

Branch `sector-7b2` (not merged, no visual change): `Position.gridId` is gone (about 100 reads now `gridIdOf(sim, pos)`; render uses
`gridIdAtTile(world, x, y)`). Shuttle passengers need nothing new: they have no `Position` and carry `AboardC`; disembark gives
them a tile again. Save v18. Both `sectorEquiv` hashes unchanged (`legacyWorld` writes `gridId` back as the first `position` key).
Headless smoke: starter loads with 0 page errors; embark, launch, dock, disembark brings the pilot back on a tile. Next: 7c.

Branch `sector-7c` (not merged, no visual change): ship-keyed ids, done in one slice (sim and UI together; no split needed).
`Target.ship`, `Projectile.fromShip` and `CoreLink.ship` are `ShipC` entity ids; every command and event `gridId` field is now `ship`
(`combat.setTarget` takes `ship` / `targetShip`; `weapon.fired` has `targetShip`; `crew.crossed` has `fromShip` / `toShip`;
`portal.link` keeps its grids: portals go in 7d). UI snapshots and the `UiApi` are keyed by ship id: `selectShip` / `selectedShip`
(renamed from `selectGrid`), `setCombatView({ ship })`, `focusFight(ship)`, the node strip's `node-{shipId}` and `hover-{shipId}`
testids, `UiCrew.ship`, `UiPrize.ship`, `UiModule.ship`. **Stations** (no `ShipC`) are keyed by their trader entity id, in the same
id space as ships (before: minus the entity id); `UiTradePartner.id` is that key. `Ship.gridId` itself stays: it is the link from a
ship to its `sim.grids` entry, which 7d removes; `gridOfShip` / `shipOfGrid` / `shipIdOf` (`sim/regions.ts`) convert at the edges.
Render keeps grid-keyed interfaces (`frameShips`, `setCombatView`, `pickTileAny`); `app/controller.ts` and `main.ts` convert.
Save v19. Both `sectorEquiv` hashes unchanged (`legacyWorld` writes `gridId` / `fromGridId` back under the old key names).
Fixture grids that had no ship now get an inert one (`fixtureShip`, a prize) so commands can name them.
Headless smoke on the built game: 0 page errors, starter ship visible; a raider spawned through the debug hook shows as `node-{shipId}` in the strip, clicking it opens the selection panel with the Frame fight button, the combat panel opens by itself and auto-targets the raider, and picking a module (chip or tap in the ship view) sets `Target { ship, moduleId }`. Next: 7d.

Branch `sector-7d` (not merged, no visual change): the final cleanup slice of step 7. `sim.grids`, `GridMap`, `GridWindow` (+ `raw`), the
cross-grid portals and `Path.then` are gone; `SuitC` lives in `eva/components.ts` and `AirlockC` in `modules/airlock.ts`; `Ship.gridId` is
gone, so every id in the sim, app and renderer is the `ShipC` entity id. A ship's bounds are its `ShipC` rectangle, read through
`ShipGrid` (`shipGrid(sim, ship)`: a derived view of `sim.sector.grid`, not registered or saved). Lint rejects `.gridId` and `.grids` in
`src/sim`. Save v20. Both `sectorEquiv` hashes unchanged. Ship-less fixture grids need `stampShip` (a prize `ShipC` at the origin). Tests that
named ships 1 and 2 use `nth(sim, n)`. See ARCHITECTURE "Step 7 split" and "7d notes". **Step 7 is done.** Next: step 9 (lifting ships).

Branch `sector-9` (not merged, no visual change, sim only): **step 9a done** (packets, archives, jump and deploy commands). Save v25.
- `ShipPacket` (`sim/sector/packet.ts`): `packetFromTemplate(t)`; `liftShip(sim, ship, { withDocked })` copies every field over the
  ship's rectangle, clears it to empty Space, releases the chunks left empty (`SectorGrid.releaseEmpty`) and detaches the entities
  that travel (`liftSet`: what stands on the ship, its own stowed and docked vehicles, the picked non-player docked vehicles, the
  crew aboard them; clamped containers are modules, so they come too) with coordinates in ship-local tiles; `stampShip(sim,
  template | packet, { x, y, faction?, state? })` is the one entry (a template packet takes the old path, so both `sectorEquiv`
  hashes are unchanged; a lifted packet comes back whole).
- **Ids are kept, not remapped** (planner's call, as ARCHITECTURE "Entity ids survive" says): world ids are never reused, so
  `World.restore` brings entities back under their own ids and links between them need no fix-up. The translation table
  (`sector/translate.ts`, one entry per component, a test fails on a new component without one) moves coordinates only.
  References that cross the cut are cleared (`sector/refs.ts`: weapon and ship targets, attack orders, job and bed
  reservations, assignments); a stranded shuttle's `homeShip` is kept so it is valid again when the player returns.
- `SectorArchive` (`sector/archive.ts`): `{ node, tick, width, height, grid, entities }`; `archiveSector` freezes everything left
  (projectiles in flight are dropped), `restoreArchive(sim, node)` brings it back. `Sim.archives` is saved.
- Commands: `sector.jump { ship, node, withDocked? }` (since replaced by `galaxy.jump`; player ship, FTL charged, not while deploying, refused while a trade deal is
  live; clears hails and offers) lifts, archives, restores the target node's archive if any, and leaves `sector.state =
  'deploying'` with `sector.packet`; `sector.deploy { x, y }` checks bounds and the gap rule and stamps. Events `sector.jumped`,
  `sector.deployed`. `Sector` gained `node` and `state`. (On `galaxy`: `sector.jump` became `galaxy.jump`, and node ids are the galaxy's strings.)
- Query for the jump confirm: `jumpWarnings(sim, ship)` → `{ crew, vehicles, hostileDocked }`.
- Shuttle speed is 8 tiles/s.
- **Left for 9b (UI, visual, needs screenshots):** the jump confirm (lists `jumpWarnings`, a toggle per hostile docked shuttle
  that fills `withDocked`), the deploy modal (sector map with ShipC bboxes, picks the spot, sends `sector.deploy`, pauses the sim
  while `state === 'deploying'`), render and UI handling of an empty world while deploying, and the hook into the `starmap`
  branch's `enterNode` (fresh nodes are empty sectors for now: no generation on arrival). Not done either: `debug.spawnGenerated`
  using the deploy bounds check, and jump-time FTL rules beyond "charged".

**User decisions for step 9 (2026-10-21):**
- A jump with crew or a shuttle away is allowed after the player confirms; they stay in the archive (answers open question 2).
- A hostile shuttle docked at the airlock at jump time is the player's choice in the jump confirm: it comes along (boarders
  aboard it too) or is cut loose and left behind (answers open question 3).
- All archives are kept; there is no retention or pruning rule for now (answers open question 4).
- Shuttle speed goes from 5 to 8 tiles/s (answers open question 1's speed part).

**EVA on the hull roof (user decision, 2026-10-20; not built):** EVA crew outside a ship must not walk the hull ring at
floor level (the tiles just outside the hull walls): there they look as if standing on air, and walking along wall faces
would need a sideways walk animation we don't want for now. Instead EVA crew walk on top of the **hull roof**, pathing
over roof tiles at roof height. This replaces the old plan of walkable beams on the hull ring. On a ship drawn without its
roof (cutaway, e.g. the player ship), show the roof tiles just around an EVA crew member if that is cheap and reads well;
otherwise the crew float at roof height over the cutaway.

**Vehicle bay departure decision (user, 2026-10-20; for a later vehicle step, not built):** the bay doors are at the
**bottom** of the pit. A departing shuttle drops down out of the pit through the bottom doors, flies clear of the ship's
underside, then rises to flying altitude and goes on to its destination. Return is the reverse: approach below the hull, rise
up through the bottom doors, settle into the pit. This replaces today's lift up out of the top and turn over the ship, so the
heading while hovering over the bay is moot, and the `alt` lift-ramp work should follow this path.

Planner's calls (the user can overrule):
- 16x16 sparse chunks.
- A `ship` owner layer.
- `ShipC` entity id = ship id.
- Sector coordinates everywhere at runtime; templates and shipgen stay local and get stamped.
- Field systems per padded region.
- Portals retired (except airlock and suit helpers).
- `BodyC` for vehicles.
- Packets for stamp, lift and archive.
- A 10-step migration behind a `GridWindow` adapter.

Merge advice:
- Merge `eva` (after look approval) and `weapons-int` to main now.
- Integrate `shipgen` + `trusses-int` before the render step (5).
- Holding everything recreates a flag-day merge.

**Open questions for the user:**
1. **Distances.** (Speed answered: 8 tiles/s, 2026-10-21.) Proposed: deploy 60–200 tiles apart, sectors about 1000x600 in practice. At today's speeds, 200 tiles is
   40 s by shuttle and 7–17 s for shots. Raise shuttle speed (5 → 8 tiles/s)?
2. (Answered 2026-10-21: confirm and leave them in the archive.) **Jumping with crew or a shuttle away** (boarding party, hovering EVA): refuse, confirm and leave them in the archive, or
   recall first?
3. (Answered 2026-10-21: the player chooses in the confirm.) **A hostile shuttle docked at your airlock at jump time:** it comes along (its boarders with it), or is cut loose and left
   behind?
4. (Answered 2026-10-21: keep all.) **Left-behind sectors:** keep only those with something of yours (prizes, stranded crew), keep the last N, or keep all?
5. **A shot landing on a ship it wasn't aimed at:** hit that ship (proposed: the tile owner takes it) or pass through?
6. **Merges:** approve the `eva` look and merge `eva` + `weapons-int` to main before the refactor, or keep the hold and run
   the refactor on one integration branch?
7. **Combat panel on phones:** OK for the second camera to refresh at half rate if needed?
8. **Teleporters:** delete the portal graph now and re-add them later as same-grid links (proposed), or keep it?

## Decisions log (beyond DESIGN.md)

- **Workflow:**
  - Visual work: send the user screenshots (default + zoomed) and get approval before merging to
    main.
  - Assets: the user reviews **both** the Blender renders and the pixel sprites before integration.
  - **Preview first:** for art feedback, agents stop at a quick preview (one rotation, low samples
    + denoise, one test scene at 1x/3x, a Blender render) and report. No full sprite builds,
    manifests, extra rotations or wiring until the user approves the look.
  - The cloud container has 4 cores: run at most ~3 Blender-rendering agents at once, one Blender
    process each.
- **Art:**
  - Pixel art pre-rendered from Blender. Models use clean shapes and smooth shading quantised to
    flat bands, with no faceting and no noise.
  - Third-party screenshots the user shares are visual reference only: never trace them, ship
    them, or copy them into `public/` or the pipeline. With the user's permission they are kept in
    `docs/refs/` (see its README): a Space Haven whole-ship shot in the shortest cutaway view, a
    Space Haven walls/doors/hull shot, a Space Haven engine, Space Haven consoles, a Saturn V F-1
    photo, and the user's Sol test renders (the quality bar).
- **Walls:**
  - Interior walls and far exterior walls use the cut-away look in Auto mode.
  - Exterior walls nearest the camera are ghosts: an angled dark footing plus short glass.
  - Doors are always tall.
- **Combat:**
  - No movement or maneuvering. Distance only affects projectile travel time.
  - Combat overlay; consoles (weapons/shields/helm) instead of manning each weapon; the AI core
    runs point defence.
  - Shield generators can sit inside the ship; weapons and engines must touch the hull.
  - **Roofed enemy view** instead of fog: special roof tiles mark weapons, shields and engines
    (`ModuleDef.roofAsset`).
- **Sectors:**
  - A sector is a playable grid holding ships, stations, asteroids and derelicts.
  - A **deploy modal** (simplified sector map) chooses the ship position on entry. It is planned
    for M6.
- **Economy follow-up:**
  - Ship-wide **stock targets** (keep N of item X) that auto-queue crafts on any capable
    fabricator.
  - A UI pass when the user is at their PC.
- **Known art TODOs:**
  - The crew "work" clip renders odd half-bodies.
  - The cyber eye is faint.
  - The fabricator inspector covers the cargo room.
  - Wall corner artifact: the user said "good enough for now".

## Agent workflow (user decision, 2026-10-18)

- **Default model:** subagents run on Sonnet (or Haiku for trivial work).
- **Opus:** only with the user's sign-off. Say why the task needs it and ask first.
- **M4 art follow-ups:** move to a fresh Sonnet agent once the current Opus engine pass lands.
- **Opus exceptions:** the ship generator (`shipgen`) and robots (`robots`) are already approved for Opus.

## M5 integration (branch `m5-integration`)

- `m5-boarding` and `robots` merged onto main (mirrored templates kept, shuttle bay and airlock mirrored to the west hull).
  Checkpoint 1 adds a shuttle panel and a placeholder shuttle sprite (`src/render/shuttlePlaceholder.ts`).

### Boarding UI and robots wired (checkpoints 1 to 3)

- UI: shuttle panel, crew bar with all crew wherever they are (hostiles are targeted in the world, no name row), equip,
  draft and attack orders across ships, prize panel (prisoners, prize value, scuttle), robot bay panel (assemble, cancel).
- Placeholders, each in its own file: `render/shuttlePlaceholder.ts`, `fightFx.ts`, `crewMarks.ts`.
- Art: robot crew sheets and the robot bay sprites (`render/robotBayArt.ts`; empty, charging, drone, 8-frame assembly)
  from `art/robot-bay`. The bay is solid with a walkable cradle (`openTiles [[0,0]]`, `cradleOf` in `sim/robots/bay.ts`).
- Tooling: `?hook` installs `window.__cc` (screen positions, events). Debug panel: robot bay, parts, drain batteries, capture.

### Robots (from branch `robots`)

- **Robots and the rogue AI (branch `robots`, on top of `m5-boarding`):**
  - `species.robot` is gated by species flags, never by id: `airless` (no O2, no vacuum harm), `mechanical`
    (no regen or bed healing; crew with the new `repair` skill mend it with parts or metal), `ionStunSec`
    (ion near the hit, EMP and the ion pistol stun it), `fearless` (never flees or surrenders), `wreck` (at 0 hp it
    is wrecked and salvaged for parts), `coreLinked`. Variants are roles: `role.robot_worker`,
    `role.robot_security`, `role.robot_repair`.
  - Faction `rogue` is at war with everyone, neutral included (`combat/factions.ts`). Its robots are linked to
    their ship's AI core and go **inert** (subdued) when the core is destroyed, unpowered, ion-disabled or hacked.
    AI-run ships are captured by downing the cores and holding a bridge (AI cores count as bridges there).
  - `crew.hack` (engineers have hacking 1) is a drafted job of `HACK_SEC`. Hacked cores do not flip robots to
    the hacker yet (follow-up).
  - `module.robotFabricator` builds robots while powered and run by a live core, up to its cap.
    `ship.rogueShipyard` is the debug test grid (Debug panel: spawn shipyard, spawn bots on the selected tile).
  - **v2:**
    - A held hack lends the core's robots to the hacker's side (`HackedC.hacker`, `robot.flipped`). When the
      hacker leaves they revert, inert.
    - The robot holds still for a mender.
    - `species.robot_heavy` (200 hp, armour 0.3, slower) for security bots.
    - Battery need (`SpeciesDef.charge`, `Needs.charge`). Robots go to `module.robotBay` (1x2, placeholder bed
      sprite) to recharge and get repaired.
    - `module.assembleRobot` / `module.cancelAssembly` assemble a player robot from `RoleDef.assemble`. The bay
      becomes its home (`Module.reservedBy`).
    - The fabricator is kept separate from the bay: it is the AI spawner. The shipyard has 3 bays.
  - No robot art yet: robots render with the human layers as a placeholder. Save v12.
  - Derelicts: scrapper and other wrecks will be alien-infested; AI-faction derelicts are rogue AI shipyards.
    Combat drones (a launched weapon class) come later: the hooks are the `emp` effect and the AI core's tier.

## Environment notes

- Blender 4.2 LTS headless: `tools/blender/setup.sh` installs it to `/opt/tools`. Previews render
  with Cycles CPU (EEVEE needs a GPU).
- Screenshots use `node_modules/playwright-core` 1.56 with
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, args
  `--use-gl=swiftshader --enable-unsafe-swiftshader`, against `npx vite preview --port <n>`.
- The pipeline's source body model is `tools/blender/source/base_cc0.glb` (CC0, see THIRD_PARTY.md).
- Agents work in separate git worktrees so they don't collide. Commit and push WIP often: sessions
  hit usage limits and the container can restart.

## Shipped

- **2026-10-19:** merged to `main`: `eva` (shuttle bay, shuttle flight and side docking with the extending tube, docking
  airlock with unloaders, EVA and spacesuits), `weapons-int` (missile launcher, ion cannon, incendiary launcher), `events`
  (event system, 11 starter events), `needs` (hunger, galley and rations, mood) and the `sector-plan` docs. The "not merged"
  notes in the branch sections below predate this. Not merged yet: `shipgen` and `trusses-int` (merge before step 5 of the
  sector plan). Sector size stays an open question (1000x600 is a working guess, not a decision).
- **2026-10-18:** M4 art merged to `main` (bdde1e9). It covers:
  - consoles and seated crew;
  - the S, H and R weapons;
  - Sol's engine, AI core and shield generator;
  - roof v12 with livery, on top of the hull, with cut plates;
  - walls pass 17;
  - the engine bulkhead split into layers, with the hull skirt;
  - ships mirrored so the engines face the camera;
  - livery bow at either end.
- **Still open on M4:**
  - missile, ion and incendiary art;
  - combat fx;
  - the glow over seated heads;
  - stray ghost-outline bits near the doors;
  - deploy and "Fire volley" not yet confirmed in game.

## Next milestones

- **Finish M4** (above).
- **M5:** boarding and derelicts. Portal graph across grids, airlocks and teleporters, EVA,
  crew-vs-crew combat, capture, exploring wrecks.
- **M5 queue (after the M4 merge, on Sonnet):**
  - robot crew sprites and the robot bay art;
  - the robot assembly UI;
  - the rest of the M5 render and UI work: shuttles, boarding, gunfire, equipment, capture and prisoners;
  - airlock and bay art;
  - EVA;
  - derelicts: alien-infested wrecks, and rogue AI shipyards for the AI faction.
- **Sector grid refactor** (before M6; plan in `docs/ARCHITECTURE.md`, "Sector grid (planned)").
- **M6:** galaxy and sectors. Deploy modal, events, stores, factions.

## UI rework (branch `ui-1`; merged to `main` with user approval)

Space Haven design language (sharp corners, near-opaque panels, icon tiles; tokens in `src/ui/theme.css`, icons in
`src/ui/Icon.svelte`), "what's always relevant, then drill down". Top left: screen strip (`NavStrip`: ship overview, crew
priorities, stock, combat that lights up with enemies; starmap goes here later). Top centre: crew cards and the node strip
(`NodeStrip`: one tile per other grid in the node; click frames and selects it). Top right: time block (room above for a log),
notifications below (`AlertList`). Bottom left: one `SelectionPanel` (ship by default; crew, module, bay/shuttle, tile, other
grid with Hail/Trade and prizes). Bottom right: tool dock (select, build, deconstruct, cancel, walls, overlays, debug).
Open: CombatPanel still old style; phone hides the crew row while the combat sheet is open; station subtitle reads
"Station · station"; debug "Spawn raider" default spot is rejected; stations select by negative grid id (no camera move).

## Shipgen rooms and ruins (merged to `main` with user approval)

- **Rooms** (`src/sim/shipgen/rooms/`): data-driven recipes per room type, door pruning, furniture defs in
  `src/content/furniture.ts` (several have no art yet). User note: **room generation gets reworked once the new modules from
  the art thread land** (storage set, medbay, battery, hydroponics, workbench, comms and sensor consoles, cryo pods).
- **Ruins** (`src/sim/shipgen/ruin*.ts`, `src/sim/combat/derelict.ts`): `ruin(template, seed, opts)`, jammed doors
  (`jam` field, `job.forceDoor`), `debug.spawnDerelict` / `?shipgen=derelict`. Done on `derelict-ingame`: derelict art wiring (`ShipC.ruin`, save v23), a Force door UI
  action, a jammed-door marker.
- **Next (user decision): sealed, detachable cargo containers** as their own ship component with their own exterior. Freighter
  frames become trusses plus clamped containers; a detached container becomes a free body (like shuttles) carrying its
  stock. Not walk-in (walk-in plus detachable would need grid surgery).

## Cargo containers (branch `shipgen-containers`; not merged; awaiting user review of the look)

- **Component** (`src/sim/containers`): a container is a module with `ModuleDef.container` (`container.2x3` cap 7,
  90 hp; `container.3x5` cap 18, 160 hp; solid, full cover, no power). Cargo doors are on a short end, and that end
  always clamps to the frame (user decision; shipgen validation enforces it). They stand on Beam tiles, tagged
  `ContainerC` (def, rot, clamp side, state clamped / drifting, hp, last ship, drift). Haulers skip it (sealed).
  Combat reuses module damage; at 0 hp its stock is lost. `container.detach` (and `detachContainer`) frees its tiles
  (Space, no owner, no module) and turns the same entity into an inert drifting `BodyC` with its `StorageC`, seeded
  velocity away from the ship's centre; `containerDriftSystem` moves it and damps it to rest (12 s time constant, a few
  tiles), so it stays in the node as loot. Save v22.
- **Shipgen**: container cells (`containerCells.ts`, symbol chars per size and turn) survive blocks, mirrors and
  arranging; `generate` turns them into `=` plus container modules with stock (`extractContainers`). `containerFrame` is
  a beam, truss or crawl-tube spine with containers on both faces, short end on the spine (sizes mixed, more on long
  rows; gaps, stagger, empty slots seeded). The tug's barge and the mid frame keep a walkable crawl tube (crew must reach the far end). Validation:
  containers must sit on `=` and touch the frame on their clamp side.
- **Scrapper**: the pod-string donor (and the old non-section civilian grammar) is a crawl tube with containers clamped
  on both walls (`civilBlocks.podString`); scrapper strings mix sizes, gaps and empty slots. The tube stays walkable.
  About 25-35% of scrappers carry one (donor weights in `content/factions/scrapper.ts`; ~40% at depth 4). Salvage
  cuts and notches never slice a container.
- **Ruins** (`ruinContainers.ts`): some torn off (and any a shear cuts off) as `meta.containers` bodies near the wreck,
  spaced a tile clear of the wreck and each other, spawned by `applyRuin`; the rest sealed, breached (stock partly lost,
  under half hp) or destroyed (stock gone). Scrapper boxes are breached more often and sealed ones often `patched`.
- **Render**: placeholder drawn boxes (0.8 tiles tall, under the hull wall) with a yellow clamp until art lands (ids in ARCHITECTURE "Cargo containers").
- **Debug**: `?genAt=dx,dy` places generated ships and derelicts away from the player's ship (big freighters otherwise
  collide with it and are refused).
- User answers (2026-10-20): containers are pre-stocked for now, no player building, no UI yet; the truss / crawl mix
  is fine. Later: pick-up, towing, cutting open.
