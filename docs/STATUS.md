# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-10-19 (trade branch added).

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
  - Ships are never close (user decision): no ship-to-ship docking or crossing. `isEvaWalkable(grid, x, y)` lets suited crew onto the Space ring touching a hull; beams join later.
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
1. **Distances.** Proposed: deploy 60–200 tiles apart, sectors about 1000x600 in practice. At today's speeds, 200 tiles is
   40 s by shuttle and 7–17 s for shots. Raise shuttle speed (5 → 8 tiles/s)?
2. **Jumping with crew or a shuttle away** (boarding party, hovering EVA): refuse, confirm and leave them in the archive, or
   recall first?
3. **A hostile shuttle docked at your airlock at jump time:** it comes along (its boarders with it), or is cut loose and left
   behind?
4. **Left-behind sectors:** keep only those with something of yours (prizes, stranded crew), keep the last N, or keep all?
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
