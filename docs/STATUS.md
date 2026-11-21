# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-11-21.

**History:** completed-work logs, past PR notes and superseded decisions are in [STATUS_ARCHIVE.md](STATUS_ARCHIVE.md). Standing decisions that live there:
- Sector grid (user, 2026-10-19). Each node uses one chunked grid. Ships keep their positions within a node, while
  vehicles handle docking and boarding. A jump takes the player's ship and docked vehicles to the destination.
  See the [live sector grid](ARCHITECTURE.md#sector-grid) and the archive's "Sector grid decision".
- Art pipeline and look decisions from the M4 art rework (session 2026-10-17): archive section "M4 art rework".


**Ship generator:** a separate shipgen session works on ships, stations and room layout. See
[SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md) (scope, file map, sheet commands, backlog) and [SHIPGEN.md](SHIPGEN.md).

## Weapon upgrades (#338: slice 1 in #344, slice 2 in #351, art in #346; flak art in #357)

Module upgrade slots with the three general weapon upgrades and the flak cannon. Mechanism: `ModuleDef.upgradeSlot`, `ItemDef.upgrade`
(`slot`, `fits`, `mods`), `Module.upgrade`; read through `sim/upgrades/stats.ts` (effective weapon def, damage-taken multiplier). Fitting is the
`fit` crew job (commands `module.fitUpgrade/removeUpgrade/cancelUpgrade`); the module is offline while the crew work it (`Module.offlineUntil`, a
general work hold, `sim/modules/hold.ts`; power reads that, not fits). Enemy loadouts by faction (`FactionDef.upgrades`) are rolled once when a
generated ship is created (`shipCreated`, `combat/ships.ts`, fed by `spawnShip` `opts.gen` and the derelict spawner; `sim/upgrades/loadout.ts`), strip drops and losses, station stock, ruin loot. Slice 2 (behaviour
upgrades) plugs into `UpgradeMods.weapon` (a patch over the fitted weapon's def). Debug start: `?scenario=upgrades`. Item art and 40 px UI icons (`item.upg_<id>.icon`) came in #346.
Flak is an ordinary ammo weapon (starts on HOLD); HOLD, or hold all, stops all fire. Its art (#357): turret `turret_flak.py`,
bay `turret_bay_flak.py`, no `artTint` (turrets never take it). Drones are covered by point defence and defence drones, not flak.
Combat: a left click on a foe weapon (not aiming) opens a read-only inspector (`app/foeModule.ts` is the place for a future
scanner gate). Debug starts are presets in `content/scenario/` (see ARCHITECTURE "Scenario builder"). Rules from its review: read a weapon module's def through `weaponDefOf` (or a shot's through `firedWeapon`), never `sim.content.weapons`
directly; every job aimed at a placed module posts `moduleSite` (`modules/footprint.ts`, the rotated footprint) so crew work it from any side.
Slice 2 (merged in #351): the seven behaviour upgrades in `content/upgradesBehaviour.ts`, all data over general fields: `WeaponDef.ammoPerShot`
(nuke: 2 missiles; `hasAmmo`/`consumeAmmo(n)` in `combat/ammo.ts`), effect `arc` (chain coil: lightning from the hit module into the nearest crew, `ifNoDrain`; event
`projectile.arc`), `WeaponDef.look` (render tint/blast/trail, carried on `weapon.fired`; `render/shotLook.ts`), plus patched shots, shield rule, speed, effects. Nuke is black-market
only and tagged contraband (no recipe, research or enemy carries). Lab panel `shots`. Numbers are a first pass.
Done: the art (#346: item sprites and UI icons for all ten, neutral shot sprites tinted by `shotLook`), so #338 is complete.

## Food and farming (#59, merged in #366)

Hydroponics beds with a crop picker (greens, protein beans, medicinal herbs, grain; `content/crops.ts`), plant and harvest jobs (new "Farm" priority column), galley meals
by the cook's new `cooking` skill (bland, good, fine; `recipe.meal_greens`, `recipe.meal_beans`), meals eaten before rations with their own mood factor, herbs speeding a medical
bed (`module.med_bed` is now a patients-only bed), grain as a trade item. The three shipped starters carry a planted bed, 16 good meals and 6 greens (food indicator green).
Debug start `?scenario=farm`. Placeholder art (list in the PR): greens, grain, beans, herbs and the three meals borrow other items' sprites (`ItemDef.art`); no new sprites.
Bed and crop sprites landed from the art session (`art/hydroponics`, lab `?panel=hydroponics`). Two bed sizes: `module.hydroponics` (small, draws 2 only while a crop is in) and `module.hydroponics_large` (3x2, worked from the middle of its long side; 3x the yield for 2x the water and power (4 power)).
Any module can now draw power by a state rule (`ModuleDef.drawsWhen`, `sim/modules/draw.ts`); an idle bed shows "Idle", not "No power". The renderer picks the art ids of
`docs/art-prompts/hydroponics.md` (`<asset>.r<n>.on|off`, crop layer `<asset>.crop.<crop>.<stage>.r<n>`, damage art ahead of both); `render/cropOverlay.ts` draws a code stand-in for a missing crop sprite.
**For the shipgen session:** the beds, meals and greens in the shipped starters (`src/content/ships/{wayfarer,prospector,lancer}.ts`) are hand-edited, and the python generators
under `tools/shipgen/starters` are stale against them (they were already behind the shipped stock lists). Regenerating with `ship.py` would erase them: port the edits first.

## On `main` now (merged PRs through #499; later ones under "Done since #499" below)

- **Progression:** blueprints, tiers, research stations (#97); per-faction standing and relations (#128); pirate factions (#137); contraband, scans, fence and
  black-market services (#141); hull planner, shipyard and engine capacity (#134); hull width rule and hull plan brushes (#145).
- **Combat and boarding:** combat rounds 1-2 with pacing, flee, telegraph, damage control, heat and the combat view (#184); readability and the steel palette (#211);
  boarding sim and HUD (#210, #214, #226); stuck-fight fixes (#231); drafted-crew control, roof fog of war, derelict ending (#117, #118).
- **Crew:** traits core with rolled skills and crew card (#243); tabbed crew inspector (#246); skill XP from routine work (#251); new-game flow with title screen,
  ship pick and crew roll (#249); three starter ships, Spine Hauler default (#247).
- **Crew AI:** Phase 0 profiling/baseline (#200), Phase 1 executor, task API and scheduler stub (#207); scheduling and bed-search perf (#196, #228).
- **Economy and world:** station jobs by type (#182); mining and refining as income (#229); trade trips (#115); PixiJS starmap (#124); space backdrop and body art (#219, #221).
- **UI:** ship's log, urgent alerts (#183); lessons engine, combat and trade lessons (#213, #227); Esc menu, settings, rebindable keys, save slots (#216);
  rotating autosaves in IndexedDB, game-over summary (#223); onboarding markers (#220); floating windows (#121); research tree (#114).
- **Tooling:** in-game bug report (#159, #230); gameplay wiki (#161); performance profiler (#189); faster test suite (#235); CI skips drafts and main pushes (#198);
  manual GitHub Pages deploy (#147).
- **Derelict salvage and away sites:** scrap items, scrapper and cages (#272, #279, #283, #296); salvage order, stripping jobs and
  the inspector panel (#273, #275); shuttle and EVA salvage teams (#277); air sources, air drive and suit refills (#291, #294);
  away sites with passages, batched round trips, pickups and robots (#295); salvage staging and gathered hauls (#297); boarding
  parties and shipyard contractors as away parties (#304).
- **Crew AI Phases 2-3:** global job scheduler (#263); data-driven utility engine and policies, hazard interrupt and leisure drive,
  need tasks as saved truth (#289, #290, #293).
- **Art and render:** pixel-perfect camera (#267); hatches and turrets above the roof (#262); walls and hull art pass (#299);
  loading screen (#271) and stuck sheet-load timeout (#282).
- **Bug batches:** #206, #218, #199, #232; doorway parking (#255); save failure alerts (#269); new-game preview (#270).

## In progress

- **No feature branch is listed as in flight.** The station hull for ground bases (#524) merged in #563 (render lab panel `station-hull`); open from it:
  diagonal far walls (#561), six eight-front keys fall back to the ship's art.

**Priority (user, 2026-11-15): the core loop.** "Make it playable first" (2026-11-08) is met: the playtest batch #384-#390 shipped
in #392. Next is more to find per node (#171, started: the node content table, asteroid field kinds and lost cargo #517 are in; probes, beacons and anomalies are not; danger bands #382 folded in: no visible bands, physical finds, plan in the #171 comment of 2026-11-15). #380 research,
#383 story arcs and #172/#52 goals queue behind them. The test overhaul (#371) landed in #555 (harness, scenario builder, near-test
`check:fast`, import-cycle ratchet). Follow-ups: #553 done (no import cycles in `src`, #560); cheaper ticks (#65) partly done: temperature and
gas solve every 4 ticks per ship with life support inside the gas solve, mood by ship, grid read cache (#565, #570), shared station/outpost test builds
(#574), and pairwise in-place gas mixing with a sparse write-back (#589: air system time −24% to −48%; breathing retuned to 0.1 O₂ in / 0.03 CO₂ out). Test-worker heap growth (#556) fixed in #581: the galaxy generator cache keeps two seeds, so a shared worker levels off near 300 MB.

- **Station generation: reviewed 2026-11-17** (stack #501, #527, #528, #529; design and file map in
  [STATION_ASSEMBLY.md](STATION_ASSEMBLY.md)).
  - Fixes from the review, in PRs: #533 (#530, every warehouse carries every item), #535 (#526, one hostile act wakes and
    provokes an outpost), #536 (#534, bed and work-site choice and fight/robot paths use `walkOpts`, so nobody is sent
    through thin air). Tooling: the sheets tool covers every family; a station that fails to build reports why.
  - Checked: #445 is fixed (farm stations have hydroponics). #444 stands: nothing attaches `bm.cartel`, `bm.zealot`,
    `bm.mercenary`; needs a decision on where each spawns.
  - Open from the review, not started:
    - Build time (done in #540): stations and outposts are built on a worker during the hyperspace hop, and the neighbours' and the plotted route's
      are prewarmed (`app/prewarm.ts`, `app/genRunner.ts`); the ring shape tests are cached.
    - Special cases to turn into recipe data: `prefab.ts` branches on plan names, `station.ts` reads `root.kind ===
      'prefab'` as "asteroid base", the candidate count (8 for `core`) is hardcoded in `assemble.ts`, `program.ts`
      names `module.vehicle_bay`/`module.pod_bay`.
    - Over the soft limit: `regions.ts` 500, `groundTurrets.ts` 443, `generate.ts` 435, `prefab.ts` 403 (all in `src/sim/shipgen`).
    - No direct tests of the assembler (hard checks, spacing, braces, retries), of `walkOpts`, or of a destroyed ground
      turret. Ground turrets have no stow/deploy art. #520 floor lip, #103 hull glitches.
  - User (2026-11-17): outposts share one skeleton; a layout per kind would be ideal but station layout matters little
    to play, so it is parked.
  - Debug: `?hook&seed=2`, then `__cc.dispatch({ type: 'debug.spawnOutpost', style: 'surface', kind: 'trading'|'farming'|…, seed, x: 150, y: 150 })`.
    Look at layouts in the layout lab (`/tools/layout/?station=station.<kind>&size=<size>&seed=N`), not in game.
- **Open bugs:** #444 (only one of four black markets spawns), #103 (hull glitches).
- **Open:** recruiting prisoners (#492); #300 in-node events; #303 augments as stat modifiers; #305 shuttle landing in a bay that breaks on approach.
- **Designed, not started:** the workbench (#320, sprite only; the rest of DESIGN.md "New modules" is built); crew implants (#311) needs its design pass; construction pods. Addictions are parked.
- **Waiting on the user:** shield art; a feature-completeness review of #205, #238 and #203.

## Done since #308 (one-liners; detail in the PRs, older notes in STATUS_ARCHIVE.md)

- **Encounters (#173, #60):** scenes, trader skiff, derelict, pirate ambush, comms window, distress freighter, medical pod (#309, #314, #327, #329, #343, #345).
- **Inspections (#138):** dock inspection, patrol hails, refusing and fighting (#359, #364, #370; interdictions #368, evade odds #367).
- **Drones (#318), mental breaks (#175), relationships (#239):** #323-#326, #328, #330-#331; trade window and station comms (#333, #335).
- **Playtest batch (2026-11-08):** #384-#390 in #392; bugs #378, #409, #410, #411, #405.
- **Perf:** #396, #398, #394, #399, #400, #401.
- **Crew:** schedules (#414), backgrounds and eleven skills (#420), no suit limit (#419), recovery pod and medic care (#457), room quality and leisure (#447, art #440).
- **Power:** reactor fuel and batteries (#422, #426, art #423); NPC fuel (#427).
- **Prisoners (#116, closed):** #461, #478, #480, #486, #487, #489, #495; prize value dropped.
- **Furniture and stores:** #462, #479, #482, #491, #499.
- **UI:** alerts (#458, #459); window frame (#470, completes #336); story comms (#471); window buttons (#473); docked inspector (#477); door vents (#469, #393); jobs window (#454); schedule gap fix (#455).
- **Hulls and stations:** #431, #432, #435, #437, #465, #466, #496, #497.
- **Tools:** layout lab (#433, #439, #468); state integrity (#467, #160); shipyard save replay (#463); agent play API (#418); wiki (#450, #456).

## Done since #499

- **Stations and bases (#501, #527-#529, #532, #563):** assembler, prefab kinds, ground turrets, landing pads, glass tubes, station hull look; station builds off the main thread (#540).
- **Test and tooling overhaul (#371):** harness, scenario builder, near-test `check:fast`, import-cycle ratchet (#555, #560, #558, #572, #583); test worker heap (#581).
- **Perf (#65):** temperature cadence, gas solve and pairwise air mixing (#565, #570, #589); shipgen speed (#576).
- **Ships and world:** NPC engine capacity (#568), ship shape pass (#564), lost cargo (#517), one deal flow (#552), arrival hostility (#550), playtest batch (#549).
- **Air:** door vents start open (#592); breathing retuned.
- **Layout lab refinements (#586).**

## Decisions (user)

- Desktop only; no phone layout work.
- GitHub issues track work.
- Shield tiers are 2x2, 2x3 and 3x3. Reactors are 2x2, 2x3 and 2x4.
- The derelict ending kills everyone aboard. Prisoners came with the black market phase (#116, shipped).
- Enemy roofs can't be lifted without a future scanning upgrade. Every ship but the player's is roofed until player crew are aboard; stations stay open unless at war with the player (#390).
- The balance-test cap is 12 minutes.
- Research nodes are inspectable only when researchable.
- Drafted-crew colour is lime `#7ae64a`.
- No special cases: general systems working together (robots aren't special; needs a crew member lacks count as met).
- Encounters follow emergent objectives: scenes set conditions, the sim resolves, an observer reads the outcome.
- Never weaken a test or swap its seed to make it pass; find the root cause.

## Open work, in order

The planned feature order lives in [ROADMAP.md](ROADMAP.md); the list below is the older engineering backlog.

1. The "In progress" list above.
2. Engine Mk II/III art (#105).
3. Renderer follow-ups (#123): render on demand, cached static layers, per-sprite culling.
4. Shipgen session (separate): generator backlog (#119), room layout audit (#122), hull glitches (#103).

Other open issues: #65 sim performance, #54, #53, #52, #50, #49, #48, #47, #158, #157, #193, #139, #212, #245, #485, #490, #320-#322, #162, #130-#133.

## Where things are

**Core systems art and crew portraits (both merged in #513):** reactor (2x2) and life support (1x2) have final Blender art for healthy, `.unpowered`, `.damaged`,
`.damaged.flicker` and `.destroyed`, picked by `stateArt` (render) generically by hp (pipeline `tools/blender/export_core_systems.py`, see ARCHITECTURE "Core systems").
The crew bar cards show a face: a front-facing Blender render of the crew member's real layers, palette-swapped like the world figure (`portraits` sprite family,
`render/portrait.ts`, `UiApi.portrait`). Not done: the legacy `tools/blender/build.py` crew pipeline has no portraits.

**Art sets:** the 2x set (`public/assets/2x/`), the `?art=` choice and the 2x fallback are gone. `public/assets/1x/` (64x32 art
drawn as hard 2x2 blocks) is the only art set; see "One art set" in [ARCHITECTURE.md](ARCHITECTURE.md). Older notes below that
mention 2x art describe the earlier state.

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
  - Shield generators and weapons can sit anywhere inside the ship; engines must touch the hull.
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

## Environment notes

- Blender 4.2 LTS headless: `tools/blender/setup.sh` installs it to `/opt/tools`. Previews render
  with Cycles CPU (EEVEE needs a GPU).
- Screenshots use `node_modules/playwright-core` 1.56 with
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, args
  `--use-gl=swiftshader --enable-unsafe-swiftshader`, against `npx vite preview --port <n>`.
- The pipeline's source body model is `tools/blender/source/base_cc0.glb` (CC0, see THIRD_PARTY.md).
- Agents work in separate git worktrees so they don't collide. Commit and push WIP often: sessions
  hit usage limits and the container can restart.

