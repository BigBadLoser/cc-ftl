# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-10-21 (stations slice 1 on `stations`).

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
  - the placeholder `module.refinery` (fabricator tinted orange in `fallback.ts`; no mechanic);
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

Next slices (not built):
1. Spawn a station as a region in the node: an immobile `ShipC`-like kind with no FTL, no jump lift and no flee.
2. Replace the TEMPORARY trade instant fallback with real docking at station airlocks and shuttles.
3. Station NPC behaviour and security AI: guards, patrols, alarms, and drawing from the armoury.
4. Boarding and capture balance for stations: many security NPCs, and pirate dens as the soft target.
5. Station art at the new 2x scale (128x64 tiles): refinery, hydroponics and armoury lockers, plus the ore cages.
6. Generator polish:
   - ring courtyards are large and empty (an inner deck or truss could fill them);
   - a satellite that clashes with its neighbours costs a reseed on hubs;
   - pirate outposts can get many docks, because each welded lattice brings two.

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
- **Decisions to review:** who flies (above); the instant station fallback is TEMPORARY; a hostile-side ship in combat always refuses
  (its guns lock on you at once), so the reputation thaw only applies to non-shooting ships; payment is escrowed at accept; a run
  carries 40 units; trade commands tick the sim once while paused; credits live in `sim.trade`, not on a ship, so they survive a ship swap.
- **Not done:** hyperlane/sector prices, restocking over time, NPC-to-NPC trade, selling floor stacks (storage only), several runs for
  a big deal, per-faction shuttle livery, art for credits and the trade window (plain UI).

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
- Commands: `sector.jump { ship, node, withDocked? }` (player ship, FTL charged, not while deploying, refused while a trade deal is
  live; clears hails and offers) lifts, archives, restores the target node's archive if any, and leaves `sector.state =
  'deploying'` with `sector.packet`; `sector.deploy { x, y }` checks bounds and the gap rule and stamps. Events `sector.jumped`,
  `sector.deployed`. `Sector` gained `node` (0 = start) and `state`. There is no galaxy on `main` yet (`starmap` is unmerged), so
  a node is a plain number.
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
