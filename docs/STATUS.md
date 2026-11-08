# Project status and handoff

Living document: update it whenever a milestone lands, a decision is made, or a session ends.
Last updated: 2026-11-08.

**History:** completed-work logs, past PR notes and superseded decisions are in [STATUS_ARCHIVE.md](STATUS_ARCHIVE.md). Standing decisions that live there:
- Sector grid (user, 2026-10-19): each sector becomes one large chunked grid; ships never move or dock with each other; a jump takes the player's ship plus anything docked to it. Plan: "Sector grid (planned)" in ARCHITECTURE.md; user answers in the archive section "Sector grid decision".
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
scanner gate). Debug starts live in `app/scenarios/`. Save version 97.
Rules from its review: read a weapon module's def through `weaponDefOf` (or a shot's through `firedWeapon`), never `sim.content.weapons`
directly; every job aimed at a placed module posts `moduleSite` (`modules/footprint.ts`, the rotated footprint) so crew work it from any side.
Slice 2 (merged in #351): the seven behaviour upgrades in `content/upgradesBehaviour.ts`, all data over general fields: `WeaponDef.ammoPerShot`
(nuke: 2 missiles; `hasAmmo`/`consumeAmmo(n)` in `combat/ammo.ts`), effect `arc` (chain coil: lightning from the hit module into the nearest crew, `ifNoDrain`; event
`projectile.arc`), `WeaponDef.look` (render tint/blast/trail, carried on `weapon.fired`; `render/shotLook.ts`), plus patched shots, shield rule, speed, effects. Nuke is black-market
only and tagged contraband (no recipe, research or enemy carries). Lab panel `shots`. Numbers are a first pass.
Done: the art (#346: item sprites and UI icons for all ten, neutral shot sprites tinted by `shotLook`), so #338 is complete.

## Food and farming (#59, branch `feature/food-59`, not merged)

Hydroponics beds with a crop picker (greens, protein beans, medicinal herbs, grain; `content/crops.ts`), plant and harvest jobs (new "Farm" priority column), galley meals
by the cook's new `cooking` skill (bland, good, fine; `recipe.meal_greens`, `recipe.meal_beans`), meals eaten before rations with their own mood factor, herbs speeding a medical
bed (`module.med_bed` is now a patients-only bed), grain as a trade item. The three shipped starters carry a planted bed, 16 good meals and 6 greens (food indicator green).
Debug start `?scenario=farm`. Placeholder art (list in the PR): greens, grain, beans, herbs and the three meals borrow other items' sprites (`ItemDef.art`); no new sprites.
Starter `.ts` files were edited by hand (the python generators under `tools/shipgen/starters` are stale against them). Save version 104.

## On `main` now (merged PRs through #308)

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

- **Encounters (#173):** steps 1-4 merged (scenes, battle stations and the trader skiff in #309; the derelict in #314; the pirate
  ambush in #327). The comms window rework (layout E) merged in #329; the distress freighter in #343 (consent record, work blocks,
  threat-first targeting, suits for hot rooms, scene clocks start at deploy). The medical pod in #345 (escape pod vehicle, passengers as lodging guests, passage jobs, join offer, the shared `roleOf`). Step 6 is done. The ambush can grow slightly once relationships and interactions exist.
- **Shared-cause fixes (2026-11-08):** alerts built from state (#349, merged in #352: `src/app/alertsDerived.ts`, dismissals mute per kind until the condition clears); `heldItems` for item enumeration (`src/sim/items/held.ts`, merged in #351; story stock counts and takes, fit-job seizure (`where: 'fitting'`) and `playerShipId` for the adrift jump in #355); a dev/test guard for reads of the packed player ship (#350, merged in #353: `src/sim/packedGuard.ts`, 'throw' in tests, 'warn' in dev for tick code only).
- **Contraband inspections (#138):** step 1 (station dock inspection) merged in #359: `src/sim/inspect/`, inspectors as visitor crew from the station's shuttle (dock or EVA), haul up to the hold and impound the rest, sticky settle alert (fine / bribe / refuse), `Trader.barredUntil` (10 turns), `?scenario=inspect[&clean][&eva]`. Next: step 2, a patrol hail mid-jump in the world that replaces InterdictModal; then step 3, the refuse and fight consequences.
- **UI consistency (#336):** steps 1-3 merged (tokens; chips and meters; the `tip` action with `TipHost`, `PaneHead` and `Tabs` in #358). Step 4, one window frame and the decision bar, needs a mock sheet first.
- **Drones (#318) done:** repair and medic drones inside (#323, art #324); space flight, defence drones, recall (#325); outside
  breach seals, supplies, enemy drones, staggered landing (#326).
- **Mental breaks (#175) done** (#328, TRAITS.md section 5 "As built"); the grief stressor and the tantrum's relationship hit are seams for relationships.
- **Relationships (#239) done:** merged in #330, the Social tab in #331; see TRAITS.md section 6 "As built (#239)". `?scenario=bonds` shows it.
- **Designed, not started:** new modules (comfort, medical, gear, food: DESIGN.md "New modules");
  crew implants (#311) needs its design pass.
- **Next:** see [ROADMAP.md](ROADMAP.md): relationships (#239) merged in #330, its Social tab in #331. Trade and station rework (#332): the trade window (#333) and the station comms channel (#335) are merged; step 3 (a hologram sprite per station type) is dropped: the user prefers the scaled starmap icon, so #332 is done.
  Addictions are parked.
- **Open issues from 2026-11-03:** #300 in-node events; #303 augments as stat modifiers on the base species; #305 a shuttle
  landing in a bay that breaks on approach.
- **Waiting on the user:** shield art; a feature-completeness review of #205, #238 and #203.
- **Temporary:** NPC ships ignore engine capacity until shipgen gives big hulls enough engines (#129).

## Decisions (user)

- Desktop only; no phone layout work.
- GitHub issues track work.
- Shield tiers are 2x2, 2x3 and 3x3. Reactors are 2x2, 2x3 and 2x4.
- The derelict ending kills everyone aboard. Prisoners wait for the black market phase (#116).
- Enemy roofs can't be lifted without a future scanning upgrade.
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
4. Station intruder bug (#107); prisoners and prizes (#116).
5. Shipgen session (separate): generator backlog (#119), room layout audit (#122), hull glitches (#103), NPC engine capacity (#129).

Other open issues: #65 sim performance, #60, #59, #54, #53, #52, #51, #50, #49, #48, #47.

## Where things are

**Core systems art (`art/core-systems`):** final Blender art for the reactor (2x2) and life support (1x2): 4 rotations x healthy,
`.unpowered`, `.damaged`, `.damaged.flicker` (dark) and `.destroyed` (60 manifest entries with aliases; sheets `reactor`, `life_support`).
Footprints unchanged. `stateArt` (render) now also picks them generically by hp: destroyed at 0, damaged under half hp (flickering
340 ms lit / 170 ms dark while powered, dark variant while unpowered), then unpowered. Pipeline in `tools/blender/export_core_systems.py`
(see ARCHITECTURE "Core systems"). Awaiting visual approval of the live states before the PR.

**Crew portraits (branch `feat/crew-portraits`, PR open):** the crew bar cards show a face: a front-facing Blender render of the
crew member's real layers (head and shoulders, 58x62 px at 1x), palette-swapped like the world figure. New `portraits` sprite
family (`portrait_render.py`), `render/portrait.ts`, `UiApi.portrait`. The isometric crop was tried first and rejected (a tilted,
tiny head); a 2x render and tall cards were mocked and not taken. Bar cards are about 142x88 px, so `--hdr` grew to 100 / 180 px.
Not done: the legacy `tools/blender/build.py` (old `npm run assets` crew pipeline) has no portraits.

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

## Environment notes

- Blender 4.2 LTS headless: `tools/blender/setup.sh` installs it to `/opt/tools`. Previews render
  with Cycles CPU (EEVEE needs a GPU).
- Screenshots use `node_modules/playwright-core` 1.56 with
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, args
  `--use-gl=swiftshader --enable-unsafe-swiftshader`, against `npx vite preview --port <n>`.
- The pipeline's source body model is `tools/blender/source/base_cc0.glb` (CC0, see THIRD_PARTY.md).
- Agents work in separate git worktrees so they don't collide. Commit and push WIP often: sessions
  hit usage limits and the container can restart.

