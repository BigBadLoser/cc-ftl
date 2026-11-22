# Architecture

## Index

One line per section; read the index, then only the sections your task touches.

- [Stack](#stack): TypeScript (strict), Vite.
- [Layout and dependency direction](#layout-and-dependency-direction): src/
- [Simulation core](#simulation-core): Determinism.
- [Two kinds of state](#two-kinds-of-state): Shared sector tiles and ECS entities.
  - [1. Grids: tile fields as typed arrays](#1-grids-tile-fields-as-typed-arrays): Region views over the shared tile store.
  - [2. Entities: a small in-house ECS](#2-entities-a-small-in-house-ecs): Crew, modules, doors, items, projectiles, ships and so on. A few hundred to a few thousand entities.
- [Cross-cutting mechanisms](#cross-cutting-mechanisms): Stat resolver; effects; materials; hauling; one answer per question.
- [Content](#content): Content is TypeScript files exporting objects checked with satisfies WeaponDef (and so on): the
- [Rendering](#rendering): Two-way contract.
  - [Camera passes and layer ownership](#camera-passes-and-layer-ownership)
- [Test tiers](#test-tiers): fast (`check:fast`: near tests of the change), branch (`check:push`), slow, soak, full CI; `test:why` and `TICK_STATS` to see what a change selects and where time goes.
- [Test harness](#test-harness): `test/support/`: `run`, `nth`, `fixtureShip`, `expectReplayable`, `cachedWorld`, fixtures; who may import it; [writing a test](#writing-a-test) (start near the moment, no weakening, cost rules).
- [Scenario builder](#scenario-builder): `src/content/scenario/`: parts, presets and hooks found by glob; one builder for tests, `?scenario=` and the profiler.
- [Asset pipeline](#asset-pipeline): Asset creation is decoupled from asset rendering. Models are built as 3D in Blender, then
- [Crew AI](#crew-ai): The planned crew AI architecture (interrupts, utility AI, job scheduler, HFSM executor) is in...
- [UI](#ui): Svelte components read snapshots published by app after each tick, or on demand for
- [UI kit, `src/ui/kit/`](#ui-kit-srcuikit): Small in-house controls for panels, built on [Bits UI](https://bits-ui.com) (headless, Svelte 5: it...
- [Lessons (tutorials), `src/ui/lessons/`](#lessons-tutorials-srcuilessons): UI layer only (design: DESIGN.md, "Lessons"). LessonHost.svelte builds a LessonCtx from the snapshots and...
- [Keys, settings and the Esc menu](#keys-settings-and-the-esc-menu): Key map (src/ui/keymap/): every key the game answers to is an action in actions.ts (id, group, label,...
- [Saves](#saves): A save is the serialized sim: ECS component stores, grid arrays (base64 typed arrays), RNG state,
- [Enforced rules](#enforced-rules): which CLAUDE.md rules fail a check, and where (lint, ratchet tests, `pr-meta`).
- [Quality rules](#quality-rules): Sim systems get unit tests, plus scenario tests, for example "a 1-tile breach vents a 4×4 room
- [Milestones](#milestones): Pointer to the status archive (M0 to M8 history) and ROADMAP.md.
- [Working with Claude](#working-with-claude): Pointer to CLAUDE.md.
- [Derelict salvage, `src/sim/salvage/`](#derelict-salvage-srcsimsalvage): `salvage.order` puts a SalvageOrderC on a wreck; salvageSystem keeps stripping jobs (scrap-marked deconstructs) open and removes the stripped wreck; the order keeps an away site open on the wreck (its shuttle run brings the crew and takes the loot home).
- [Away sites and the air drive (#286)](#away-sites-and-the-air-drive-286): Air sources and stores, the air and return drives, `src/sim/away/` (AwaySiteC, SiteRunC, AwayC, passages, batched round trips, pickups, lost shuttles), the air ledger, the ownership table, staging; salvage on top. Build logs and plans are in the status archive.
  - [Travel time and air](#travel-time-and-air): `ai/travel.ts`, `eva/sources.ts`, air stores, the refill machine, admission, the pickup request.
  - [Home cover and the departure check, `src/sim/away/`](#home-cover-and-the-departure-check-srcsimaway): Passages rank below home needs; rules (a) to (c) before a shuttle leaves a member out.
  - [Boarding (#287), `src/sim/boarding/`](#boarding-287-srcsimboarding): Launch, site fields the owner chooses, recall, the boarding site owner.
  - [Sides (#287)](#sides-287): The shuttle's side instead of the player's.
  - [Throughput bench](#throughput-bench): `salvageBench` and its acceptance rule.
- [Drones, `src/sim/drones/`](#drones-srcsimdrones): Own entities (DroneC on a BodyC), one drone system, a job table per kind; core cap, bays, fly pathing, ion, placeholders.
- [Vehicles (shuttles), `src/sim/vehicles/`](#vehicles-shuttles-srcsimvehicles): A shuttle is an entity (VehicleC), never a grid. States: stowed (in its home bay), flying (sector x, y),...
- [Events (story), `src/sim/story/`](#events-story-srcsimstory): Events are data (EventDef, src/sim/story/defs.ts; content in src/content/events.ts, satisfies EventDef,...
- [Food and farming, `src/sim/farm/`](#food-and-farming-srcsimfarm): `PlotC` on hydroponics beds, `farmSystem`, plant and harvest jobs, meal quality from the cook's skill, herbs in medical beds.
- [Trade, `src/sim/trade/`](#trade-srcsimtrade): Terminology (user decision, 2026-10-19): a node is one playable grid or location (what older text and code...
- [Asteroids, `src/sim/asteroids/`, `mining/`, `rock/`, `outposts/`](#asteroids-srcsimasteroids-mining-rock-outposts): Region model: its own AsteroidC entity plus the owner layer (not a ShipC kind). An asteroid (one big body,...
- [Starmap (galaxy), `src/sim/galaxy/`](#starmap-galaxy-srcsimgalaxy): Galaxy state, the app snapshot, and the Svelte and Pixi starmap.
- [Sector grid](#sector-grid): Sparse tiles, ship views, and placement in the current node.
- [Historical sector-grid migration](#historical-sector-grid-migration): Pointer to the October refactor notes in the status archive.
- [Crew AI: one system for every ship (user principle, 2026-10-21)](#crew-ai-one-system-for-every-ship-user-principle-2026-10-21): NPCs use almost exactly the same crew AI as the player's crew. There is no parallel "NPC behaviour" stack:
- [Stations](#stations): Built by the station assembly, shipgen/stationBuild.ts (kinds and sizes in content/stations.ts; docs/STATION_ASSEMBLY.md) and stamped by
- [Crew for hire](#crew-for-hire): Trade stations post candidates derived from hashes (galaxy/recruit.ts, tuningRecruit.ts). While the player...
- [Engine capacity and the shipyard (progression phase 5)](#engine-capacity-and-the-shipyard-progression-phase-5): Size = the area inside the outer hull. hullArea(grid) (combat/hull.ts, interiorArea) counts every tile the...
- [Black markets, contraband, scans and the truce (progression phase 2b slice 2), `src/sim/blackmarket/`](#black-markets-contraband-scans-and-the-truce-progression-phase-2b-slice-2-srcsimblackmarket): Design: DESIGN.md "Pirate factions and the black market". Content: content/blackMarkets.ts...
  - [Pirate factions (phase 2b slice 1)](#pirate-factions-phase-2b-slice-1): Galaxy factions pirates (Scrappers), raiders, cartel, zealots, mercenaries, each with its own reputation...
- [Hull width rule and the hull plan brushes (#143)](#hull-width-rule-and-the-hull-plan-brushes-143): The rule. No part of a ship may be narrower than 3 tiles. The footprint (every struct tile except Space...
- [Station jobs by station type (issue #178)](#station-jobs-by-station-type-issue-178): Offers (galaxy/jobOffers.ts) are still a pure function of (seed, port, window, slot). The port's station...
- [Prisoner holding (stasis), `src/sim/stasis/` (#116)](#prisoner-holding-stasis-srcsimstasis-116): Full slab = frozen prisoner entity (StasisC), wheel slots, the stasis job, reserve and thaw, slabs by shuttle from a prize (rack), release of a frozen prisoner, prisoner deals at stations (slab delivered by shuttle); the owning reads render uses.
- [Windows, `src/sim/windows.ts` (#516)](#windows-srcsimwindowsts-516): A per-tile `window` code on Wall tiles; player-built, no gameplay effect.


The previous attempt (`bigbadloser/space-web-game`, **reference only, nothing is copied**) bloated
because systems called each other directly, game state lived in Svelte stores, things were built twice,
and polish came before gameplay. These rules exist to prevent that.

## Stack

- TypeScript (strict), Vite.
- **PixiJS** (v8) for the game view: 2D isometric pixel-art sprites.
- **Svelte 5** for the UI.
- **Vitest** for tests.
- ESLint with import-boundary rules.
- No ECS library, no schema library.

## Layout and dependency direction

```
src/
  sim/       pure game logic: ECS, grids, systems, commands, RNG, save format
  content/   game data as typed TS objects (weapons, species, modules, recipes, events…)
  render/    PixiJS: camera, depth-sorted sprite views (grid, crew, jobs), overlays, glow, asset loader
  ui/        Svelte components
  app/       wiring: boot, game loop, input, save/load, sim <-> render/ui bridge
```

- `tools/shipgen` is a dev-only viewer for generated ship layouts (PNG contact sheets, ASCII, live page); nothing in
  `src/` imports it.
- `sim` imports nothing from the other folders, and nothing from pixi.js, svelte or the DOM.
- `content` imports only types from `sim`. The sim receives content as a registry at boot, so tests can
  inject tiny fixtures.
- `render` and `ui` read sim state and never mutate it.
- `app` is the only place that knows about everything.
- Enforced by ESLint `no-restricted-imports`; a violation fails the build.
- No new import cycles in `src`: `tools/importCycles.test.ts` is a ratchet on the largest cycle, the files in cycles and the number of
  groups. It fails when a cycle appears or grows, and when one shrinks without its baseline being lowered in the same change. The plan to
  break the large feature-module cycle is #553.

## Simulation core

**Determinism.**
- Fixed tick (20 Hz). The renderer interpolates between ticks.
- A single seeded RNG lives in sim state. `Math.random` and `Date` are banned in `sim/`.
- The same seed and the same commands always give the same result.

**Tick pipeline.** One ordered list of system functions in `sim/pipeline.ts`. Systems never import or
call each other. The order is the only coupling, and it lives in one file.

**Commands in, events out.**
- The UI, input and AI produce **commands** (`AssignPriority`, `PlaceModule`, `FireAt`…). They're
  queued and applied at the start of a tick. This is the only way to change state from outside.
- Systems may emit **events** (`FireStarted`, `CrewDied`…) into an outbound buffer that the UI and audio
  read after the tick.
- **Events are never used for sim logic.** There is exactly one inbound channel and one outbound channel.

## Two kinds of state

### 1. Grids: tile fields as typed arrays

Each playable node has one sparse [sector grid](#sector-grid). A ship, station, derelict or wreck has a bounded
`ShipGrid` view over it. The shared store holds per-tile arrays for:
  - structure: floor, wall or hull type, door
  - flags: solid, walkable, breach
  - gases (O2, CO2)
  - temperature
  - fire
  - smoke
  - light
  - power
  - damage
  - room id

All tile writes go through a small grid API that also bumps a **revision counter** per field and per
chunk. The renderer diffs revisions, so there's no manual `markDirty()`.

The environment solvers use the same revisions to skip work (`SteadyState` in `sim/diffusion.ts`). A region whose
last solve wrote nothing, and none of whose input fields has been written since, is at a fixed point, so the solve
is skipped. Results are identical to a full solve. Lighting also keys on its lamps (powered, intact) and on the set
of open doors. Any new input a solver reads must join its key. `src/content/ships/envSkip.test.ts` compares the
solvers against cold-cache full solves.

**Systems interact through these fields.** For example:
- Fire reads O2 and material flammability, and writes heat and smoke while using up O2.
- Atmosphere diffuses gas across open tiles and vents through breaches.
- Crew health reads gases and heat on the crew member's tile.

New interactions should come from new field reads and writes, not new calls between systems.

### 2. Entities: a small in-house ECS

Crew, modules, doors, items, projectiles, ships and so on. A few hundred to a few thousand entities.

- Entities are numeric IDs, allocated deterministically.
- Components are **plain serializable data**: no classes, no functions, and other entities are
  referenced by ID only.
- Each component type has its own store. Queries are cached, and iteration order is stable.
- Systems are functions `(world, ctx) => void`.
- Target size: around 200 lines. Generic and boring on purpose.

## Cross-cutting mechanisms

**Stat resolver.**
- Species, traits, implants, items, conditions and modules contribute tagged **modifiers**
  (`add`, `mul` or `override`, optionally conditional).
- Systems ask `stat(entity, 'repairSpeed')` and never compute their own stacking.
- A new species or augment is then data only.

**Effects.**
- Weapon impacts, events and abilities produce typed **effect lists**: `pierceHull`, `ignite(p)`,
  `ion(t)`, `emp`, `spawnBoarders`, `giveItem`, `setFlag`…
- One effect applier writes them to fields and components.
- Weapon variety comes from mixing effects, not from new classes.

**Materials.** Flammability, conductivity, hull strength and permeability are content data that the
field systems read.

**Tile coordinates.** Runtime positions use sector tiles. Ship templates and generator plans use local tiles until
they are stamped into the [sector grid](#sector-grid).

**Hauling** (`items/haul.ts`, `items/stock.ts`, `items/plan.ts`).
- A haul job moves goods from a source (`floor` stack, `storage`, `vehicle` hold) to a destination (`storage`, `vehicle`, a `job`,
  or a staging `zone`). Planners post them (`haulJobsSystem` clears the floor into storage; cargo, construction, trade and away sites
  post their own); reservations are never stored, they are derived from the pending haul jobs, so a job that ends releases its claims.
- **Reach** (#476): `nearestStorageFor` only offers storage a load at its source can be carried to (`canCarry` in `items/stock.ts`, the
  suited walk's labelling, no search). At pickup the hauler checks its own way (`performHaul`); with none, it leaves the stack and stamps
  `ItemStack.stuckAt`, and `haulJobsSystem` leaves that stack alone for `WARN_DEBOUNCE` ticks. A load nobody can deliver stays put.
- **Gathering** (#286 slice 3, every ship): at a loose stack, a hauler with room left in hand takes the nearest unheld haul of another
  loose stack to the same destination, same work category, within `GATHER_RADIUS` and in their reach (labelling, no search) into the
  same trip (`HaulData.gathered`: what is in hand meanwhile, counted as on its way to the destination), until their carry capacity is
  full; then they walk to the destination once and put everything down (any item into any kind of destination).
- Crates: a loose stack is drawn as one crate per twelfth of the item's stack size (`STACK_CRATES`, `crateCount`, `crateUnits` in
  `items/stacks.ts`; `render/stackSlots.ts` lays them out), and a shuttle loads a staging zone a crate at a time.

**One answer per question.**
- Each game question has one owning function: can this crew member do this work or go out, is this tile breathable or
  passable, is this ship roofed, where is the air, does this stock exist, may this job run, is this job reachable.
- Systems, render and UI call the owner. They never rebuild the answer from their own checks, and a snapshot or cache
  stores the owner's answer rather than computing a parallel one.
- When a caller needs a slightly different answer, extend the owner with a parameter instead of forking a local copy.
- Why: copies drift. Most of the game's stubborn bugs have been two systems answering the same question differently
  (the scheduler posts a job a crew member's own rules refuse, the away drive thinks there is no air while the air
  system finds some, the UI warns about power the sim considers fine), which shows up as idle crew, ping-ponging
  shuttles and false alerts.
- No game-wide audit (user decision, 2026-11-09): when a fix runs into a duplicate, fold it into the owner in that PR.

**Galaxy.**
- Chunked and seeded, generated on demand (see "Starmap" below).
- Only the local area simulates at full fidelity. Distant places are abstract until visited.

## Content

- Content is TypeScript files exporting objects checked with `satisfies WeaponDef` (and so on): the
  compiler validates it and editors autocomplete it.
- Runtime validation (Valibot) only if we ever load untrusted JSON, such as mods.
- Content is referenced by string IDs (`weapon.laser_burst`) and resolved through the registry.

## Rendering

**Two-way contract.**
- The renderer reads the sim's world through a read-only view each frame.
- It keeps its own caches (sprites, containers) and updates them from revision diffs.
- It never writes to the sim.

**Pixel-perfect isometric 2D (PixiJS).**
- Tiles are 2:1 isometric, **64x32 px** in the art (drawn as 128x64 world px).
- Nearest-neighbour scaling, integer zoom steps only, and the camera snapped to whole pixels.
- Each art pixel maps to a whole number of device pixels.

**Assets come from the pipeline (see Asset pipeline).** By default the renderer draws game content from
sprite sheets listed in `public/assets/1x/manifest.json`. Shaders and effects may work on that art (tints,
masks, blends, lighting, such as damage revealing a tile's stripped sprite). Content may be drawn in code
where that is clearly the better tool, but sprites come first. Debug and overlay visuals (selection
frames, overlays, blueprints) and temporary placeholders while art is pending are drawn in code freely.
Each placeholder is replaced by pipeline art once that art exists.

**Depth sorting.** Draw order is by isometric depth (tile `x + y`, then height). Multi-tile objects
anchor at their front-most footprint tile. Crew sort by their interpolated sub-tile position.

### Camera passes and layer ownership

[`scene.ts`](../src/render/scene.ts) puts the backdrop, the shared `WorldStack` (`W`), and the sector air stack
(`SL`) on one Pixi stage. Region views add tiles, roofs, props, crew and local effects through `W.region()`.
Bodies near the deck use `W.low` so they sort against region art. Airborne bodies and sector combat effects
draw above that stack through `SL`.

| Stage content | Main view | Combat inset | Minified art bake |
| --- | --- | --- | --- |
| Region art and `W.low` | Live art or the baked texture | Live art | Into the texture |
| Sector air art and effects (`SL.sorted`, `SL.fx`, `SL.fxAdd`) | Live art or the baked texture | Live art | Into the texture |
| Per-region overlays (`W.ui`) | Drawn directly at the main scale | Hidden | Hidden |
| Sector overlays (`SL.ui`), including combat indicators and crew marks | Drawn directly at the main scale | Enabled | Hidden |
| Legacy target marks (`W.marks`) | Hidden | Hidden | Hidden |
| Space backdrop | Drawn when enabled | Flat inset background | Transparent clear |

`place()` positions both world stacks for each camera and sets overlay visibility. The inset renders the stage
into its own texture, then the main pass composites the inset sprite. Below camera scale 0.5, `renderMini()`
can bake the world at 0.5 and downsample it. The main pass then draws the backdrop, baked art, overlays and inset.
It falls back to drawing live art if the bake would exceed the texture budget. Check which passes need a new
overlay before choosing its parent. `SL.ui` is enabled in both cameras, and individual views still decide whether
they have anything to draw.

**Batching (#389).** Depth-sorted region art and low bodies interleave in depth bands. Each band has its own
Pixi `RenderLayer` and render group. Keep sprites in each band batchable:
- One batcher (`render/batch.ts`, replacing pixi's default): per-sprite effects are flag bits in the vertex data read by one
  shader, not separate batchers or blend modes. Additive glow (`batchAdditive`) draws under the normal blend with alpha 0, which
  is `add` exactly on an opaque target (only world glows opt in, never art drawn into a transparent texture); hull paint is
  `FLAG_PAINT` (`HullSprite`). A new per-sprite effect is a `registerFlagStep`, not a new batcher.
- No filters in the world: each filtered object is its own offscreen pass and cuts the batch. Crew figures composite in the
  shared crew atlas (`render/crewAtlas.ts`): every figure's layers stack in a cell of one texture, one composite pass a frame
  (palette and light tint per cell from a palette texture), and the world draws each figure as one sprite from it.
- No meshes with their own shader in the world either: a mesh is a draw call and cuts the batch the same way. Recolour shaders whose
  output depends only on their inputs (roof livery masks, container overlays) bake each distinct paint once into the shared paint
  atlas (`render/paintAtlas.ts`, keyed by every input) and the world shows it as a sprite; tint and alpha still apply.
- Render groups (`render/renderGroups.ts`): the world layers (`under`, `floor`, `decal`, `fx`, `ui`, `marks`, the backdrop) are each
  a pixi render group, so a camera move is one group transform and hiding layers for a pass (minified art, combat inset)
  rebuilds a short list of groups, not their sprites. A group root does not pass its blend mode down (`fxAdd` is not one).
- Depth bands (`render/depthBands.ts`): pixi rebuilds a group's whole instruction list when one zIndex in it changes, and a
  walking crew member changes its own every frame. The depth-sorted sprites are split by key (`zIndex` + region depth) into
  bands of `DEPTH_BAND_WIDTH`, each its own render group drawn in key order, so a step rebuilds only its band. The order is
  exactly the one sorted layer's (equal keys by a rank that mirrors its stable sort; `depthBands.test.ts` checks it against a
  model of that layer). Sprites keep their region's `DepthParent` as scene parent (transforms) but belong to their band's
  group. Wider bands mean fewer draws and bigger rebuilds.
- Culling: a region (ship scene) out of view of the main and the inset camera is hidden whole (`regionInView`); inside a shown
  region nothing is culled, since pixi 8 costs nothing per frame for a static sprite off screen. What costs is CPU work on scenes not drawn: a scene out of view updates every
  `HIDDEN_EVERY` (4th) frame and in full the frame it comes into view, before it is drawn; the crew atlas composites only the
  figures the world draws (`CrewAtlas.skipHidden`).
- Scene builds are spread over frames (`render/buildBudget.ts`): views ask a gate before each tile or roof chunk
  (`ChunkViews.sync`) and each module; a new scene builds within `BUILD_MS` a frame (each gate's first piece always goes)
  and stays hidden until an update builds nothing more (`ShipScene.ready`). A drawn scene stays drawn while its replacement
  builds (art arrived); a scene that art arrived for while it was building finishes, then is built again, so stand-ins never
  show. The camera ship with nothing drawn yet builds at once, and so does everything while `whenArtReady` waits (a loading
  screen). A roof that is not shown is plated in the background (`budget.idle()`, idle frames only).
  `__cc.buildBudget(false)` switches the budget, the throttle and the crew skip off for A/B runs.
- Measuring draw calls and A/B switches (`__cc.depthBands(false)` and the like): see "Render batching history (#389)" in [PROFILING.md](PROFILING.md).

**Crew.**
- Composited at runtime from **sprite layers**: a species body plus slot layers (hair, eyes, arms,
  implants, clothing, gear).
- Every layer is rendered in the same fixed frame and anchor (`tools/blender/sprites/crew_spec.py`), and has one sheet
  per clip (8 directions x that clip's frames), so the layers always line up and a new item or clip never
  touches existing sheets. A layer lacking a clip falls back to idle, or is hidden for the seated clips
  (`resolveClip` in `src/render/loadout.ts`).
- **Trimmed sheets** (`tools/blender/sprites/crew_trim.py`, run by `crew_pack.py`): a clip uses a small part of the frame, so
  each clip sheet is cropped to the union of its opaque pixels (image and glow, all directions and frames). The manifest
  clip records the cell size `cw`/`ch` and its offset `ox`/`oy` in the layer frame; the renderer cuts `cw x ch` cells and
  draws at `ox - anchor.x, oy - anchor.y` (`cellOf` in `assets/manifest.ts`). That is the whole contract: the layer's
  `frameW`/`frameH`/`anchor` and the muzzle offsets are unchanged, so no layer re-renders. At the old 128x64 art size it took the human set from
  12.3 GiB decoded to 0.93 GiB. `python3 -m sprites.crew_trim [assets dir]` (from `tools/blender`) trims an existing output
  in place (idempotent); the review tools that stack crew cells re-pad with `crew_trim.full_cell`.
- Layers are rendered in Blender with the rest of the character as a **holdout**, so the hidden parts
  are already cut out. Layers then stack in a fixed order in every direction.
- Which layers to use comes from sim components (species, role gear, implants, injuries, appearance
  seed).
- Skin, hair and cloth colours use **palette swap**. `team.*` materials render as reserved key colours,
  which a shader remaps per crew member.
- **Portraits** (the crew bar's faces; `sprites/portrait_render.py`, family `portraits`, `npm run sprites -- public/assets/1x portraits`,
  about 15 s): one **front-facing** render per crew layer, not the isometric camera. An orthographic camera looks along the
  horizon (4 degrees down) at the face, framed on head and shoulders (human head about 38 px tall), idle frame 0. Every
  layer of a species shares one 58x62 frame (56x60 plus the 1 px pad), so layers stack exactly, with the same holdout rules
  as the clip sheets and the same `team.*` key colours. Humans: every item but the EVA suit and the held weapons (holsters
  show); creatures: their one body, fitted by width. Robots have none: they are not crew (the bar leaves out `UiCrew.mechanical`). They pack as one static sheet `portraits`, assets
  `portrait.<crew layer id>` (about 20 KB), and load lazily through the normal env pool. `render/portrait.ts` (cached per
  species, role, appearance seed and weapon art: `portraitMath.portraitKey`) stacks the layers a crew member wears, runs the
  crew palette filter at zoom `ART_SCALE`, and reads the result back at whole art px (`Renderer.portrait(id)` ->
  `UiApi.portrait(id)`, a PNG data URL, `null` while the sheet loads; `CrewBar.svelte` shows it 1:1 with
  `image-rendering: pixelated`; dead crew are greyed and downed ones red-tinted with CSS filters). `Portraits.source` is the
  one place the pixels come from, so a higher-resolution source (a 2x render was tried: sharper, but needs a taller card)
  can replace it. `--hdr` in `ui/theme.css` is the header height the right-hand column hangs below: keep it above the
  crew bar's height.
- **Weapons, armour and cover** (`human_v2_weapons.py`, `human_aim.py`, `human_crouch.py`, `human_v2_armor.py`;
  weapons, armour and the fight fx are wired, cover is not: see "Wiring" below):
  - Held weapons are `crew.human.gear.hand.<weapon>` (slot order 55, over the arms). Each pose family has its own
    clips, and a weapon layer only exists in its family's:
    - `1h`: sidearm, ion_pistol, laser_pistol, plasma_cutter. Clips `aim_1h`, `fire_1h`, `walk_aim_1h`.
    - `2h`: rifle, laser_rifle, shotgun, smg, rail_rifle. Clips `aim_2h`, `fire_2h`, `walk_aim_2h`.
    - `heavy`: flamethrower, heavy_repeater. Clips `aim_heavy`, `fire_heavy`, `walk_heavy`.
    - `1m`: blade, shock_baton. Clips `ready_1m`, `swing_1m`.
    - `2m`: breach_axe. Clips `ready_2m`, `swing_2m`.
  - Cover:
    - `crouch_idle` and `crouch_walk` exist for every layer but the held weapons.
    - Crouched combat clips: `crouch_aim_1h`, `crouch_fire_1h`, `crouch_aim_2h`, `crouch_fire_2h`,
      `crouch_fire_heavy` and `crouch_ready_1m`.
    - Leans: `lean_l_1h`, `lean_r_1h`, `lean_l_2h`, `lean_r_2h`.
  - Every held weapon's clip entry carries `muzzle[direction][frame] = [x, y]`: the muzzle, or the tip for melee, in
    sprite px from the anchor. Flashes, tracers and beams start there.
  - Out of the hands a weapon is `crew.human.gear.holster.<weapon>` (slot order 45):
    - 1h guns ride in a hip holster; 1h melee hangs at the left hip.
    - Long guns and the axe are slung across the back.
    - Heavies are stowed on the back.

    Holsters have no combat clips. Show either the holster or the held layer, never both. The flamethrower also wears
    `gear.back.fuel_tanks`.
  - Armour: the security `torso.armor_vest`, plus `torso.armor_heavy`, `gear.shoulder.pads` (slot order 53) and
    `gear.head.heavy_helmet`. The heavy helmet covers the hair like the EVA helmet, so drop the hair layer under it.
  - **Wiring** (`render/handWeapon.ts`, `crewMuzzle.ts`, `crewSprites.ts`, `crewView.ts`, `loadout.ts`, `fightFx.ts`):
    - Content: `HandWeaponDef.art = { id, family }` on the hand items (`item.sidearm` -> `sidearm` 1h, `item.rifle` ->
      `rifle` 2h, `item.ion_pistol` -> `ion_pistol` 1h, `item.blade` -> `blade` 1m). The sim never reads it. Art weapons
      without an item yet (add the item with `art` and they draw): laser_pistol, plasma_cutter (1h); laser_rifle,
      shotgun, smg, rail_rifle (2h); flamethrower, heavy_repeater (heavy); shock_baton (1m); breach_axe (2m).
    - Loadout: a crew member with an art weapon wears both its holster and held layers (`crewLoadout(..., weapon)`); the
      slot is rebuilt when the equipped weapon changes. Robots and creatures (single body layer) and suited crew wear none.
      Security wears `armor_vest` and `gear.shoulder.pads`; the `role.marine` kit (no such role yet) wears `armor_heavy`,
      pads and `heavy_helmet` with no hair.
    - Clip choice (`crewView`): the fighter is engaged (`FighterC.mode === 'engage'`, kept up 1.5 s after) -> `aim_*` /
      `ready_*`; engaged and moving -> `walk_aim_*` / `walk_heavy` (melee walks plainly); the cooldown restarting (the
      shot tick) -> `fire_*` / `swing_*` once, or looped for the whole cooldown for `heavy`. Not engaged, seated, downed or
      floating -> the ordinary clip. A layer without the combat pose falls back (`loadout.CLIP_FALLBACK`: aim -> idle,
      fire -> aim, swing -> ready, walk_aim -> walk, crouch_* -> crouch_idle -> idle, lean -> idle).
    - Holster vs held (`handWeapon.layerShown`, `crewSprites.drawLayers`): the held layer is drawn only in combat clips
      and only once its sheet and the body's are loaded, the holster otherwise, so never both and never neither.
    - Lazy sheets: drafted or engaged crew with a weapon request the family's aim, fire and walk sheets on every layer
      once (`prefetchClips`), before the first shot.
    - Muzzle: `ClipDef.muzzle` is read by `crewMuzzle` (facing from `PositionC`, frame 0 of the fire clip; the swing's
      frame 2 for melee) and added to the feet's iso point in `fightFx`: flash and tracer start at the barrel, the melee
      slash at the tip. No weapon drawn (robots, bare hands): the old chest-height start.
    - Not wired: cover. The sim has per-shot `Cover` (`fight/los.ts`) but no crew posture, so `crouch_*` and `lean_*`
      clips only have fallback rules (`FAMILY.crouchAim/crouchFire` in `handWeapon.ts` list them) until a cover/posture
      state exists.

**Lighting.**
- Base sprites are lit in Blender with a fixed key light. A separate **glow sheet** (the emission pass)
  is drawn with additive blending.
- At runtime the sim's power and light fields tint the environment, and glow layers dim or switch off
  when unpowered. Red emergency glow pulses when power is out.
- Normal-map sheets for dynamic lighting are an option for later.

**Effects.** Fire flames are looping sprite frames plus glow. Smoke, embers, venting air and ice, module sparks and welding sparks are particles (`src/render/fx`): a small pooled system on Pixi `ParticleContainer`s with emitters as data, whole-pixel positions, integer scale and a hard cap. Particle art comes from the pipeline (`fx.*` in the env atlas). Renderer-only.

**Visuals.** Field overlays and the tile inspector read grid arrays directly.

## Test tiers

- **Fast tier, commit check** (`npm run check:fast`, before every commit): lint, typecheck, then the *near tests* of uncommitted changes
  (`tools/testFast.mjs`): test files within two imports of a changed file, plus edited test files, slow ones included only when edited. A
  `power.ts` edit runs about 6 files instead of about 300. With nothing uncommitted it checks the branch against `origin/main`, never zero
  tests. A change to `vite.config.ts`, `src/sim/testSetup.ts` or the lockfile runs the whole fast tier. A tuning file (`tuning*.ts`)
  counts from the files that use a constant whose declaration changed (`tools/nearTests.mjs`), not from every importer: a median edit to
  `tuning.ts` runs 1 file instead of about 310. A constant or helper that reads a changed one counts as changed too; a changed import
  line or a new file falls back to the whole file.
- **Branch check** (`npm run check:push` = lint, typecheck, `test:branch`, before pushing a work branch): every fast test Vitest's import graph
  links to a change since the merge base with `origin/main`. Most sim edits select about two thirds of the fast tier, because most tests step a
  game through `newGame` and the pipeline (#553). `git add` new files first.
- **What a change selects:** `npm run test:why -- <file>` lists the selected test files by import chain (`--top` lists the files most tests
  reach). `tools/importGraph.mjs` is the shared graph (value imports, dynamic `import()`, `import.meta.glob`, the `$lib` alias).
- **Where time goes:** 73% of fast-tier time is `Sim.step` (#371 measurement), so a test's cost is mostly its ticks. `TICK_STATS=1` with
  `node tools/tickStats.mjs` lists ticks, step time and ms per tick per file (instructions at the top of that file).
- **Slow tier** (`*.slow.test.ts`): sweeps and long runs. The fast tier skips them; `npm run check` and CI
  always run them. Today: the shipgen seed and depth sweeps, the end-to-end trade runs (`content/trade`, `ships/trade`), and the cheap
  guards of the soak tests (one seed or a short horizon asserting the same claim, e.g. `ships/pace`, `ships/balance`, `galaxyGrace`).
  Name a test `.slow.test.ts` only when it is a sweep whose failures a normal test would also hint at, never to hide a flaky test.
- **Soak tier** (`*.soak.test.ts`): design-number runs over game hours or many seeds (`ships/pace` 16 seeds, `crewBonds`, `galaxyGrace`,
  `galaxyTraffic`, `ships/balance`, `stationLife`, `ships/salvageBench`, `fuelEconomy`, the half-hour test of `ships/crewBreakdown`; #371).
  Excluded unless `VITEST_SOAK=1` (`vite.config.ts`); `npm run test:soak` runs it. In CI: the nightly run on `main`, a manual run and
  PRs labelled `soak` (job `soak`, 3 shards, weights in `tools/soakWeights.ts`). Each soak file keeps a guard in the slow tier; a soak copy
  is the full, unchanged version of the claim.
- **Full** (in CI on every ready PR push, in 8 time-balanced shards, and the nightly run on `main`; `npm run check` runs it locally): everything except soak.
  Files run longest first (`vitest.sequencer.ts`, weights in `tools/testWeights.ts`, refreshed by `npm run test:weights:ci` from CI timings).
- Vitest runs files in parallel, so one huge file sets the wall time. Split sweeps across files rather than growing one.
- Test files never import other test files: an imported `*.test.ts` runs its tests again in the importer.

## Test harness

Shared test helpers live in `test/support/` (repo root); use them instead of a local copy of `run`, `nth` or `fixtureShip`.

- `sim.ts` (sim-only; imports only `src/sim`, narrowly, so a test that uses it does not pull the whole pipeline into its import graph):
  - `run(sim, ticks = 1, { until?, stopBefore? })` (from `run.ts`) steps and drains events, returns the events; `step` steps without collecting. `until` is checked after each step,
    `stopBefore` before it (the first too). `runLog` returns them as strings (`command.rejected:<command>:<reason>` for a rejection),
    `runSim` returns `{ ticks, events, log }` when the tick count matters.
  - `nth(sim, n)` (ship by creation order, 1-based), `crewOn(sim, n)`, `eventsOf(events, type)`,
    `fixtureShip(sim, template)` (an inert prize ship at the origin).
- `world.ts` (sim-only):
  - `expectReplayable(build, ticks, { every = 10, saveAt? })` builds twice, steps both and compares `serialize` every `every` ticks;
    with `saveAt` one copy is saved and reloaded on the way; `events: []` collects the first copy's events for a test that also asserts something happened. A failure names the first tick that differs (it re-runs per tick to find it).
  - `cachedWorld(key, build)` builds once per test file (a `fileCache` from `test/support/cache.ts`, emptied after each file so a shared worker's heap does not grow) and returns a fresh `deserialize(serialize(world))` clone per call. Use it when many
    tests start from the same expensive state (a game run to a scene); build fresh when a test is about the build itself, or about
    state a save does not hold. Clones are independent: never share a mutable node or world between tests.
- `content.ts` (the only module that may import `content`): `content`, `cachedNewGame(seed)`.
- Import rule (lint): only `*.test.ts`, `*.slow.test.ts`, `*.soak.test.ts` and `test/support` may import `test/support`; the sim-only
  modules follow the sim's boundary (no `content`, `render`, `ui`, `app`), so `src/sim` tests can use them.
- `fixtures/` (`test/support/fixtures/*.ts`): scenario setups shared by test files (yard, shuttle, farm, stations, outposts, freighter,
  boarding, away, ferry, ...). They may reach content; none lives in `src/` any more. A fixture that builds an expensive start uses
  `cachedWorld` (the yard game, the shuttle scene, the farm game); building a game is cheap (`newGame` is about 9 ms), so cache only
  what steps or spawns.
- Tests import the module that owns what they use, never the sim barrel `src/sim/index.ts` (lint, `tools/lint/simBarrelBaseline.js`
  lists the few files not migrated yet; do not add to it). Through the barrel every test depends on the whole sim.
- Generated galaxy chunks are cached per (content, seed) and shared by every test in a worker, so `src/sim/testSetup.ts` deep-freezes
  them: a test that assigns `node.danger`, `node.faction` or `edge.fuel` fails with "read only". Play on `contentEdited(seed, key, edit)`
  or `contentAtDanger(seed, tier)` (`test/support/content.ts`): a copy of the content with its own generator whose chunks carry the edit.
- Where a sweep over seeds or sizes is too long for the fast tier, the fast test keeps one seed and the rest moves to the `.slow` file
  (`stations`, `outposts`); a long natural wait keeps a short version in the fast file that starts near the moment tested and the full
  wait in the `.slow` file (`food`, `shuttleDefence`).
- Turn systems off only in a focused unit test with an explicit list; never in a gameplay-outcome test.
- Where a branch case only needs the moment it tests (party aboard, reactor near its deadline), start there (set the timer, deploy
  from a cached scene) and keep one natural signal-to-rescue test on the production pipeline (`content/freighter.test.ts`).

### Writing a test

The rules the #371 migration followed; new tests follow them too.

- **Start near the moment tested.** Set the timer, crop or deadline just short of its end (`debug.*` commands, a scenario preset), stop at
  the first event the test checks (`run(..., { until })`), and build expensive starts once with `cachedWorld` / `cachedScenario`. Keep one
  natural end-to-end run of a flow on the production pipeline; branch cases start near their moment.
- **Never weaken to save time.** A shortened fast test keeps its claim; the original (natural wait, every seed, every-tick comparison) moves
  verbatim to a `*.slow.test.ts` beside it, never away. Count `expect(` and cases across the fast file, its slow file and its fixture: they
  may not drop, except for an exact duplicate folded into `expectReplayable`. Typical splits: one seed fast, the rest slow; saved states
  compared every 5–10 ticks fast, every tick slow.
- **Determinism and save round trips** go through `expectReplayable`, not a hand-written pair of runs, unless the test asserts more than
  it checks (several reload points, the saved JSON's shape); say why in the test.
- **Keep rule tests small.** Test a rule on a `World` or `Grid` by calling its owning function where practical; reach for `newGame` and
  `Sim.step` only for behaviour that needs the pipeline. Import the owning module, not `src/sim/index.ts`.
- **Fresh state per test.** Each test gets its own world (a `cachedWorld` clone or a fresh build); one that edits a generated node uses
  `contentEdited` / `contentAtDanger`. A new module-level cache in a test or fixture is a `fileCache()`.
- **Shared setup** goes in `test/support/fixtures/<name>.ts`, a run loop is the shared `run` (a local copy only when it returns or stops
  differently, and then as a thin wrapper), a scene a preset is likely to want is a scenario preset.
- **Isolation:** a test that mocks or spies, or changes shared or cached data, goes on `ISOLATED` in `tools/isolatedTests.ts`. So does one that
  needs a lot of heap by itself (`researchReach`, about 1.4 GB).
- **New or reshaped heavy files** get an estimate in `tools/testWeights.ts` (about 2.5 × the local time) until the next
  `npm run test:weights:ci`.

## Scenario builder

One builder (`src/content/scenario/`) makes a scene for tests, `?scenario=` and the profiler. A scene is a **spec** of independent parts; **presets** combine parts;
**hooks** are code that runs on a built scene. Nothing is listed centrally: parts, presets and hooks are found by `import.meta.glob`, so adding one is adding a
file (Vite resolves it in the browser build, Vitest and the profiler, which all run under Vite).

- `ScenarioSpec` (`types.ts`) is an interface with no keys of its own: each part adds its key by declaration merging. A part is `parts/<key>.ts`, default export
  `definePart({ key, after?, apply(ctx, slice) })`; parts apply in topological order of `after`. Parts: `ship` (the only one that makes the sim; hull, seed, crew,
  skip goals), `node` (warm-up ticks, hop to an empty neighbour, stations), `items`, `prep` and `steps` (scripts of commands and waits before / after the other
  parts), `events` (story flags, queued event, a trip to its signal, answers, deploy), `crew` (traits, xp, breaks, bonds, fire, drops), `modules` (beds near a module,
  plots, production orders), `ships` (enemy, generated, derelict, raider), `hooks`, `ui` (speed, selection, tool, camera: data the app applies; tests ignore it).
  A part changes the sim through commands (the `debug.*` ones, or a new one where none exists); a direct write is allowed only for pre-start setup tests already did
  (skip goals, a story flag, the queued event) and only inside the owning part.
- A preset is `presets/<name>.ts` (a nested `presets/<dir>/<name>.ts` is `<dir>.<name>`), default export `definePreset({ doc, params?, starter?, spec(params) })`. `params`
  are its URL knobs by kind (`flag`, `num`, `str`, `oneOf`). `buildScenario(name | spec, { seed, params, overrides, sim?, extraHooks? })` returns `Built`:
  the finished scene (the build steps the sim itself), `requests` (UI), `rejected` (command rejections by `command:reason`) and the hooks. `overrides` is a partial spec
  merged over the preset's (objects merge, arrays replace, `null` deletes); a key no part owns is an error.
- A hook is `hooks/<name>.ts`, `defineHook({ afterBuild?, tick?, event? })` with `ctx.after(ticks, fn)` / `ctx.when(pred, fn)` (tick-based, so deterministic). They read
  the sim and send commands. They are not `?hook` (the `__cc` debug API). The app loop calls `built.afterTick()` / `built.onEvents()`; tests and the profiler use `play(built, ticks)`
  or the same calls. Hooks: `inspect.fight`, `inspect.select`, `boarding`, `log`, `busy.arrive`, `medpod.deliver`, `stasis.unpowered`.
- Test helpers live in `test/support/scenario.ts`.
  - **Cached checkpoint.** `cachedScenario('inspect', { seed: 3, params: { stage: 'search' } }).sim` gives each test its own copy of
    the world with inspectors already aboard and searching. Use this when the starting state is fully captured by a save. The
    cache builds once per test file, keyed by the preset name and canonical JSON of the seed, params, overrides and extra hooks.
  - **Fresh scripted run.** Use `scenario('log', { seed: 3 })` and advance it with `play(built, ticks)` when the test depends on
    hook setup or scheduled callbacks. A cached clone restores the save and attaches fresh hooks with `afterBuild` skipped. For
    example, the callbacks that schedule the raider and credits in `log` live in memory and are lost on restore.
  - Turning sim systems off is not available; add it for a focused unit test when one needs it.
- `?scenario=<name>&<flag>...&seed=&starter=&credits=&items=&speed=&ticks=&hooks=` (`url.ts`); `src/app/scenarioStart.ts` builds it on the running game before the first frame and
  applies the UI requests. Profiler: `--scenario preset:<name>`.
- Adding things: a file in `presets/`, `parts/` or `hooks/`. Keep `import.meta.glob(` written exactly so in `registry.ts` (no type argument): Vitest's on-disk module cache
  skips a file only when it contains that text, and a cached registry would not see a file added later. `registry.test.ts` (fast) checks unique names, resolvable `after` and a part for
  every spec key; `presets.slow.test.ts` builds every preset on the app start and plays 100 ticks.

## Asset pipeline

Asset *creation* is decoupled from asset *rendering*. Models are built as 3D in Blender, then
**pre-rendered into isometric pixel-art sprite sheets**. The contract with the game is sprite sheets
plus JSON metadata plus the manifest.

```
tools/blender/
  setup.sh      installs a pinned headless Blender (the container is ephemeral)
  lib/          shared Python: palette, style kit (clean hard-surface shapes, smooth shading with
                toon-like bands; no faceting or noise), rig helpers, material conventions
  crew/         body plans (the CC0 Quaternius base for humans; see THIRD_PARTY.md), slot items
  sprites/      the sprite renderer: 2:1 ortho camera, supersample to block-mode downsample,
                palette quantization, 1 px outline, emission pass to glow sheet, packing and JSON
palette.json    the single palette, read by Blender scripts and the game
```

- **Loading and memory (`src/render/assets`, `artStream.ts`):** sheets are loaded on demand, never all at start (the art is
  1452 sheets, gigabytes if decoded at once, which crashed headless Chromium; phones need a few hundred MiB).
  - `loadAtlas` registers every manifest sheet in a `SheetStore` (`sheetStore.ts`, generic over the texture type so it is
    unit-tested without Pixi) in one of three pools: `core` (`EAGER_SHEETS`: walls, beams, the env item sheet and fx, loaded
    before the renderer starts and never evicted, ~92 MiB), `env` (every other static sheet) and `crew` (`crew.*` sheets).
    Image and glow twin load and free together. At most 4 loads run at once.
  - The atlas API is unchanged, but art may not be there yet. `stat(id)` / `firstOf(chain)` return undefined for an id whose
    sheet is not loaded and queue the load (an unloaded id ends a fallback chain: a later id is a worse stand-in, not an
    alternative; `loading(chain)` tells "on its way" from "absent", and `resolveArt` draws nothing for the former instead of
    the `FALLBACK` stand-in). `LayerSprite.frame()` is undefined until the clip's sheet is in.
  - Crew: the common clips (idle/walk/run/work) of a crew member's layers are queued when its figure appears, others on
    first use. While a clip loads `pickFrame` (`loadout.ts`) draws the layer's idle, then walk, so a figure is never
    blank. Crew sheets are evicted by idle time (`CREW_IDLE_MS`) when the `crew` pool is over `CREW_BUDGET` (64 MiB
    decoded; a typical crew needs ~50 MiB trimmed). Lookups happen every frame, so nothing holds a crew texture for long.
  - Static art is different: built sprites (gridView, roofs, modules) keep their textures. `atlas.generation` counts env/core
    sheets arriving or leaving; `createArtStream` (`artStream.ts`) rebuilds the ship scenes when it changes (immediately once
    nothing is loading, else at most once a second) and keeps a scene hidden while the sheets of its first build load (at
    most 3 s). When the `env` pool is over `ENV_BUDGET` (96 MiB) it runs a mark and sweep every 8 s (backing off when
    everything is in use): rebuild the scenes (marks the sheets they use), then evict the env sheets nothing used since.
  - Evicted sheets are destroyed one frame later (`atlas.tick()` after drawing), and are restored without a reload if asked
    for again in that frame. Sub-textures and baked halos of an evicted sheet are destroyed with it.
  - Each sheet is uploaded to the GPU as soon as it loads and its decoded ImageBitmap closed, so it is not held twice. After
    a lost WebGL context (`webglcontextlost`) drawing pauses until every loaded sheet has been decoded and uploaded again.
  - Debug: `?hook` gives `__cc.art()` (resident decoded bytes per pool, requests, pending, rebuilds, biggest sheets);
    `?crewmb=N` and `?envmb=N` override the budgets in MiB.
  - Not done: GPU texture compression (KTX2/Basis), and splitting the big static env sheets (vehicle_bay, weapons, containers)
    by family, which would shave the ~245 MiB the starting ship's env sheets take.
- **One art set (`public/assets/1x/`):** the split manifest (`manifest.json` index plus `manifest/<family>.json` parts, see the pipeline notes below) and `sprites/`. It is 64x32 pixel art that the game draws at half
  resolution, so each art pixel is a hard 2x2 block. The game's geometry (`iso.ts` `TILE_W`/`TILE_H` = 128x64, `Z_PX`) is in
  world px, and `ART_SCALE` (2) is the world px per art px that hand-tuned pixel literals are multiplied by.
  - `src/render/assets/compose.ts` turns the manifest into the one the renderer sees, in world px: frames, anchors, clip
    cells (`cw`/`ch`/`ox`/`oy`), muzzles and `heights.zPx` are multiplied by 2 and the sheets get texture `resolution` 0.5
    (loaded nearest, never smoothed). So nothing downstream knows the art's pixel size. Exceptions work in art px and
    convert through `texture.source.resolution`: alpha picking (`partPick.ts`, `alphaMask.ts`) and CSS item icons
    (`itemIcons.ts`). The crew filter's zoom is camera scale times `ART_SCALE` (`palette.ts` `artZoom`).
  - The pool budgets (`CREW_BUDGET`, `ENV_BUDGET`) are sized for these half-resolution sheets.
  - Tests: `sheets.contract.test.ts` (manifest contract), `compose.test.ts` (scaling, loading), `partPick.test.ts`
    (picking), `palette.test.ts` (crew filter), `heights.test.ts` (pipeline heights match the code).
- **Render pipeline (Blender):**
  - `tools/blender/sprites/scale.py` fixes the tile at 64x32 (`TILE_W`/`TILE_H`; `ART_SCALE` stays 1 as the multiplier for
    pixel literals written at that baseline). Output goes to `public/assets/1x/`; `scale.assets_dir()` returns that path.
    `build_sprites.py` refuses an outdir whose `manifest.json` has another tile size.
  - Cache keys include the tile size (env families hash `TILE_W/TILE_H`, crew hashes `FRAME_W/FRAME_H`). The sol/damage_sol
    scratch dir defaults to `sol-pack-1x` (`SOL_DIR` overrides it). `--cache-only` is a crew flag.
  - Direct run, one Blender process (add `-t N` for threads; the render caches live under `.cache/sprites/`):

    ```bash
    BL="$HOME/tools/blender-4.2.9-linux-x64/blender -b -t 4 --factory-startup --python-exit-code 1 --python tools/blender/sprites/build_sprites.py --"
    $BL public/assets/1x walls,consoles          # families are merged into public/assets/1x/manifest.json; the rest is kept
    $BL public/assets/1x crew                    # incremental: re-run after an interruption and finished frames are skipped (--plan reports hits/misses)
    python3 tools/blender/sprites/crew_check.py public/assets/1x      # sanity composite (optional)
    ```

    Check with `npm test -- src/render/assets`.
- **Run with `npm run sprites`** (Blender headless, writes `public/assets/1x/`). Generated sheets, JSON and the manifest are
  **committed**, because Cloudflare's build doesn't run Blender.
- **The manifest is split on disk (#596):** `manifest.json` is a small index (version, tile, keyColors, heights, `parts`) and
  `manifest/<part>.json` holds one family's sheets and assets, one entry per line, so a family rebuild rewrites only its own file
  and a diff shows only the sprites that changed. A part is the sheet name without its `.N` page suffix; every crew layer is in
  `crew`. `tools/blender/sprites/manifest_io.py` reads and writes it (`read_manifest` gives the whole manifest; `pack.save_manifest`
  writes only the parts that changed); `src/render/assets/manifestParts.ts` assembles it in the game (index first, then every part
  in parallel). Tests read it whole with `shippedManifest()` from `test/support/manifest.ts`.
- **Families:** the art is split into families that each render into their own sheets and are merged
  into the manifest (their old sheets and ids are replaced, everything else is kept), so one family can
  be rebuilt alone: `npm run sprites -- public/assets walls,consoles`. Families: `crew`, `portraits` (crew portrait renders, see "Crew"), `robots` (robot
  crew, see below), `aliens`, `robot_bay`, `env` (props,
  economy modules, items, the particle sprites), `walls` (floors, walls, hull, doors; the default partition pieces in `sprites/wall3d_v2.py`'s look), `consoles`, `weapons` (turrets and
  bays), `roof` (plating, edges, livery masks), `struct` (structural beams), `fx` (combat fx v2, see
  below), `fx_shield` (the shield dome's sprite pieces, see "Shield dome"), `windows` (#516: the hull's window runs `tile.hull.ext.o<o>.m<mask>.w1..w3` with `.tint`, the default walls' interior window `tile.wall.full.m<10|5>.win.l|m|r` and cut down `tile.wall[.low].m<10|5>.win.l|m|r`; `sprites/windows.py`, the pane see-through), `structure` (faction tile looks, see below), `galley`
  (the food pack, see below), `derelict` and `eggsac` (derelict dressing, see below), `starmap` (the map's pictures, see below), `cargo` (a delivery job's sealed hard case, `item.cargo_crate.l` and `.held`, `sprites/cargo.py`), `items` (the item pack, sheet `items`: `item.<id>.s/.m/.l/.held` for the items `env` does not draw, `sprites/items_now.py`, and for planned items not yet in content, `items_tech.py`, `items_materials.py`, `items_parts.py`, `items_goods.py`; shared shapes in `items_kit.py`) and `sol` (the engine, AI core and shield packs, rendered by their own scripts in
  `tools/blender/experiments/` and packed by `sprites/sol_pack.py`).
- **Ore refinery (`sheet refinery`, not a `families.py` family):** a 3x4 prop with 4 rotations x idle, `.unpowered`, and a 4-frame
  `.active` loop (`.active`, `.active.f1` to `.f3`); ids `module.refinery.rN[.state]` plus aliases. It is exported by its own
  driver, not by `npm run sprites`: it needs fixed per-rotation frames and anchors across states
  (`tools/blender/export_refinery.py` normalises them), which the family packer does not do. The model is
  `tools/blender/sprites/refinery_*.py` (`refinery_asset.build` places it and the operator console). Rebuild it with one
  Blender process, from the repo root, with the pinned Blender (`tools/blender/setup.sh`):

  ```bash
  OUT=/tmp/refinery-pack; BL="$(tools/blender/setup.sh)"
  env -u SPRITE_SS -u SPRITE_SAMPLES SPRITE_PREVIEW=0 "$BL" -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/export_refinery.py -- --pipeline "$PWD" --out $OUT/1x
  python3 tools/blender/validate_refinery.py --package $OUT/1x --pipeline "$PWD" --report $OUT/validation.json
  ```

  Then copy `$OUT/1x/sprites/refinery{,.glow}.png` into `public/assets/1x/sprites/` and merge `manifest.fragment.json` (sheets and
  assets) into the manifest (`pack.load_manifest`, `pack.merge`, `pack.save_manifest` on `public/assets/1x/manifest.json`), never replacing it. The pack was made at pipeline revision e8c50906;
  `refinery_pipeline.provenance` hashes the renderer files, so a renderer change invalidates its frame cache and the art should be
  re-exported. The `.blend` and review images are not kept in the repo.
- **Module state art (`moduleArt.ts` `stateArt`, `moduleView.ts`):** any module whose art has `<asset>.rN.unpowered` shows it while
  unpowered or disabled, and one with `<asset>.rN.active.f1` and up cycles `.active`, `.f1`... while it shows its active state
  (a crafting refinery), at `ANIM_FPS` = 4 from the render clock. The manifest carries no animation data, so the rate is a
  render-side constant. A frame change swaps the sprite's texture
  (`swapFrame`); the part is not rebuilt. Damage extends it: at 0 hp `<asset>.rN.destroyed`; under half hp (`DAMAGED_BELOW`) `.damaged`, which while powered alternates with the dark `.damaged.flicker` (`FLICKER_LIT_MS` 340 / `FLICKER_DARK_MS` 170, render clock, by texture swap; a frame without glow hides the glow part) and while unpowered stays on `.damaged.flicker`. Precedence: destroyed, damaged, unpowered, `.active` animation. Each applies only if the art has the id.
- **Core systems (reactor 2x2, life support 1x2; sheets `reactor`, `life_support`, not `families.py` families):** 4 rotations x healthy,
  `.unpowered`, `.damaged`, `.damaged.flicker` (dark, no glow) and `.destroyed`; ids `module.reactor.rN[.state]`,
  `module.life_support.rN[.state]` (content `module.lifeSupport` uses asset `module.life_support`) plus aliases. Exported by their own
  driver with the approval lock (`tools/blender/core_systems_approved.json`, hashes of the locked reference frames in
  `artifacts/core-systems-*`). Rebuild with one Blender process, from the repo root:

  ```bash
  OUT=/tmp/core-pack; BL="$(tools/blender/setup.sh)"
  SPRITE_PREVIEW=0 SPRITE_SS=4 SPRITE_SAMPLES=4 "$BL" -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/export_core_systems.py -- --out $OUT/1x
  python3 tools/blender/validate_core_systems.py --package $OUT/1x --report $OUT/validation.json
  ```

  Then copy `$OUT/1x/sprites/{reactor,life_support}{,.glow}.png` into `public/assets/1x/sprites/` and merge `manifest.fragment.json`
  (sheets and assets) into the manifest (`pack.merge`, then `pack.save_manifest`), replacing only those ids. Geometry, material or reference changes need a
  new approval lock. The `.blend` files and review images are not kept in the repo.
- **Wall corner fills (`walls`, the 47-tile blob set):** wall and hull pieces are picked by the 4-neighbour mask
  (N1 E2 S4 W8) plus corner bits (`tiles.ts` `wallCorners`: NE 1, SE 2, SW 4, NW 8, set when both arms beside the
  corner connect and the two edge tiles and the diagonal are all wall; a door breaks the block). Ids:
  `tile.wall.{full.|low.|}m<mask>c<bits>`, `tile.hull.{full.|}m<mask>c<bits>[.v1]`, end faces
  `tile.{fam}.{pre}end.{s|e}.c<bits>` (only the fills reaching that edge) and the rear ghost
  `tile.hull.ghost.m{6|7|14|15}c2[.r*]`. Each set bit fills that quadrant (`walls.Strip` `corners`), so a thick block
  is one mass: black cut tops, wall height inside interior walls, hull-top height inside the hull with the walls up.
  Every chain ends with the plain `m<mask>` id. Default look only for now: faction looks and breaches use the plain
  pieces. Walls with no floor round them take their light from up to 6 tiles away (`gridView` `wallLight`), so a thick
  block's top is lit evenly. Inside a thick hull band only the ring that touches space is hull: the tiles behind it are
  interior walls at wall height (1.85) with the walls up. They are not raised to the hull top, because no local rule
  tells the inside of a hull band from a 2-thick partition that joins the hull.
- **Hull side (`tiles.ts` `hullSide`):** which wall tiles are far hull (full height in cutaway) or near hull (a ghost
  in every level). The tile must touch space (8-neighbour). A run along x is near if nothing of the ship lies at +y up
  to the outside, and a run along y if nothing lies at +x. It is far if space lies right behind the run (-y, or -x for a
  run along y), or diagonally behind with no floor between (the outline's corners and steps). Every other wall is a
  partition. So a wall that touches space through a breach, a notch or beside its run stays a partition: cut in
  cutaway, never a ghost. The rays reach `HULL_RAY` (16) tiles, and `gridView` keys its chunks on the struct that far
  round them.
- **The hull from outside and its belly (`hull`, `sprites/hulltiles.py`, wired in `src/render/hullArt.ts`):**
  - Each tile of a ship (floor, wall, door) gets a hull key: the fronts of the ship's outline that shape it. The key
    comes from `hullKey.ts`, a port of `sprites/hull_outline.py` that its test checks against the Python output.
    `hull_keys.json` is the catalog the art is rendered for (`sprites/hull_catalog.py`). A key outside it, or a region
    with rock in it, keeps the old hull pieces.
  - Roofed: a near run or corner draws the run set's piece, `tile.hull.ext.o<o>.m<mask>`. A straight run uses one of its
    designs, `.a1` .. `.a3`, picked by a hash of the tile. Every other key draws `tile.hull.ext.g.<key>` and its roof
    stand-in `tile.roof.g.<key>`. The roof plating skips these tiles. The belly hangs under them.
  - Cutaway: near hull tiles, and floors their hull reaches, draw the belly instead of the old ghost.
    `tile.hull.belly.under.<key>` sits below the deck, and `.low.<key>` is its cut top. Each tile has a bay look,
    `.l<look>`, which is rendered only where it differs from the plain look.
  - Paint: the ship's armour colour multiplies each piece. Its deco colour multiplies the piece's deco layer `<id>.tint`
    (the piece's own px in its tint mask), drawn over it. Ships are plain for now. `?hullPaint=<armour>,<deco>` (hex)
    paints them all.
  - Station look (#524): a base standing on asteroid ground (`standsOnGround`, sim/outposts/state.ts, the one owner flag)
    draws `HullLook` "station" in place of the ship's, from the `station_hull` family (`sprites/station_hull*.py`, palette
    set `station`): roofed, `tile.hull.station.ext.*` (the run set, designs `.a1` .. `.a6`, windows), generic pieces
    `tile.hull.station.ext.g.<key>` and `tile.roof.station.g.<key>`, and no belly; against the foot a rock berm
    `tile.hull.station.berm.<key>.v<n>[.e<a><b>]` (`stationHull.ts` `bermId`, `sprites/station_berm.py`, set `berm`).
    The pieces stay unpainted grey, lit only; just each `.tint` livery mask takes the deco paint. Where the station has
    no art for a tile (diagonal far walls, #561; six eight-front keys) the ship's piece is drawn. Walls up: the far hull's
    cap `tile.hull.station.cap.m<mask>[c<c>]` goes over the partition piece (`tiles.ts` `wallPieces` `look`), and the near
    hull draws `tile.hull.station.low.<key>` (`lowId`), cut at the ship's rim height with the ship's cut black, a seam and
    a lit lip. Cache: `station_hull_walls.py` is its own module with its own palette set (`station_cut`), so changing it
    does not invalidate the family's cache. Render lab panel `station-hull`.
- **Beams (`struct`, `sprites/struct.py`, wired in `src/render/beamArt.ts` and `gridView.ts`):**
  - `struct.beam.<look>.m<mask>` is chosen by a 4-neighbour mask over beam tiles (N1 E2 S4 W8), anchored
    at the tile centre. The looks are `navy`, `drone`, `civil` and `scrap`, picked by faction.
  - The straight masks 5 and 10 also have `.v1` and `.v2`; pick one by a tile hash so long runs vary.
  - Overlays drawn on the same tile: `.flange.<n|e|s|w>` towards each hull-wall neighbour, and optionally
    `.cap.<d>` on a free end.
  - Beams top out about 0.6 high, so every wall view level uses the same sprites. A 2–3-thick beam reads as
    twin trusses tied at each tile.
  - Preview from a shipgen dump: `tools/blender/review/beams_preview.py <dir> <out> ship <txt> <seed> <look>`.
- **Cargo containers (sheets `containers*`; `src/render/containerBox.ts` is only the stand-in while art is missing; livery overlays `.paint` / `.lv` are recoloured by `containerPaint.ts`, logos `.logo.<company>` are plain sprites; variants `.v1`/`.v2` by id):** sealed container modules
  (`ModuleDef.container`, `src/sim/containers`) stand on Beam tiles clamped to a freighter frame. Ids the renderer asks
  for, most specific first (`moduleArt.containerChain`), anchored at the footprint's front tile like any module:
  - A container's cargo doors are on one short end, and that end always faces the frame it is clamped to (the clamp
    side; shipgen validation enforces it). The door end is part of the id: `container.<W>x<H>.r<N>.<n|e|s|w>`, with
    the doors drawn on that end (on r0 spines today: `.n` hangs below a spine, `.s` stands on one).
  - `container.<W>x<H>.r<N>.<end>[.damaged|.destroyed]`, then `container.<W>x<H>.r<N>.<end>`,
    `container.<W>x<H>.r<N>[.damaged|.destroyed]`, then `container.<W>x<H>.r<N>`, `container.<W>x<H>[.damaged|.destroyed]`,
    `container.<W>x<H>`. Sizes: `container.2x4` and `container.3x6`. On today's spines (along x) they stand at r0, the
    short end on the spine; r1 is for a spine running along y. `.damaged` under half hp, `.destroyed` at 0. Ruins also name
    `.patched` (a scrapper box welded shut, `RuinContainer.patched`) in their meta; the renderer shows it as `.damaged`.
  - `container.clamp.<n|e|s|w>`, then `container.clamp`: the clamp gripping the frame, one sprite at the middle tile of
    the clamped side (a separate layer so one clamp sprite serves every size).
  - A detached container (a free body, `render/containerBodyView.ts`) uses the same shell ids, no clamp, at the body's
    position. The beam sprites under a container are skipped (its seat), and frame beams end at it.
- **Faction structure looks** (`sprites/restyle.py`, `structure_looks.py`, `structure_scrap.py`, `structure.py`,
  family `structure`; preview only, no full build yet): the default wall, hull and floor tiles rebuilt per faction.
  Geometry, masks, heights, ghosts and cutaway are unchanged; only the surfaces differ.
  - Ids: the default id with a look segment after the family, `tile.<fam>.<look>.<rest>`:
    - `<look>` is `navy`, `drone`, `civil.v1`..`civil.v4` (pick one per ship), or `scrap.p1`..`scrap.p4` (pick one per
      tile by `tileHash`).
    - Examples: `tile.hull.navy.full.m10.v1`, `tile.wall.civil.v2.low.end.s`, `tile.hull.scrap.p3.belly.o1.m10`,
      `tile.hull.drone.drop.e`, `tile.floor.navy.a`.
    - Doors and the hull ghosts (`tile.hull.o*`, `tile.hull.ghost.*`) have no look sets: they read the same everywhere.
  - Wiring (`src/render/tiles.ts`): pass the ship's look into `wallPieces` and `floorChain`. Every chain then tries
    the look id first and keeps today's ids as the fallback:
    - `[look + v, look, base + v, base]`, where the look id is the base id with `.<look>` inserted after the family.
    - Faction to look, like `beamLookFor`: navy -> `navy`, drones -> `drone`, civilian -> `civil.v<n>` by ship
      hash, scrapper -> `scrap.p<n>` by tile hash.
  - Alts: the far hull (`tile.hull.<look>.m*`, `tile.hull.<look>.full.m*`) and the full interior walls
    (`tile.wall.<look>.full.m*`) of every look but scrap also come as `<look id>.a1`..`.a3`: one small feature in the
    middle of the tile (vent, hatch, porthole, terminal, status light) and, on the hull, a different layout for the
    lower plates (navy drawer boxes, civil seams, merged drone hexes). Edges are untouched, so alts tile with the plain
    pieces. The far hull is full height in every view level, so its cut and up alts match. Pick by `tileHash` (the
    preview uses `(hash >> 12) % 8` in 1..3, else plain) and put the alt id in front of the chain, ahead of `.v1`.
  - `restyle.restyled(look, key)` repaints any builder's polygons by colour role and surface position, so the scrap
    pass (`structure_scrap.Scrap(p, base)`) can wrap module builders too. Their faces are coarser, so patches swap
    whole faces to a donor colour and rust takes the lower faces.
  - Preview: `review/structure_preview.py` (a Python port of `wallPieces`), with STRUCT_IDS and STRUCT_LOOKS to narrow
    the build. It also writes `structure-alts-*.png`: plain and a1..a3 side by side per look.
- **Food pack** (`sprites/galley.py`, `mess.py`, family `galley`; sheets built):
  - `module.galley.r<r>[.active]` (2x1). The access tile is in front of the printer tower's hatch. The amber light
    shows only in `.active`. `module.galley` is the r0 copy that `fallback.ts` falls back to.
  - `item.ration.{s|m|l|held}`: meal trays that show their food. The UI icon is cut from `.m` (`app/itemIcons.ts`).
  - `module.mess_table.r<r>[.meal]` (2x1). `.meal` has trays and cups set on it for while crew eat.
  - `module.chair.r<r>` (1x1). The seat top is at `human_sit.SEAT_Z`, so the `sit_*` clips fit. A seated crew
    member faces `mess.SEAT_DIR[r]`, as at consoles.
  - `module.chair.front.r0` and `.r3`: the backrest alone. Draw it over a seated crew member (crew at K + 0.02,
    overlay at K + 0.03, as console fronts).
  - Not in the sim yet: tables, chairs and sitting to eat.
  - Meal and haul poses (`sprites/human_meal.py`: `carry`, `carry_idle`, `eat`, `sit_eat`; preview
    `review/meal_poses_preview.py`) are pose code only: they were written against the old crew renderer and are not in
    the clip table yet. To ship them: add `crew_spec.CLIPS` rows and `crew_clips.POSES` entries (`sit_eat` needs the
    mess chair as its holdout instead of the console chair), re-render the crew, and play them from `loadout.clipFor`.
- **Derelict dressing (`derelict`, `sprites/derelict.py` and `derelict_walls.py`; sheets built, not wired yet):** drawn
  over or in place of the normal tiles on a derelict.
  - Breaches: `tile.{wall|hull}.{full.|}m<mask>.breach` replaces the wall piece. The tear meets the same
    edge height on every side, so breached runs join. Where the -x / -y neighbour is intact, also draw
    `tile.{fam}.{full.|}breach.end.{w|n}`. In the cutaway, partitions need no end piece. Floor:
    `decay.breach.floor.v0..2`. Roof: `decay.breach.roof`.
  - Overlays drawn right after the tile they dress:
    - `decay.scorch.floor.v0..2` and `decay.growth.floor.v0..2` (alien membrane; nodules on the glow
      sheet).
    - `decay.burnt.<w>x<h>`: a char ring round a burnt-out module. Also darken the module by about half.
    - On a straight run's camera-facing face, where axis `x` is a run along x and `y` along y:
      `decay.scorch.{wall|hull}.<axis>.<level>.v0|v1`, `decay.growth.{wall|hull}.<axis>.<level>`,
      `decay.striplight.{wall|hull}.<axis>` (dim red, on the skirt, every level), and `.high` on the
      face (walls up only).
    - On the roof: `decay.scorch.roof.v0|v1`.
  - Props (one tile, no footprint):
    - debris: `decay.debris.{plates,cables,pipe,chunks,crate,junction}`; `.junction.spark` is the arc
      frame, so alternate it with `.junction`.
    - `decay.eggsac.{1x1|2x2}`: breakable egg sacs (1x1 and 2x2 footprints) that hatch an alien. They are thin
      membranes over fluid, with the see-through skin baked in by the render (`derelict_sac.py`, its own family
      `eggsac`; these sheets are built and committed). The states are:
      - `.cracked`: leaking.
      - `.hatch0`, `.hatch1`, `.hatch2`: it swells, rips open and falls open. Play these when it breaks and spawn
        the alien on `.hatch2`.
      - Wired: sacs are sim entities (`EggSacC`), drawn by `render/eggSacView.ts` from their state; ruin hooks of kind
        `eggsac` are no longer static dressing.
      - `.burst`: the deflated skin, left in its puddle.
    - `decay.eggs`, `decay.ai.scrap`, and `decay.ai.cables.{x|y}`, which tiles along a run.
    - `module.light.off` (alternate with `module.light` for a flicker) and `module.light.broken`.
    - `module.fabricator[.rN].dormant`: dark, with a red standby light.
  - Preview: `tools/blender/review/derelict_preview.py <assets> <out>`.
- **Heights:** walls 1.85 tiles, roof top 2.05 (`walls.HF`, `walls.hull_top()`). The manifest carries
  them (`heights`) and `src/render/heights.ts` mirrors them (a test checks the two agree). Roof-mounted
  art (turrets, dishes, the AI mast) is modelled on the roof plane and anchored at floor level, so the
  renderer never lifts real art; `ROOF_H` only lifts stand-ins, markers and projectile launch points.
- **Roof plating:** the module rule (4x4-tile armour modules, layout and colour by hash, patch and inset
  plates) and the livery plan live in Python (`roof_layout.py`, `roof_variants.py`, `roof_livery.py`)
  and are mirrored in `src/render/roofArt.ts`. Livery masks are key-coloured overlays recoloured by the
  livery shader (`src/render/livery.ts`). A faction's `art.livery` id names a list of schemes (`LIVERIES`
  in `roof_livery.py`, mirrored in `roofArt.ts`, a test keeps the two in sync); a ship picks one from its generating
  faction's list by name (`liveryFor`). The navy, civilian, scrapper and drone liveries share the classic ten; an
  unknown id falls back to them. `?livery=<id>` gives every ship that livery (screenshots).
- **Camera:** orthographic, yaw 45 degrees, 30 degree elevation. One 1x1 tile renders as an exact
  64x32 diamond.
- **Look:** flat colour bands (about 1.0 / 0.75 / 0.5 for top, left and right faces), muted palette
  with shade ramps, a dark 1 px outline taken from the neighbouring colour, binary alpha, and neon
  only in the glow pass.
- **Crew:** about 60 px tall in the art, 8 directions (no mirroring, since characters are asymmetric),
  clips at fixed frame counts (idle 4, walk 8, work 6, and more as needed).
  - **Sheets:** one per item and clip, `crew.human.torso.tee.walk` (+ `.glow` twin). The manifest layer
    `crew.human.torso.tee` lists its clips, each with its `sheet`. Every layer uses one fixed frame (128x120, feet
    anchor 64,94; `crew_spec.py`), so the frame never depends on what was rendered.
  - **Render cache and incremental builds** (`crew_build.py`, `crew_cache.py`, `crew_digest.py`; details in
    `tools/blender/README.md`): `npm run sprites -- -- public/assets crew` renders only the entries the gitignored
    cache (`.cache/sprites/crew`) lacks. One entry is one item, clip, direction and frame, keyed by a hash of the
    item's geometry, its holdout items' geometry, the clip, and the global inputs (rig, base, render code, settings,
    frame size). `--item`, `--clip`, `--force` and `--plan` narrow or force it.
  - **Cost of changes:** a new item or clip renders only itself. Changing a default item re-renders the layers
    above it (they hold it out). A rig, base, render-setting or frame-size change re-renders all crew.
  - **Rigid gear, later:** rigid, non-deforming gear (the pack, helmet, goggles) could be rendered once per
    direction and attached to the body's head/back anchor per frame at runtime, instead of being rendered per
    clip. The fixed frame and per-clip sheets make that a local change (a layer would list a `rigid` sheet and
    per-frame anchor offsets in its clips), but it is not built.
- **EVA spacesuit** (`sprites/human_suit.py`): human layers in the existing slots, not wired yet.
  - Layers:
    - `torso.eva`, `legs.eva`, `arm.L.eva`, `arm.R.eva`;
    - `arm.L.eva_cyber`: the engineer's suited cyber arm, with the sleeve to a sealed elbow ring;
    - `gear.head.eva_helmet` and `gear.back.eva_pack`.
  - A white hard shell, with the faction colour (`team.cloth`) on its panels and bands.
  - While the helmet is worn, the runtime should skip the `hair` and `eyes` slots. The pack is hidden when
    seated, like the engineer rig.
  - Suit layers cut only against the body and each other, so they never cut ordinary clothing.
  - New clip `eva_float` (4 frames) on the body and the suit layers only: drifting, tilted, legs trailing, with the pack's
    thrust puffs on the glow sheet. Map an EVA state to it in `clipFor`; walking in a suit uses `walk`.
- **Robot crew** (`sprites/robots.py`, `robot_kit.py`, `robot_render.py`): rigid parts on a joint rig, not skinned.
  - One body layer per type, in the crew layer format: `crew.robot.body.worker`, `crew.robot.body.repair` (hover
    drone) and `crew.robot_heavy.body.security`.
  - Clips are idle 4, walk 8, work 6, charge 4 (head sunk into its socket, charge cells filling) and wreck 1
    (split at the waist).
  - `team.cloth` is the faction shell and `team.accent` the seam; the eye and charge cells glow.
  - Look previews: `ROBOT_QUICK`, `ROBOT_REST` and `ROBOT_ANIM` builds, composited by `review/robots_preview.py`.
- **Aliens** (`sprites/alien.py`, `alien_render.py`, family `aliens`; wired): the derelict infestation, built
  on the robot rig kit. There is one sheet per creature in the crew layer format, with species `alien` and no gear:
  - `crew.alien.body.hunter`: the swarm melee unit, about 1 tile.
  - `crew.alien.body.brute`: the tank, about 1.5 tiles.
  - `crew.alien.body.spitter`: ranged; its `attack` clip spits a glowing glob.
  - Each sheet has 8 direction rows and the clips idle 4, run 6, attack 5, hurt 2 and dead 1 (the corpse that
    stays on the floor).
  - The look is dark violet chitin with lighter violet limbs and one lime accent; the eyes and sacs glow.
  - Previews: `ALIEN_QUICK` and `ALIEN_ANIM` builds, composited by `review/alien_preview.py`.
  - Wiring: species `species.alien_<kind>` wears `crew.alien.body.<kind>` (`render/loadout.ts`), through the crew view's
    single-sheet layer path like robots. `walk` falls back to `run`; an attack (the fight cooldown restarting) plays
    `attack` once, a hit plays `hurt` once, and a dead alien lies as its `dead` frame. The spitter's glob is still drawn
    in code (`render/fightFx.ts`, weapon `spit`); a glob sprite (`fx.alien.glob`, plus an impact splash) is wanted.
  - Sim: `src/sim/aliens/` (egg sacs, nests, aliens) and `systems/eggSacs.ts` / `systems/aliens.ts`; content
    `content/species.ts` (the three species), `content/roles.ts` (`role.alien_*`) and `content/creatures.ts` (hatch weights).
- **Robot bay** (`sprites/robot_bay.py`, family `robot_bay`): 1x2, in the robots' look (light shells over a dark frame,
  the status light as a single eye).
  - The cradle is the footprint's rotated (0, 0) tile (the sim's `rotateOffset`), and the tower is the rotated (0, 1)
    tile. The tower tile should be solid and the cradle walkable.
  - Sprites per rotation r:
    - `module.robot_bay.r<r>`: empty.
    - `.charging`: a walker docks.
    - `.charging.drone`: clamp out; the drone hangs from it.
    - `.assembling.<worker|repair|security>.f0..f7`: an 8-frame assembly loop at 8 fps (yellow tool arms riding
      carriages over a part-built robot).
  - Each charging state has a `.front` overlay. Layer like a console: bay at K, docked robot at K + 0.02, overlay at
    K + 0.03.
  - The docked robot faces away from the tower (r0: dir 6, r1: 0, r2: 2, r3: 4) and plays its `charge` clip.
  - Unpowered: glow off. Charging: pulse the glow in the renderer (about 0.55..1 over 1.6 s).
  - Welding sparks: fx particles at the welder tip.
  - Previews: `review/robot_bay_preview.py` (add `anim` for an MP4) and `review/robot_bay_shapes.py`.
- **Conventions:**
  - The anchor is the feet or front footprint point in each frame's JSON.
  - Material names carry meaning: `emissive.*` goes to the glow sheet, and `team.*` renders as
    palette-swap key colours.
  - Every asset has a manifest entry with its id, sheet, frames, anchor, footprint and layers.
    Content refers to assets by manifest id only.
- **Airlock (`airlock` family, `sprites/airlock.py`, wired in `render/airlockArt.ts`; sim footprint `[3, 4]`, layout in
  `ModuleDef.airlock.layout`):** 3 wide along the hull, the hull row plus 3 rows inboard, and a collar one tile outside the
  footprint (the dock point). Pod = inner door, hull tile = outer door, keep-out tiles = where crew work the unloaders' chutes.
  Only the hull block follows the wall level; everything else is drawn whole at every level. A docked shuttle is drawn in its
  airlock ship's sorted layer (`shuttleView` `dock`), 2.15 tiles past the dock point, settled to the deck. Every part
  is a 1x1 sprite anchored at its own tile, in module coordinates (u outward, v along the hull, the pod at
  u = v = 0):
  - `housing.r{n}.{closed,f1,f2,open}`: the pod and its inner door, at (0, 0). Never cut.
  - `light.r{n}.{red,green}`: the cycle light on the pod's top, drawn just above the pod.
  - `hull.r{n}.{up,cut,low}`: the pass-through block at (1, 0), replacing the hull tile. The plain hull either
    side keeps its normal tiles.
  - `collar.r{n}.{closed,f1,f2,open}[.docked]`: the collar and iris hatch (the outer door) at (2, 0), sorted
    like the engine bell (depth of the tile beyond the hull + 0.5). The mating face is 0.7 past the hull
    row's outer edge, so the docked shuttle moves out to meet it.
  - `unloader.r{n}.back` at (0, ±1) and `unloader.r{n}.front[.loaded]` at (-1, ±1): the same sprites on both
    sides. `.loaded` shows a crate in the chute while unloading.
  - `keepout.r{n}` at (-2, ±1) and `walk.r{n}` at (-1, 0) and (-2, 0): deck marks, drawn with the floor.
- **Combat fx v2 (`fx` family; `sprites/fx3d.py` lists it, built from `fxkit.py`, `fx_shots.py`, `fx_hits.py`, `fx_env.py`,
  `fx_hand.py`; preview `review/fx_preview.py`). Sheets `fx.png` / `fx.glow.png` are in `public/assets`; renderer not
  updated yet (see below).**
  Small 3D clusters rendered like any sprite: self-lit fire and energy (palette ramps `fxW..fxD`, laser `fxC*`, ion `fxI*`,
  shield `fxH*`, which feed the glow sheet) and lit smoke and metal. Frames are `fx.<name>.<n>`; `fx.<name>` is frame 0.
  - Ids (frames):
    - Shots, looping, pointing screen-right (rotate along the flight): `laser_bolt` 6, `mass_slug` 4, `missile` 4,
      `ion_bolt` 6, `fire_shell` 4, `pd_shot` 2. Same ids as the old shots, so `WeaponDef.projectileAsset` is unchanged.
    - Muzzle flashes, at the barrel tip, pointing screen-right: `muzzle.laser` 3, `muzzle.mass` 4, `muzzle.missile` 4,
      `muzzle.ion` 3, `muzzle.fire` 3, `muzzle.pd` 3.
    - Impacts, anchored at the hit point on the plate (roof height on a roofed ship): `impact.laser` 6, `impact.mass` 8 (the
      breach), `impact.ion` 6, `impact.fire` 7. Missiles use `explosion_large`, point-defence intercepts `explosion_small`.
    - Explosions, 12 frames each: `explosion_small`, `explosion`, `explosion_large`, `explosion_huge` (a ship breaking up:
      chain several at staggered times and positions, and throw `debris.{a,b,c}`, 8 tumble frames each, under gravity).
    - `ion_disabled` 4 (loop, drawn at roof height over a module ion has disabled). `shield_hit` 6 and `shield_edge` 4 are
      unused: the shield dome replaced them (below).
    - `fire` 8 (loop on a burning floor tile): same ids as the old fire, so `fxView` picks it up as is.
    - `decal.scorch.{0,1,2}`, `decal.breach`: static marks in the floor plane for damaged floor or roof tiles.
    - Crew fights (replace what `fightFx.ts` draws): `hand.muzzle.{sidearm,rifle,ion}` 3, `hand.tracer` 2, `hand.tracer.ion` 4,
      `hand.hit` 4 (a body), `hand.hit_spark` 4 (a robot or cover), `hand.hit_ion` 4, `hand.ricochet` 4 (a miss, on the floor
      or a wall), `hand.slash` 4 (melee, pointing at the target).
  - Renderer changes the art needs:
    - Draw fx like other sprites (normal blend) with the glow sheet added on top. Today `sectorFx` draws shots and flashes
      with `blendMode 'add'`, which makes smoke and debris vanish.
    - Play frames: shots loop (about 12 fps), muzzles, impacts and explosions play once (about 12 fps), then go. Today a
      flash is one sprite scaled up.
    - Wire muzzle flashes (barrel tip from the turret's aim) and per-weapon impacts in place of the shared
      `fx.pd_shot` flash and `fx.explosion_small`.
  - The old fx (`sprites/cfx.py`, and `props.py`'s fire) are out of the env family's jobs; the `fx` family's entries replaced
    theirs in the manifest. Their pixels stay in `env.png` until env is next rebuilt. The particle sprites (`fx.spark`,
    `fx.ember`, `fx.puff.*`, `fx.ice`) stay in env.
  - Until the renderer is updated, the shots and fire already show in game (same ids) but drawn the old way: additive,
    single frame for the shots, the old one-sprite flash.
- **Shield dome (#301; `render/shieldView.ts`, `shieldDome.ts`, `shieldFit.ts`, `shieldState.ts`; art family `fx_shield`).**
  A ship with shield layers up wears a dome round its hull, in the sector air layer (main view and combat panel alike).
  - Fit (`shieldFit.ts`): the bubble is a 3D ellipsoid standing on the ship's grid, its axes along the grid (tiles) and up
    (height units, `Z_PX` px each), sized so every hull tile corner at floor and roof height is inside, then padded
    (`MARGIN`); a thin hull keeps an oval (`MIN_ASPECT`) and the height is at least `MIN_RISE` of the narrow axis so it reads
    as a dome. Its outline on screen is the ellipsoid's isometric projection (an ellipse: centre, axes, turn), which the
    effects work in; `body` maps a screen point inside it back to the front of the shell in the unit-sphere frame. No grid:
    the bounding box from floor to roof.
  - Drawn by a shader (`shieldDome.ts`), one quad per ship, because it has to fit every hull: a sheen clear in the middle
    and near solid at the deep-blue rim, and a 1 art px hex lattice lying on the shell (laid round it from the top, cells
    `HEX_TILES` across), so it squashes with the view like the floor. Lit rings of cells count the layers from the outline
    in: one per layer plus one under the first, so a single layer still reads (a ring is `RING` cell sizes of turn away
    from the outline; the HUD pips give the exact count). It works in screen-aligned art pixels, so it sits with the pixel
    art. Colours are the `fxH*` / `fxI*` ramps plus a deeper rim blue. The render lab's `shield` panel draws it on a
    stand-in hull (`docs/RENDER_LAB.md`).
  - Effects, all in the shader and stepped at 12 fps (`shieldState.ts` `DOME_SEC`, `DOME_FPS`): a hit absorbed (a ring of lit
    cells runs out), ion (the rim rows near the hit turn violet and drain along the rim), a mass-driver pierce (a hole torn round
    the hit, closing again), a layer breaking (the ring it lit flashes white, its cells drop out, shards drift off), a layer returning (a
    new row sweeps on round the rim), shields down on a vent or lockout (the lattice sputters out with sparks), overcharge (a
    pulse). Up to `DOME_HITS` hits at once. Missiles pass through with no reaction.
  - Breaks and returns come from diffing `shield.layers` each frame (the sim has no event for a layer coming back); a drop
    to 0 while venting or locked out is a collapse, any other drop a break. Hits come from `projectile.shieldHit` (ion when
    the weapon has a `shieldDrain` effect) and from a `projectile.hit` through raised shields by a weapon that does not
    bypass them (the mass driver's pierce). The hit lands on the rim facing where the shot came from.
  - Sprite pieces (`fx_shield`, `sprites/fx_shield.py`), additive, at the hit point: `shield_flash` 10, `shield_flash.ion`
    10, `shield_pierce` 12 (turned along the shot), played at 14 fps.
- **Starmap art (`starmap` family, sheet `starmap`; `sprites/starmap.py`, `starmap_kit.py`, `starmap_bodies.py`,
  `starmap_icons.py`, `starmap_fleets.py`; preview `review/starmap_preview.py`):** pipeline
  sprites for the pictures the starmap shows, drawn by the Pixi starmap view (below). Lanes, node pips and territory outlines are
  pixel cells drawn in code, and labels are Pixi text.
  - **The Pixi view (`src/render/starmap/`, wired by `app`; the screen is `ui/StarmapView.svelte`).** The map is one canvas under the
    panels. The screen keeps the camera (centre and scale as plain numbers, the scale snapped to sixteenths of an octave so the pixel
    grid is rebuilt at few distinct scales), hit-testing, the panels and the level tabs, and tells the view what changed through the
    `StarmapGpu` interface (`ui/starmapGpu.ts`: `scene`, `camera`, `glide`, `tip`). `ui` and `render` cannot import each other, so the
    view's data types are the `ui/starmapApi.ts` snapshot types (an ESLint exception for `src/render/starmap` allows those two files,
    types only). One world container carries pan and zoom (position on a whole device px). The renderer runs with `roundPixels` off and
    each object opts in, so only the orbiting icons glide between pixels. A level (`level1/2/3.ts`) is rebuilt only when the map data or
    the level changes; areas, outlines and lanes are *pieces* built when they come into view and again on a zoom step (a pan only moves
    the camera); state changes (hover, selection, route) recolour pieces by tint and alpha instead of rebuilding. Frames are drawn on
    demand: on a camera or scene change, at the display rate while orbits are on screen, at 30 fps for the pulse alone. Textures are
    nearest-filtered sheet cuts (`art.ts`); owner-tinted icons are canvas colour swaps (a Pixi `tint` cannot map two key colours); the
    nebula and the starfield backdrop are drawn inside the canvas so the nebula's screen blend meets the backdrop. Labels are pooled
    Pixi `Text` at 1:1 device px.
  - Every sprite has a fixed square frame with the anchor at its centre, so the map places and scales it without knowing what
    was drawn. Sizes below are world px (what `compose.ts` hands out; the frames are half that in the file).
  - Bodies, `starmap.body.<kind>.v0..v2` and `starmap.body.<kind>` (= v0), kinds `star`, `red_dwarf`, `blue_giant`,
    `gas_giant`, `black_hole`, `nebula`: 192 px frame, body radius 60 px. Draw at scale `r / 60` (`layout.ts` `BODY_SIZE`),
    centred on the body; halos, the ring and the disc reach 1.6 r. Pick the variant by sector id from the `.v<n>` ids a
    kind has: three for most, six for `gas_giant` (v0..v2 ringed, v3..v5 without a ring). Stars, the black hole's
    disc and the nebula glow; the gas giant has no glow and is outlined. The nebula is glow only (its colour pixels are
    empty): draw it under the nodes.
  - More body kinds, same ids, frame and scale, art only (the sim's `BodyKind`, `BODY_SIZE` and `BODY_WEIGHTS` do not have
    them yet): `binary_star`, `white_dwarf`, `pulsar`, `protostar` (`sprites/starmap_stars.py`) and `ice_giant`,
    `lava_world`, `ocean_world` (`sprites/starmap_planets.py`, lit and outlined like the gas giant). Some keep a small core
    so their glow fits the frame: the white dwarf's core is 0.45 r, the pulsar's 0.22 r (its beams reach 1.6 r), the
    protostar's 0.36 r inside a disc out to 1.5 r. Suggested `BODY_SIZE` (r, clear): binary_star (26, 40), white_dwarf
    (11, 24), pulsar (16, 40), protostar (22, 34), ice_giant (18, 28), lava_world (10, 18), ocean_world (11, 18).
  - Structures, `starmap.struct.<kind>`, kinds `station_trade`, `station_military`, `station_research`, `den`, `asteroids`,
    `derelict` (`content/galaxy.ts` `structures`; a pirate-owned station is the den): frame 96 px (48 in the 1x file).
  - Fleets, `starmap.fleet.<role>.d0..d7`, roles `patrol`, `pirate`, `raider`, `trader`, `miner`, `player`: frame 96 px (48 in
    the 1x file). `d0` points east on screen, then clockwise by 45
    degrees (the SVG `rotate(heading)` sense), so `d = round(heading / 45) mod 8`. Each heading is the ground heading whose
    three-quarter projection points that way. One model scale per ship for all its headings, the one that makes its
    longest heading (east or west) about 46 px, each heading centred in the frame; north and south views stay shorter,
    foreshortened like the ships.
  - Icon drawing (crisp pixels): structure and fleet icons are a fixed screen size that steps with the map scale
    (`kit.ts` `iconSize`): below scale 1.4 the frames are used halved (a 2x2 average, made once as its own texture), above it full
    size, each at a whole number of device px per texel. Never draw a texture smaller than its art: a shrunk sprite is smoothed
    (soft), while an enlarged one keeps hard edges. Draw each texel as a whole number k >= 1 of device px, nearest-neighbour, at a
    device-pixel-aligned position: for a target screen size T (about 24 px for structures, 20 for fleets) and the frame's
    file px F, k = max(1, round(T * devicePixelRatio / F)) and the drawn size is F * k / devicePixelRatio. On a 3x phone
    that is 32 px structures and 27 px fleets (k 2).
  - Bodies follow the map scale (`r / 60`), so they are enlarged (crisp) when zoomed in and shrunk (soft) at the outer
    zooms; the backdrop is drawn 1:1.
  - Mini bodies for the Cluster view (`sprites/starmap_minis.py`): `starmap.mini.<kind>.v<n>` and `starmap.mini.<kind>`
    (= v0), one per body variant, the same scene shrunk to a sixth and rendered at that size: frame 32 px (16 in the 1x
    file), body radius 10 px. The Cluster view draws bodies at about 6 screen px radius, so draw these by the icon rule
    (whole device px per art px; on a 3x phone 21 px) and pick the same variant as the sector's body.
  - Exit markers (`sprites/starmap_exits.py`): `starmap.exit.gate` (a free-floating ring gate with emitter pods, a cyan
    membrane on the glow sheet) and `starmap.exit.rift` (a tear with a banded rim, a starry core and drifting shards), at the gateway where a gate or rift lane leaves the sector, in place
    of the thick or dashed lane end. Frame 96 px like the structures, same crisp rule.
  - Nebula field tiles (`sprites/starmap_fields.py`): `starmap.nebula.haze`, `.body`, `.core`, seamless 512 px tiles
    (256 in the 1x file, anchor 0,0), glow only, for the nebula field (`render/starmap/nebula.ts`). Tile each across the
    field (the sim's density tiles are 3000 map units) and show it where the density passes its step (about 0.15 haze,
    0.45 body, 0.8 core: a mask per step, hard edged for the stepped look), added at the opacity the map wants. The three
    steps are baked once into one canvas; the density is faded to nothing over the outer 12% of the square, so the contours close
    up before the edge and panning past the generated field never shows a cut.
  - `starmap.backdrop`: a 512 px tile of dim 1-2 px stars (anchor 0,0), colour only and transparent between stars; tile it
    over the map's background.
  - Tint: stations, the den and fleets paint their livery in the crew key colours (`keyColors`: `team.cloth` panels,
    `team.accent` trim, 5 shade steps each); recolour them per owner as the crew filter does (`palette.ts`: a pixel s x key
    becomes the owner's colour on the shade ramp `MULT`, 0.42 .. 1.22). Asteroids and derelicts carry no key colour.
  - Glow: as everywhere, the glow twin is added over the colour sprite (SVG/CSS: `mix-blend-mode: plus-lighter` or
    `screen`).
- **Backdrop bodies (`backdrop` family, sheet `backdrop`; `sprites/backdrop_bodies.py`, `backdrop_pulsar.py`):** the
  node's central body drawn large and dim behind the main view.
  - Ids: `backdrop.body.<kind>.v<n>`, and `backdrop.body.<kind>` (= v0), as `starmap.body.*`. Kinds and variants match the
    starmap bodies: `star`, `red_dwarf`, `blue_giant`, `black_hole` v0..v2; `gas_giant` v0..v5 (v0..v2 ringed); and,
    not spawned yet, `binary_star`, `white_dwarf`, `pulsar`, `protostar`, `ice_giant`, `lava_world`, `ocean_world`
    v0..v2. No nebula: the backdrop draws its own. Pick the variant by node with the same index as the starmap, so a
    node's backdrop body matches its starmap body.
  - Frame: 640 px square (320 in the 1x file), anchor at the centre, body radius 200 px (100), halos, rings and discs
    within 1.6 r. Rendered at full value and colour (the game dims and tints it); glow on the `.glow` twin.
  - Built by each kind's own starmap builder and seed, scaled up 10/3 with `starmap_kit.DETAIL = 3` times the sphere
    and ring faces. Stars go through `starmap_bodies.SOFTEN` for a soft, quickly fading halo and finer granulation;
    the pulsar has its own build (`backdrop_pulsar.py`, soft layered beams). Starmap renders are unchanged (`DETAIL` 1,
    no `SOFTEN`).

## Crew AI

The planned crew AI architecture (interrupts, utility AI, job scheduler, HFSM executor) is in [`docs/CREW_AI.md`](CREW_AI.md), issue #194. It's being implemented in phases.

Phase 1 (the executor, no behaviour change) lives in `src/sim/ai/`: `scheduleSystem` in the old `decide` slot runs the utility engine (`ai/utility.ts` over `content/policies.ts`, Phase 3), the need machines and the job scheduler; `workSystem` is the executor's work step; `interruptSystem` is a read-only forced-state detector. `AssignmentC` is written only through the task API (`reserveJob`, `attachJob`, `detachJob`, `abortTask`, lint-enforced), which keeps the `Task` mirror in step. See "Phase 1 as built" in the design doc.


**Schedules (#412).** Design: DESIGN.md "Schedules".
- `sim/clock.ts`: the ship clock, read from `sim.tick` (`HOUR_TICKS` from `GAME_HOUR_SEC`, start at `CLOCK_START_HOUR`); nothing extra is saved.
- `content/schedules.ts`: presets (`ScheduleDef`, `satisfies`), `ContentRegistry.schedules`; the `rotation` presets (Default, Late) are what crew without a row follow, in turn by person id.
- Schedule questions, in three files (split for #553 so the plan doesn't import the job scheduler):
  - `sim/crew/schedule.ts`, the plan: `ScheduleC` (24 block ids, saved), `hoursOf` (own row, else a rotation preset for colonists, else none),
    `blockAt` (the plan's block), `offDuty`, and `secToSleep` (for away planning: Sleep only, read from the plan, so a crew member on call in a
    planned Sleep hour still counts as in Sleep: no trip; #553 decision).
  - `sim/crew/onCall.ts`: `onCall` (a fight, Battle Stations, or an open emergency on their ship they would take; an empty console only for crew
    `admitLevel` would seat), `blockNow` (the block in force: `work` while on call) and `holdsSleep` (the needs system keeps a sleeper in bed).
  - `sim/crew/wake.ts`: `wakesFromSleep` (the scheduler's turn gets a scheduled sleeper up). `ai/crewKind.ts` answers which kind of crew member
    this is, for the rotation presets and the policy.
  - `crew/scheduleHandlers.ts`: `crew.schedule.set`, `crew.schedule.preset`, `crew.schedule.copy`.
- The engine reads the block once per evaluation: `DriveDef.blocks` (policy data) closes a drive in a block (`'off'`), forces it on with a score
  floor (`on`) or moves its entry line (`enter`). With the work drive closed the scheduler's turn hands nobody a job and idles them (a carried
  patient is still set down first).
- Away: `away/tripFit.ts` holds what the job scheduler asks (`tripWorthIt`: time on site before `secToSleep` longer than the round-trip flight; it gates `passageFits` and `siteWantsThem`; `staySec` is needs only; `ofSide`, `passageTiles`). In away/crew.ts: `scheduleHome` (Sleep or Free, read with `blockNow(sim, id, false)`) makes `awayReturn` due (Free only while the shuttle is beside the site), `passengerUrgent` (Sleep) and `tripDue` 'batch' (Free). `blockNow` reads Free as Work for a party member (`AwayC`), so they work on there.
- Snapshot: `Snapshot.clock` (day, hour, minute) and `UiCrew.schedule` / `block`.
## UI

- Svelte components read **snapshots** published by `app` after each tick, or on demand for
  inspectors. They never hold references into sim internals.
- Every action dispatches a command.
- UI-only state (open drawers, selected tab) lives in `ui/` and never touches the sim.
- Debug and tooling hooks in `app/`: `?hook` installs `window.__cc` (`debugHook.ts`), the developer tool: cheats, staging and renderer switches. `?agent`
  installs `window.__play` (`playHook.ts`, `playState.ts`, `playDescribe.ts`, `playElements.ts`), the playtest API for AI models in a headless browser: no cheats, it
  reads the same UI stores the player sees and its only writes are the player's own pause and speed controls and `step(seconds)`, which runs a paused sim tick by tick
  (`Loop.drain`, `Bridge.refresh` publish what that did). The two are separate on purpose and combine with other params. Without the flag nothing is installed. See README "Playtesting with AI agents".

## UI kit, `src/ui/kit/`

Small in-house controls for panels, built on [Bits UI](https://bits-ui.com) (headless, Svelte 5: it supplies keyboard, focus and
ARIA behaviour and no styling). The game keeps its own look: every kit component is styled here with the tokens in
`src/ui/theme.css` (sharp dark panels, the global `button.on` state, 40px touch targets, `--focus` ring), not by a styled library.

- Components: `Select`, `NumberStepper`, `Segmented`, `Chips`, `Tooltip`, `Dialog`, `Slider`, `SideTabs` (left-sidebar tabs), exported from `src/ui/kit/index.ts`.
  Props are plain values plus an `onChange` callback (controlled); options are `KitOption` (`value`, `label`, `sub`, `disabled`, `testId`).
- **Rule: panels import from `ui/kit` only, never `bits-ui`.** ESLint (`no-restricted-imports`) allows `bits-ui` only under
  `src/ui/kit`, so the library can be swapped by editing the kit alone. Panels still never mutate the sim; a kit control only reports a
  value and the panel dispatches the command.
- Adding one: create `src/ui/kit/<Name>.svelte` wrapping the Bits primitive (or plain Svelte if there is no fit), style it with theme tokens
  (add a token to `theme.css` rather than a literal), keep it working at 390px wide with a visible focus ring, put pure logic in a
  `<name>.ts` with a `*.test.ts` beside it, and export it from `index.ts`.
- Portalled parts (Select list, Tooltip, Dialog) render under `body`, so their styles are `:global` and namespaced `kit-*`.
- **Panel pieces** (combat view and later HUD): `Frame` (titled section frame: the title sits in a real gap in the border via `FrameGap`, so content
  behind a semi-transparent panel shows through, no background patch), `Meter` (bar with value), `Pips` (shield and charge pips), `Pill` and
  `StatusTag` (small labelled badges), `KeyBadge` (hotkey cap) and `ActionButton` (button with icon, label and `KeyBadge`). Their look comes from tokens
  in `theme.css` (`--frame-line`, `--frame-w`, `--track`, `--heat-low`, `--band`, `--health-good` and the other combat tokens). **New panels compose these** and add tokens
  rather than redrawing borders, bars or badges by hand; a panel component only lays its sections out.

## Lessons (tutorials), `src/ui/lessons/`

UI layer only (design: DESIGN.md, "Lessons"). `LessonHost.svelte` builds a `LessonCtx` from the snapshots and feeds `LessonEngine` (plain TS) every
frame with the signals since the last one: sim events and every queued command, from `api.onSignal` (`app/signals.ts` reads the command queue, so
an aim made while paused counts). The engine queues triggered lessons, opens one at a time (cooldown, waits while `ctx.busy`), pauses through
`api.setSpeed` and restores the player's speed (never unpausing a game they had paused). Seen lessons and the on/off switch are in localStorage
(`prefs.ts`); reset and the switch are in the debug panel until the Esc menu exists; `?lessons=reset` / `?lessons=off` for scripts.

**Adding a lesson:** write a `LessonDef` in `defs/<name>.ts` (`satisfies LessonDef`) and list it in `defs/index.ts`. A step has a `title`,
`say` (the speaker's line) and `keys` (short mechanics lines), or plain `text` without a speaker (`[Q]` renders a key badge, `**word**` a strong word), a `target` and `advance: 'gotIt'` or a condition (a "do" step); the lesson's optional `delay` (ms) lets
the scene settle between the trigger and the card. Conditions (`conditions.ts`): `onEvent`,
`onCommand` (with a match), `when` (a state of the context), `anyOf` / `allOf`. Targets (`targets.ts`): `uiTarget(anchor)` rings an element
carrying `data-lesson={anchor('...')}` (names are typed in `anchors.ts`; a kit `Frame` takes `lesson=`), `moduleTarget(pick)` rings a module in the
world through `api.moduleScreenRect`. A new condition or target kind is one shape in the `...Kinds` interface plus one evaluator or resolver beside
it; the engine does not change. If a lesson needs more of the game, add the field to `LessonCtx` and fill it in the host.
A lesson (or a step) names its `speaker` from `speakers.ts`: a fixed instructor (name, role, `look`), whose portrait the crew portrait
renderer draws from the look alone (`api.lookPortrait`); no speaker keeps the plain card.

## Keys, settings and the Esc menu

- **Key map** (`src/ui/keymap/`): every key the game answers to is an action in `actions.ts` (id, group, label, default chords, context).
  A chord is an optional `Shift+` and a `KeyboardEvent.code`, so bindings are physical keys. `keymap.matches(e, id)` is the only way a
  handler reads a key (App, the combat strip, lessons, the deploy picker, `app/input.ts` for camera and R, the profiler's F3); key badges
  read `keyLabel($keymap, id)`, and lesson text writes `[@combat.volley]` for the bound key. The player's changes live in localStorage
  (`cc-ftl.keys`, only the differences). Two actions on one key conflict when their contexts overlap, unless one `shares` the other on
  purpose (R drafts crew, rotates a module and picks weapon 4). Esc is fixed. A new key: add an action, then call `matches` in its handler.
- **Settings** (`src/ui/settings/`): a store in localStorage (`cc-ftl.settings`), applied live: `apply.ts` (pause on alert or in the
  background, tooltips off), `app/input.ts` (edge scroll, scroll and zoom speed, invert drag), App (FPS), main.ts (start speed).
  Lessons keep their own prefs.
- **Esc menu** (`src/ui/menu/`): Esc closes the top panel, else `api.cancel()` (order menu, tool or aim, selection), else opens the
  menu (Esc is the only way in). Settings and Controls are kit `SideTabs`, one group at a time. While it is open it holds the one modal gate (`holdModal` / `modalOpen` in `ui/keys.ts`, also held by the jump confirmation), and every game key handler stands aside; the App pauses the game and restores the speed.
- **Saves** (`app/saveStore.ts`): a `SaveStore` interface (list, read, write, remove, with name, date, turn and node) over IndexedDB (a save is over a megabyte;
  localStorage's quota held about four), with labels kept in memory after `ready()`; saves an older build left in localStorage are moved in on first run. The autosaves (a chain, newest first),
  a pre-combat snapshot and three named slots (`SLOT_IDS`). Loading a slot reloads the page into it.

## Saves

- A save is the serialized sim: ECS component stores, grid arrays (base64 typed arrays), RNG state,
  galaxy seed, explored chunks, flags and a **format version**.
- No migrations (prototype, decision 2026-10-19): `SAVE_VERSION` (`sim/save.ts`) is bumped whenever the shape changes, and a save of another version is refused (the game starts fresh).
- Content stays out of saves except as IDs.

## Enforced rules

Rules that fail a check rather than rely on being read. A ratchet is a baseline that may only go down: growth fails, and
so does shrinking without lowering the baseline in the same change.

| Rule | Check |
| --- | --- |
| Sim purity, dependency direction, pixi and bits-ui only where allowed | `npm run lint` (`eslint.config.js`) |
| No `vitest` or `test/` imports in non-test `src` files; no unused `eslint-disable` | `npm run lint` |
| Soft 400-line limit (ratchet) | `tools/fileSize.test.ts` |
| No new import cycles (ratchet) | `tools/importCycles.test.ts` |
| Systems never import each other; only `pipeline.ts` does (allow-list, empty) | `tools/systemImports.test.ts` |
| Tests that mock or stub are isolated (list: `tools/isolatedTests.ts`) | `tools/isolatedMocks.test.ts` |
| No new copy-paste (ratchet, jscpd 5, settings in `.jscpd.json`; part of `npm run test:rules`) | `tools/duplication.test.ts` |
| PR links an issue, branch prefix, no model names in commits or body | `.github/workflows/pr-meta.yml` (`tools/prMeta.mjs`) |
| Lint, typecheck and branch tests on agent work | `checks:` in `.harness.yml` |

## Quality rules

- Sim systems get unit tests, plus **scenario tests**, for example "a 1-tile breach vents a 4×4 room
  below 5% O2 within N ticks".
- Soft limit of about 400 lines per file. Splitting is preferred to growing.
- No test or demo code in `src/`.
- **Polish follows gameplay:** no VFX or juice work on a system until its loop is playable.
- One way to do each thing: one pathfinder, one event channel, one ECS.

## Milestones

Milestone history (M0 to M8) is in the [status archive](STATUS_ARCHIVE.md); the plan is [ROADMAP.md](ROADMAP.md).

## Working with Claude

See `CLAUDE.md` ("Workflow", "Agents").

## Derelict salvage, `src/sim/salvage/`

Slices 2 and 4 of #268 (the order and the stripping; the salvage teams). Slice 3 is the inspector panel (`ui/SalvagePanel.svelte`, `app/shuttleSnapshot.ts`).

- **Order.** `salvage.order {ship, types}` / `salvage.cancel {ship}`. On any wreck (derelicts, and ships wrecked in combat or scuttled, which have no `ruin`); refused for robot-only content (`robotOnly`), when
  nothing of the ticked types is left (`nothingToStrip`) and for bad types. `SalvageOrderC` on the wreck: `types`, `status` ('running' or 'blocked'), `block`.
  Ordering again changes the types (open jobs are dropped and re-planned).
- **Parts.** `ModuleDef.scrap` tags a module with its scrap type (robot modules have none and are never touched). Walls, doors and beams are hull.
  `partsOf` lists what an order still strips; `planJobs` posts the jobs: ordinary `moduleDecon` / `deconstruct` jobs with `Job.scrap` set, so `jobWork`
  spills scrap (`salvage/yield.ts`) instead of the refund. Order: modules, then walls and doors (they come down to floor), then floors,
  farthest-from-the-crew first, one distance level at a time, so crew never cut themselves off. A floor comes down to open space.
  Of the floors that may come down, `strandNobody` (`salvage/footing.ts`) keeps those that neither split the deck left (an articulation
  tile of the Floor and Door tiles, Tarjan) nor are the only footing of a tile a crew member stands on; with none such it gives them all
  (the last tile has to strand its stripper: the recall fetches them like a pickup). So the deck stays one piece to its last tile.
  `strippableFloors` (#286 slice 3, user decision 2026-11-03): a floor with a loose stack on it waits, and so do the tiles of the site's
  staging zone (read from its `StagingC`) until the site is closing, or the zone is empty and no other floor can come down now (none
  left, or none the crew can reach: otherwise an unreachable floor held the zone for ever); every other floor
  comes down while loot waits elsewhere or the shuttle is away. (Before, every floor waited until no stack lay anywhere on the wreck.)
  A zone tile taken at the end is replaced by `keepZone`'s 5 s look.
- **Yield.** item count of the part's build cost x `SALVAGE_FRAC` (0.4), stochastic rounding on the sim rng, capped at cost - 1 (a 1-item floor yields nothing).
- **System.** `salvageSystem` (every `SALVAGE_EVERY` ticks, after `haulCleanupSystem`): hostile aboard (a living, non-surrendered hostile crew member, an egg sac or a nest)
  blocks the order and drops its open jobs; at most `SALVAGE_JOBS_OPEN` jobs per wreck; when nothing of the ticked types is left it emits `salvage.done`
  and, if the wreck is an empty shell, `removeWreck` clears its tiles, jobs, modules, stacks, corpses, sacs and the ShipC. Events: `salvage.ordered|blocked|done`.
- **Reach.** While crew of the player's side stand on the wreck, `planJobs` skips parts none of them can reach (`reach.ts`: the scheduler's walk modes, components labelling, no search)
  and drops open jobs nobody holds that none of them can reach, so they never hold a place under the cap; a stage whose parts are all out of reach lets the next one
  start (modules sealed in a hall: the walls come down first). With nobody aboard nothing is judged out of reach.
- **On an away site (`site.ts`, #286 slice 3).** The salvage team code is gone; salvage sits on the general away site (below, "Away sites and the
  air drive"). While an order runs and has work (stripping left, or loose loot to carry off), `tendSite` keeps an `AwaySiteC {owner: 'salvage'}`
  open on the wreck: it opens one with the lowest free shuttle that can serve a site (`openSite`, `siteShuttleOk`: free by ferry rules, EVA,
  in a bay on the home ship), else the order is blocked `noShuttle`; the site's `noCrew` (passages untaken) shows as the order's `noCrew`.
  It writes the site's `demand` (`salvageDemand`): construction = the open stripping jobs nobody holds, hauling = the loose stacks outside the staging zone, or 1 while
  none lie loose but stripping jobs are open (the loot to come), so the first trip has a hauling seat. A hostile aboard, or no work left,
  closes the site (`closing`: the party comes home, the run ends); a site whose order is gone (cancelled) is closed by `closeOrphanSites`.
  The order finishes once no stripping is left and the open site has carried off the loose loot (loot it cannot take home, `noRoom` or
  `stranded`, does not hold it open), and the wreck goes once the site has closed (its run ends with everyone home). Salvage code is now only what to cut, the loot and the hold's demand: the
  crew, the trips, refills, pickups, rescue and the return are the site's. The panel shows the site's `noRoom` / `stranded` while the order
  runs, and the shuttle panel the run's phase (`app/shuttleSnapshot.ts`).
- **Guard.** `job.build`, `job.deconstruct`, `job.buildModule` and `job.deconstructModule` are rejected (`wreck`) on any ship in state 'wreck'; `job.forceDoor` still works.
  Crew of the player on a wreck are not 'boarding' (`isBoarding`: an invader on a wreck is off duty no longer), so they take jobs there like on any ship.

## Away sites and the air drive (#286)

Slices 0 to 3 are built (below). Gameplay side: DESIGN.md "Air, away sites and salvage (#286; built)". Plans, build logs and removed-code lists moved to the [status archive](STATUS_ARCHIVE.md).

**Slice 1 is built** (branch `air/drive-286`):
- **The drive.** `air` in `content/policies.ts` is first in the colonist, station and npc policies (robots have none). Its inputs live in `ai/airNeed.ts`:
  - `airMargin` maps the air left onto the two travel-time lines: 500 is critical, 1000 is refill.
  - `airSource` blocks the drive when no source can be reached.
  - The nearest-source search runs at most once per `AIR_EVAL_TICKS` and is kept in `Intent.air`, so a load reads the same numbers.
  - The drive applies only while a suited tank drains: needs air, suited, standing on a thin tile. Everyone: the salvage team and yard crew exemptions went in slice 3.
- **The turn.** `ai/machines/air.ts` `airTurn` is the drive's machine (`task: 'eva'`, the refill errand).
  - It nests: the errand's `resume` keeps the job reserved and hands it back.
  - A haul load is put down and the haul dropped.
  - A carried patient is set down only at critical (`breaksFinish`). Any abort that disposes of the carry (`air`, `hazard`, `fight`, `halted`, `equip`) now sets the patient down through `ai/setDown.ts`. It picks the nearest tile within `SETDOWN_STEPS` (4) that is safe for the patient, falling back to the rescuer's tile. The patient keeps `Downed.bed`, and the rescue job is re-aimed at them so the next rescuer can lift them. Before this, the patient kept riding the rescuer.
  - A jobless task, such as a walk to a claimed bed, ends through `abortTask('air')`, which also gives the bed back.
  - There is no `NEST_HOLD_SEC` timeout yet: a refill always ends (full tank, or an abort releases the parked job through the errand sweep).
- **The pickup request.** `PickupC {since}` is set from `Intent.blocked === 'air'` in the scheduler's turn and cleared when a source is back or the crew member is held out. It emits `crew.airUnreachable {crew, sec}`, an urgent alert. The shuttle that answers it is slice 2b's pickup run.
- **`NEST_HOLD_SEC`** (120 s, added in 2b): a refill that parked a job (`Job.resume`) stamps `Job.heldSince`; past the hold the air turn lets the parked job go (its reservation released, `resume` dropped), so others may take it.
- **Hazard.** A refill tolerates thin air and cold. An empty suit with no breathable tile in reach falls through the failed escape to the air drive, which is then critical and refills. So "escape to a source" is the drive itself, not a separate escape goal.

**Slice 2a is built** (branch `away/sites-286`), in `src/sim/away/`:
- **Components.** `AwaySiteC` (site), `SiteRunC` (vehicle), `AwayC` (crew, with the passage's `cat`, `landing`, `home`). `away.open {ship, vehicle?}` (debug) and `away.recall {ship}`; events `away.opened|departed|returned|closed`.
- **Passages** (`passage.ts`): job kind `passage` (`Job.site`, `target` the shuttle) at the boarding tile, one per free seat (seats, as far as the shuttle has suits), categories by `allocateSeats` over `siteDemand` (`seats.ts`: the owner's `demand`, else the open jobs on the site plus loose loot as hauling). `passageFits` (in `jobFits`) wants `staySec` (seconds before the first need falls to its home line) at `AWAY_GO_STAY_SEC` (180; #404, was a flat 60 on every need). `pairCost` adds the flight (`passageTiles`). The holder waits on the tile (`performJob` 'wait'); the run boards them.
- **Home cover** in `assignJobs`: per level, a walker who could take an unmatched open emergency or `operate` job on their ship (any level, reachable by labelling) gets no passage pair. A passenger waiting at home steps out again for an emergency they rank above their passage (`calledBack`).
- **The run** (`run.ts`, `awaySystem`, after the salvage teams): `board` (at home; leaves once the passengers are in, within `AWAY_BOARD_WAIT_SEC`, or within `AWAY_TURNAROUND_SEC` while part of the party is out) → `fly` → `stay` (hover beside the site; `keepClose`; passengers sent out with `eva.out` and handed to the crew AI on landing, their suit untied; loose loot hauled into the hold (since slice 3: into the staging zone, loaded by the shuttle); a downed member lifted aboard) → `home` (bay, else a home airlock; those aboard step out and leave the party) → `board`. `recall` (site closing or gone, or a fight) calls everyone aboard and lifts the rest after `AWAY_LIFT_SEC`; the run then ends at home with the site.
- **Departure check** (`depart.ts`, `unsafeMembers` / `departCheck`): every trip home from the site goes through it; rules (a)–(c) below, R = `roundTripTicks` (two flights plus `AWAY_TURNAROUND_SEC`), margin `AWAY_DEPART_MARGIN`. The last call and riders came with 2b.
- **Crew side.** The `return` drive (`policy.colonist`, after `air`, before sleep and eat; input `awayReturn`: 0 closing, fight or hurt, 500 tired or hungry, 1000 otherwise) runs `ai/machines/return.ts`: walk to the hatch spot, float aboard (`AwayC.home`). Sleep is never served on the site (no lying down on a wreck; they go home). Idle away crew `waitBySite`.
**Slice 2b is built** (same branch and PR, #295), in `src/sim/away/`:
- **Files.** `run.ts` (the system; `board`, `fly`, `home`, `pickup` phases), `site.ts` (`stay`, `depart`, `recall` beside the site), `trips.ts` (triggers, last call, the watch), `pickup.ts` (pickups, pickup runs, lost shuttles), `rescue.ts` (carry to the shuttle), `phase.ts` (shared helpers).
- **Batched trips** (`tripDue`): urgent at once when a passenger waiting aboard is hurt, downed or at the end of a need (`passengerUrgent`: rest `AWAY_URGENT_REST` 20, hunger 10, charge 20; needs keep running aboard); else batch on the hold full with loot waiting (`runDue`), half the seats waiting, `AWAY_TRIP_WAIT_SEC` (300) since the last trip (`SiteRun.lastTrip`: the last arrival or departure) with anyone waiting, the shuttle's air under a tank, or free seats and a crew member at home who would take one (idle, holds no job, `passageFits`, a suit left if they breathe, a priority for a demanded category).
- **Settled first** (`settled`, Codex 4448955314): no trip (nor the recall's home leg) starts while anyone floats to or from the shuttle, a passenger aboard is still to go out (not `home`, not a rider) or on the way out (`landing`), or a suit outside is still tied to it. The ownership sweep (`away/owned.ts`) unties every party member's suit and ends `landing` once they stand on a tile. A breather with no suit left to go out in is marked `home` instead of being sent out.
- **Depart phase** (`departStep`): launch when settled and `departCheck` passes. Until then every short and able member (judged as they stand, a refill float included) gets `AwayC.lastCall` (`airMargin` reads it as under the refill line while the tank is not full); after `AWAY_LAST_CALL_SEC` (60) `AwayC.ride` (`awayReturn` 0). Riders come aboard without `home`, stay aboard at home (`homeLeg` lets out only non-riders) and go out again on arrival (`sendOut`, which keeps riders aboard while a trip is due). After `AWAY_DEPART_GIVEUP_SEC` (120) the trip is called off and the run stays (and tries again).
- **`returnBy` and the watch.** `departCheck` also returns `returnBy`, the earliest tick a (c)-safe member runs short (air less the walk back and `AIR_RESERVE_SEC`): the tick the shuttle must be back at the site. `mustTurnBack` (in `home` while flying, and in `board` while part of the party is out): a member out downed, carried or with `PickupC`, or `now + flight back + 5 s >= returnBy`; then it flies straight back (those aboard for home ride along and leave on the next trip).
- **Rescue on a site** (`rescue.ts`): `rescueSpot` (the party member on their site with no free bed there: the shuttle's hatch spot or docked airlock tile). Autojobs posts the rescue; `jobWork` carries the patient there and `handInPatient` boards them (`home`, downed: an urgent trip). A downed member left uncarried for `AWAY_LIFT_SEC` is lifted (`watchDowned`, clock `AwayC.downAt`); the closing lift stays.
- **Pickups.** A party member out with `PickupC` gets `AwayC.pickup` (`answerPickups`): the run holds station by them (`holdStation` aims the hover box, their own tile, at them; a docked shuttle undocks to hover), and their tile is the hatch spot (`fetching`, `hatchSpot(…, at)`: the hull near them may be gone). A recall with no hull left to hover beside (`liveBox` null) answers everyone still out the same way, and `awayReturn` 0 brings them aboard as `home`. Anyone else of the player's crew with `PickupC` gets a **pickup run** (`startPickupRuns`, not in a fight): the lowest free stowed EVA shuttle with a tank of air gets `SiteRunC {site: their grid, pickup: crew}` and they get `AwayC {pickup}`; it flies to hover beside them (`vehicle.hover` takes a `box`, which also allows the home ship), waits in `pickup` until they are aboard (lifted after `AWAY_LIFT_SEC`), flies home and ends. Event `away.pickup`.
- **Shuttle loss** (`replaceLostShuttles`): a site whose shuttle run is gone keeps its party (`AwayC` stays while the site names a vehicle); another free shuttle takes the run over (`board`, party rewired, `away.pickup`), else `AwaySite.block = 'stranded'` and `away.stranded` (an urgent alert, cleared when a shuttle comes). A site with nobody left closes (`lost`).
- **No way home** (`noWayIn` in run.ts, #287): the site's own run in 'home' whose shuttle has no way into its home ship (`wayHome` in phase.ts: bay down, no free home airlock, or the ship gone) sets the same `block = 'stranded'` and `away.stranded` with `noHome` (alert "Shuttle cannot get home"), cleared as soon as a way in is back. With a live run the block is this case; with none it is a lost shuttle (`replaceLostShuttles` skips sites whose run stands). `crew.recall` refuses `noHome` up front.
- **Docking at site airlocks.** `flyTo` docks at a free working airlock of the site (`regionAirlock`) when it has one (not on a pickup), else hovers. Docked, passengers step out at the airlock's inside tile (undrafted; a suit for breathers if the tile is thin), and the return machine walks them to it and steps them in (`stepAboard`). `siteSpot` is the boarding point either way (hatch spot or docked tile), used by the return machine, the departure check and the rescue.
- **Crew who don't breathe** (#284): no robot branch. `passageFits` checks `staySec` over every need the crew member has (a missing need is satisfied; a battery at its busy rate); `awayReturn` the same with the home lines (charge `AWAY_HOME_CHARGE` 30). Seats are capacity + 1, each with a suit for whoever needs one (#416). `eva.out` floats airless crew out without a suit, `eva.board` takes them in unsuited, and the float back stows a suit only if one was worn. `walksOutside` (suited or airless) replaces `isSuited` for exterior walking in `planWalk`/`siteWalkModes`, movement, idle and escape. `policy.robot` has the `return` drive.
- **Hold and log.** The home stop waits for the unload (cargo still coming out, up to `AWAY_TURNAROUND_SEC`); a stop that empties none of the hold sets `block = 'noRoom'` (`SiteRun.held`). Leaving home with nobody able left aboard logs `away.homeEmpty`.
- **The air module** (`eva/airLedger.ts` with `eva/sources.ts`; #295 review rounds). The one place the air questions are answered; admission
  (`ai/admitAir.ts`), the air drive (`ai/airNeed.ts`, `ai/machines/air.ts`), the refill (`eva/jobs.ts`, the refill float), the player's refill
  order and the departure check all ask it and keep no copy of their own. New code that needs any of these asks here too.
  - *Air in a tank:* `airLeft(crew, fresh?)` (suit seconds times the Void-born factor; `fresh`: a suit about to go on counts full),
    `tankSec`, `tankShortfall`. *The reserve:* `fitsReserve(sec, air)` (`sec + AIR_RESERVE_SEC <= air`), the one reserve rule.
  - *Supply:* `sourceSupply(src, {without?, for?})`: an airlock's store plus a player shuttle docked there (`dockedSupplier`), or a
    hovering player shuttle's store; `without` leaves out one shuttle (and its own holds), and air held for others is taken off.
    `canGive` says whether a source counts at all (an airlock with air, or a docked shuttle with a tank; a shuttle with a tank), for
    anyone: it only picks where searches start. `givesTo(src, crew)` is the one per-walker answer (`canGive` and some supply left for
    them): `airSources` and admission's `SourceReach` (whose cached searches keep each source and ask it per walker) both use it.
    A docked shuttle tops itself up only from an airlock's `freeAirlockStore` (none of the held air).
  - *The refill:* `drawAir(crew, src)` takes the tank's shortfall from that same supply (airlock store first, then the docked shuttle)
    and spends the crew member's own holds there. Nothing else writes a store on a refill.
  - *Reach:* `airSources(crew, {without?})` (forward, one multi-goal search over the suited view, i.e. `walkOpts` of a suited walker)
    returns each source with `ticks`, `fillTicks` and the `steps` it was timed by; the air drive and the refill order walk those steps,
    so the walk taken is the walk timed. `SourceReach` is the same search run backwards from every source to many tiles at once
    (admission's way back from a job's work tile).
  - *Holds* (`AirHoldsC {holds: {crew, kind, id, sec}[]}` on the owner): air set aside at a source for one crew member's later refills.
    Nobody else can draw it (`sourceSupply` takes it off for them; `airSources` skips a source with nothing left for the walker); the
    crew member's own refills spend it. The departure check returns its (b) top-ups as `holds`; the run sets them on launch
    (`setAirHolds`), and they end with the trip (see Ownership).
- **Ownership** (`away/owned.ts`). Every hold or flag the away code puts on crew, jobs or shuttles has one owner and one release path:
  `releaseOwned`, run once at the end of `awaySystem`, lets it go once its owner is gone. Code that sets such state, or moves it on as part
  of a transition (a passenger sent out loses `ride`; a lift gives a fresh `AwayC`), never has to clear it on the way out of anything.
  The table in `owned.ts` lists each: `AwayC` (the run, else the site's claim), `Drafted.away` (the float), `Suit.vehicle` and
  `Away.landing` (the drift out), `Away.lastCall` and a member out's `ride` (the 'depart' phase), `Away.pickup`, `downAt`, `home` of a
  member out, `SiteRun.returnBy` and `AirHoldsC` (the trip away from the site), `boardedAt`/`held` (the stop at home), `passage` jobs
  (the run serving the site), `StagingC` (the site). `awayLeaks` is the same rules as a pure audit; the away tests' `play` (`test/support/fixtures/away.ts`) throws when a
  leak survives a tick. New away state goes in that table.
**Slice 3 is built** (branch `away/salvage-sites-286`): salvage on sites (see "Derelict salvage", "On an away site").
- **Seats by kind.** `postPassages` splits the suited seats by demand first and the airless ones after, so every category in demand gets a
  suited seat before any gets a second (before, the suited seats went to the first categories in column order and a lone hauling seat could
  end up airless, which no breather can take).
- **The walk rule (#292).** A door that cannot open now is not a way through, for every walker: `passAt` (`modules/walk.ts`) is the one walk
  predicate, used by `findPath`, the scheduler's navigation views (so reach, labelling and job feasibility) and `isTileWalkable` (movement,
  the step itself). A door is shut for good when it is jammed shut, or it is a door of an airlock that does not work (`airlockWorking`:
  enabled, intact, powered) and not the side it stands open on (`WalkInfo.shut`). `walkSignature` includes the dead airlocks
  (`doorSignature`), so cached searches and views go stale when an airlock loses or regains power. A derelict's airlock is unpowered, so
  its outer door is hull to anyone outside: crew no longer walk into it and wait (the bench's airlock variants scored 0 for that).
- **Staging** (`items/staging.ts`, `away/haul.ts`; user design 2026-11-03). The loot no longer goes by hand into the hold:
  - *The zone.* Each away site keeps a `StagingC {tiles, cap}` on its ship (`keepZone`, from `beside` while the shuttle is at the site):
    the `STAGING_TILES` (6) tiles nearest the drop-off point (`siteSpot`: the hatch spot while hovering, the docked airlock's inside
    tile) where goods can lie (`holdsGoods`) and a suited walker there can reach (labelling), the spot itself left clear; `cap` is
    `STAGING_LOADS` (2) hold loads. A zone short of tiles (a sealed hull: few in reach at first) or with a tile that can no longer hold
    goods is looked at again every 5 s: its good tiles stay in order, the nearest new ones fill it up. It belongs to the site, not to
    salvage (owned rule `staging`: it goes when the site's `AwaySiteC` does; hauls into it then end in `haulCleanupSystem`).
  - *Staging.* `planCarry` (every `PLAN_INTERVAL`, for every open site, from `awaySystem` whatever the run's phase: crew stage while the
    shuttle is away) posts an ordinary haul `{kind: 'zone', id: ship}` for each loose stack outside the zone, as far as
    `stagingRoom` allows (`cap` less what lies there and what pending hauls bring; the tiles' room for that item). A delivery goes onto
    the zone's stacks of that item with room, then empty tiles, a full stack each (`stageAdd`): a full stack overflows to the next tile.
    Gathering (above) makes a trip collect several stacks.
  - *Loading.* While the shuttle is at the site (`beside`, in `stay` and `depart`), `loadStep` moves one crate (`crateUnits`) of the
    first staged stack into the hold every `LOAD_CRATE_SEC` (2 s), counted from its arrival (`SiteRun.lastTrip`): no new state.
  - *Trips.* A full hold is the cargo trigger (`runDue`). A batch trip waits until loading is done (nothing staged, or the hold full);
    an urgent trip leaves at once. A departure drops no haul: hauls go into the zone, which stays.
  - *Cargo runs* (Codex 4453963767). Loading needs no crew: at home with nobody aboard, nobody out and loot staged at the site, `board`
    leaves alone once nobody is on the way to a seat and the hold is unloaded (or after `AWAY_BOARD_WAIT_SEC` with passages open), and
    sets no `noCrew` meanwhile. Beside the site, a trip home is due as soon as nobody of the party is out there or aboard to go out
    (`tripDue`), after loading. No new state. The salvage order keeps its site open on any loot (`lootOnSite`: loose, staged or in hand)
    unless the shuttle cannot take it home (`noRoom`, `stranded`); `noCrew` no longer discards it.
  - The away party never hauls into the wreck's lockers (`haulJobsSystem` skips stacks on an `AwaySiteC` ship); the ordinary ferry
    (`logistics/salvage.ts`) keeps its own rule elsewhere.
  - `looseOn` is all loot lying on the site; `lootOnSite` adds loot in hand on its way into the zone (the order keeps the site open on it,
    Codex 4451348811); `unstagedOn` is what is still to be hauled (the site's hauling demand). `haulsTo` and the hauls straight into the hold are gone.

### Travel time and air

- **`ai/travel.ts` (new).**
  - `travelTicks(sim, walker, steps)` turns a path into ticks: per tile `1 / stat(moveSpeed)` (suit and trait
    modifiers included), diagonals √2, door open time, one `cycleSec` per airlock crossed.
  - `floatTicks` covers drifts and `flightTicks(vehicle, from, to)` flights (distance / `VehicleDef.speed` + dock/launch).
  - Integers, deterministic. It shares the door and airlock table with Phase 2's planned airlock transit cost, so ranking
    and air use the same numbers.
- **`eva/sources.ts` (new).** `airSources(sim, crew, opts?)` returns the reachable sources with their travel times:
  airlock suit tiles with `AirlockC.air > 0`, and the hatch spots of player shuttles hovering beside the grid with
  `Vehicle.air >= one tank`. `opts.without` leaves out a given vehicle (the departure check). It runs one multi-goal Dijkstra
  over the suited view. A reverse per-pass map `toSource[jobTile]` (one search out of all source tiles) serves admission.
  (Since #295 part of the air module with `eva/airLedger.ts`; see "The air module" above.)
- **Air stores.**
  - `AirlockC.air` (seconds; default `AirlockDef.airStore`, 1800). It refills at `AIRLOCK_AIR_REFILL_SEC` (one tank) on a ship with working
    life support.
  - `Vehicle.air` (default `VehicleDef.eva.airStore`, 3600). It is refilled to full while stowed in its bay or docked at a
    player airlock, drawn from that airlock's store.
  - A refill draws `airSec - SuitC.air` (or what is left).
- **Refill machine** (`ai/machines/refill.ts`, drive `air`, nested): `Walk`, then `Fill` (airlock, 3 s) or `Float`
  (`EvaFloat {mode: 'refill'}`: out and back, the tank filled at the turn from the shuttle's store). Classes: `Walk` is
  `any`, `Fill`/`Float` are `finish` (only hard reasons end them).
- **Admission** (`jobRank`, thin or suited pairs):
  `travel(walk) + min(STINT_SEC, remaining / workSpeed) + toSource[job] + AIR_RESERVE_SEC <= airLeft`. A full tank counts
  for a suit-up walk. the job explain (`ai/explain.ts`) gets the rejection `noAir` (`AirRejection`, `ai/admitAir.ts`).
- **Pickup request.** `AwayC.pickup` or, on the home ship, `PickupC {since}` on the crew member: set by the utility reader
  when `Intent.blocked === 'air'`, cleared when a source is reachable again.
  - The site's run (or a free EVA shuttle, by the pickup run) re-aims its hover box at the requester (`VehicleDest.hover.box`
    around their tile) and waits in float range; the return machine then floats them in.
  - `ferryMode` allows a pickup hover beside the home ship.
- `SuitC` loses `vehicle` and `airlock`. `outsideCrew(vehicle)` becomes "`AwayC.vehicle === vehicle` and not aboard, or
  floating to or from it". Until slice 2 lands, `SuitC.vehicle` stays for that guard only.

### Home cover and the departure check, `src/sim/away/`

- **Home cover (dynamic).** No content data and no fixed headcount; the scheduler enforces it inside `assignJobs`.
  - *Home needs* are the open, unheld jobs on the home ship that are emergencies (`isEmergency`: extinguish, breach seal,
    rescue; wounded crew's medical jobs when they exist) plus `operate` jobs whose console needs an operator now (what
    `operateJobs` posts).
  - Passages are matched in the normal per-level loop at the crew member's level for their category, so priority still
    decides between a home job and a site.
  - Passages rank below home needs. Per pass, `homeNeedFor(crew)` is true if some home need is open, unheld and admissible
    for them (`admitLevel` at any level, reachable by the component labelling, no search). For such crew a passage is
    refused (rejection `homeNeed`, in `ai/scheduler.ts`), whatever its level. Pairs matched to a home need earlier in the pass are
    taken off, so the check is redone per level as needs fill.
  - With no home need open there is no reserve.
  - Passengers aboard a shuttle still in its bay (`board` or `turnaround`) are unboarded when a home need opens that they
    are admissible for. The passage is posted again.
- **Departure check** (`away/depart.ts`; `awaySystem` runs it every tick in `depart` before launching, and in `home`,
  `turnaround` and `back` as the watch).
  - `R` is the round trip: `flightTicks(site→home) + TURNAROUND_MAX + flightTicks(home→site)`. In the watch, `R` is the
    remaining time to be back at the site.
  - A party member `m` on the site and not aboard is **safe** iff one of these holds:
    - (a) `m` doesn't drain: airless, or not suited and on a breathable tile with no job beyond thin air (admission without
      this shuttle keeps it so);
    - (b) `airSources(m, {without: vehicle})` is non-empty (reached with `AIR_RESERVE_SEC` to spare), and one of them still
      holds, after the members before `m` (ascending id), a whole tank for each top-up `m` will take before the shuttle is back
      (one, or more when one top-up, filling from the refill line, cannot carry them through `1.25 × R`). A source's supply is
      `sourceSupply`: an airlock's store plus a player shuttle docked there (not the one leaving), the same stores the refill
      draws from. Their `returnBy` counts the top-ups set aside;
    - (c) `m` is able, and `airLeft(m) >= 1.25 × R + travelTicks(m → hatch spot) + AIR_RESERVE_SEC`.
  - Downed or carried members are never safe; they are rescued aboard first.
  - In `depart`:
    1. Members not safe under (a)–(c) and able get a last-call refill (their air drive is set urgent).
    2. If still not safe after `AWAY_LAST_CALL_SEC` (60 s), they get `AwayC.ride` (return drive full) and board.
    3. Launch when every member out is safe.
    4. Never launch otherwise; after `AWAY_DEPART_GIVEUP_SEC` the trip is called off and the run goes back to `stay`.
  - On launch, `returnBy` is the earliest tick any (b)- or (c)-safe member would run short, minus `flightTicks(home→site)`. The home
    stop ends at `returnBy` whatever is left (unload, passages).
  - Watch: if `now + remaining > returnBy`, or a member left out turns unsafe (downed, pickup request), the run skips to
    `back` at once.
### Boarding (#287), `src/sim/boarding/`

A boarding is an away site on the enemy ship; boarding code keeps only what is boarding's own (targets, sabotage, capture, the
stranded rules). Enemy boarders (`systems/boardingAi.ts`) stay NPC doctrine.

- **Launch** (`launch.ts`, `boarding.launch`): the order checks the shuttle (player's, free, stowed, empty), the party (the player's,
  not of a party nor picked by another launch: `launchOf`), the airlock (hostile ship, `dockError`) and that no site is open on that ship
  (`siteOpen`), then `openSite(ship, 'boarding', vehicle)` with: `demand: {}` (no work seats, no rotation), `fight: 'stay'`,
  `standBy: true`, `dock: airlock`, `invited: party`.
- **Site fields the owner chooses** (general, no owner checks in `away/`):
  - `fight: 'stay'`: a fight does not call the party in (`fightCalls`, read by `wanted` and `siteRecalled`). Free pickup runs still
    refuse a fight; the site's own run picks up under fire.
  - `standBy`: the party lands drafted (`standBy` in `site.ts`; the `drafted.away` sweep keeps the draft on such a site).
  - `dock`: the airlock `flyTo` docks at while `dockError` allows; else any free one, else it hovers and the party goes out of the hatch.
  - `invited` (a named party): `postInvited` (passage.ts) holds one passage per invitee at once (`Job.holder`, attached and walked;
    `passageFits` lets nobody else take it). The pick is an order: a sleeping invitee wakes, and one not drafted already is held drafted (`Drafted.away`, walked
    as an errand by `drafted.ts`), so no need, emergency or job takes them off it; the `drafted.away` sweep keeps that hold while they are
    invited and not aboard. An invitee who lets go of it (dead, downed, cut off, or a player order such as a move) stays home; at the first departure, or after
    `AWAY_INVITE_WAIT_SEC` (75) with nobody aboard, `endInvites` drops the rest (`away.leftBehind`). Owned row: ends when the run leaves
    'board'.
- **Recall** (`recall.ts` -> `away/recall.ts` `recallCrew`, `crew.recall`): party members out on their site are undrafted, their sabotage
  cancelled, and marked `Away.recall` (owned row: ends with the party; stale only if they stand off their site). `awayReturn` is 0 for
  them, `passengerUrgent` true: the trip home leaves at once, and the run goes back for anyone who stays. Crew under an away order to go aboard
  (`headingAboard` in fight/relations.ts: a party member with `recall`, `pickup` or `ride`, or an invitee holding their passage) are left
  idle by `stepFighter` (no hunting, no fleeing; a player's attack order still counts), and a party member on the way back is not boarding
  (`isBoarding`), so their walk stands, also under fire.
  `crew.recallStarted` / `crew.recallFailed` (`noCrew`, `notAboard`, `incapacitated`, `noHome`: the shuttle's bay is down and no home airlock is free, so the
  party stays put rather than sit in a shuttle with nowhere to go) at the order; `away.returned` is the "back aboard"
  log line. A party landed by hand (shuttle panel, no launch) joins a boarding site when recalled (`joinLanded` in `boarding/recall.ts`):
  the ship's site if one is open, else one opened for the lowest free shuttle of their side docked there (its run starts in 'fly' and
  finds itself at the site; those still sitting in it are of the party, `Away.home`). With no such shuttle they are `notAboard`.
- **Owner** (`site.ts`, `boardingSiteSystem`): a boarding site closes once `invited` is consumed and nobody of its party is left.
- **The shuttle flies itself** (autopilot, user decision 2026-11-03): the first pick is a passenger like the rest (BoardPicker shows no pilot).

### Sides (#287)

The away code asks "the shuttle's side" where it used to ask "the player's": `ofSide(crew, vehicle)` (crew faction = `vehicleFaction`) for passages,
pickup shuttles (`freeShuttle`) and the "nobody left at home" line; `siteShuttleOk` wants a bay on the shuttle's own home ship. The air ledger's
`suppliesTo(shuttle, crew)`: of the crew member's side, or the shuttle serving their site; such a shuttle docked at an airlock is drawn first, then the
store (`drawAir`, `sourceSupply`; `side` for the departure check's per-store supply). `airStoresSystem` tops a docked shuttle up only from an airlock of
its own side's ship. `stowSuit` leaves any away party member's suit on (it is the shuttle's).

### Throughput bench

`content/ships/salvageBench.ts` (scenarios `salvageBench*`, baselines in `salvageBench.baseline.ts`, the slow test `salvageBench.slow.test.ts`) measures
scrap home per game hour on the `salvageEvaFixture` wreck with 6 and 4 crew; `npm run profile:sim -- --scenario salvageBench` prints the same numbers.
The acceptance: the mean is at least the baseline and each seed at least 90% of its own. The slice plans, baseline history, save-shape log and risks
moved to the [status archive](STATUS_ARCHIVE.md).

## Drones, `src/sim/drones/`

Design: DESIGN.md "Drones". Issue #318. Slice 1 (inside the ship) is built.

- **Entity.** A drone is its own entity: `DroneC` (def, home ship, bay and slot, state `docked | out | home`, battery, hp, target, flight
  steps, `inert`, `stunUntil`) on a `BodyC` (sector tiles, a tile's centre at +0.5; `ALT.drone` flying, `ALT.dronePad` docked, 0 dropped).
  Never crew: no jobs, priorities, scheduler or crew panels.
- **Types are data** (`content/drones.ts`, `satisfies DroneDef`): speed, hp, battery, ion stun, wreck and a `jobs` list, best first.
  `drones/work.ts` has one rule set per job kind (`repair`, `extinguish`, `firstAid`): a target query, a still-wanted check and one tick
  of work. A drone takes the nearest free target of the first kind in its list that has one (`DRONE_PATH_TRIES` flight plans per kind).
  One drone per target: the claim set of the pass (`targetKey`). Crew may work the same target; both add up.
- **System** (`systems/drones.ts`, after autoJobs): bays install drone items from storage (`installDrones`), each ship's cap is worked out
  (`droneCap`: `DRONE_CAP_BY_TIER` by the best live core of the ship's faction; 0 = inert), then `runDrone` per drone in id order (`run.ts`):
  docked (charge at `droneBay.chargePerSec` while the bay is powered; launch once over `launchAbove` with a free cap slot and a target),
  out (fly, work, retarget, home below `lowBelow`), home (dock in its slot, or any free slot when its bay is gone; docked in a lost bay = wrecked).
- **Flight** (`flight.ts`): an ordinary `findPath` with `fly` (the walk rule's `passAt` crosses solid modules; struct and doors that cannot
  open still block). The body moves centre to centre; a closed step replans. The doors system holds a doorway open for a flying drone.
- **Shared with crew:** `douseTile` and `repairModule` (crew/jobWork.ts), `Downed.patched` (vitals pauses the bleed-out), `hasLiveCore` /
  `isCoreLive`, the ion points (`combat/effects.ts` `stunNear` calls `stunDronesNear`; a bay with `IonC` stuns the drones docked in it).
- **Build:** `ItemDef.drone` items (`item.drone_*`), fabricator recipes gated by `RecipeDef.blueprint` (`recipeKnown`; `isKnown` accepts
  `blueprint.*` ids that are not modules), research projects in the `automation` band, research-station stock.
- **Jumps and saves:** drones lift with their ship (`members.ts`), `translate.ts` / `refs.ts` cover `drone`. `DroneC` and `Downed.patched`
  are saved (SAVE_VERSION 89).
- **Render/UI:** PLACEHOLDER art drawn in code (`render/droneView.ts`, `paintDrone`; lab panel `drones`), sorted in the sector `low`
  layer; the bay inspector's Drones section (`app/droneSnapshot.ts`, `ui/DroneBayPanel.svelte`). Debug start `?scenario=drones`.
- **Slice 2a (space, built on `drones/space-318`):**
  - *Where a job is:* `KindRules.where` (`inside` | `space`) and `shared` (no claim: every guard shares its ship). A docked drone picks from
    every kind; one inside picks only inside kinds, one in space only space kinds, else it goes home.
  - *Free flight* (`drones/space.ts`): `steer` moves the body straight at a point in sector tiles at `ALT.cruise`; `d.space` marks a drone out
    of its ship. The only way between inside and space is the bay's ceiling hatch: states `launch` / `land` (`stepLift`, `liftPose`): the
    first `DRONE_HATCH_SHARE` of `DRONE_LIFT_SEC` it slides from its pad to the footprint's middle (the hatch opens), then rises to cruise
    height (a landing is the same backwards). Render: `droneHatch.ts` (art `module.drone_bay.hatch.f0..f4` / `.stowed`; solid on the cutaway
    ship while open), drones above `ALT.roof` draw in the air layer.
  - *Defence* (`drones/intercept.ts`, job `intercept`): while its ship is `underThreat` it circles an ellipse `gap` tiles off the ship's
    rectangle (places spread evenly by id, turning at 0.8 of its speed) and fires every `fireSec`: an incoming interceptable shot
    (`hitChance`; `projectile.intercepted` with `by`), else the nearest enemy drone, else an enemy shuttle (chipped like point defence).
    Who may be shot is one shared rule, `combat/intercept.ts` (`atWarWith`: already at war, never neutral, no truce), used by point defence
    too, so defending never provokes.
  - *Recall* (`drones/recall.ts`): a charge order with a jump, or a held departure, recalls the ship's drones (no launches, the ones out fly
    home). `jump`, `flee` and `leaveEvent` call `holdDeparture` before they lift the ship: with drones outside it stores `Combat.departHold`
    and stops; the helm system retries it every tick (`settleDeparture`) until they are in or the wait (`DRONE_RECALL_WAIT_SEC` plus `DRONE_QUEUE_ALLOW_SEC` per drone after the first, stored as `DepartHold.waitTicks`) is over. Then
    `loseStrandedDrones` (`drone.lost`) and only drones aboard (docked, or flying inside) lift (`members.ts`).
  - *Damage* (`drones/damage.ts`): fire on its tile inside (`DRONE_FIRE_DAMAGE` x intensity), crew hand weapons (`fight/fighter.ts`
    `shootDrone`: armed fighters shoot an enemy drone inside that they can hit where they stand, when no crew foe is about), and in space
    point defence (`DRONE_PD_*`) and enemy defence drones. Ship guns never target a drone. A docked drone is mended by a powered bay
    (`DroneBayDef.repairPerSec`). A wreck in space drops nothing. SAVE_VERSION 90.
  - Debug start `?scenario=drones&fight[&charged]`; lab panel `droneLaunch`.
- **Slice 2b (built on `drones/space2b-318`):**
  - *Enemy drones* (shipgen): a `FactionDef` with `defenceDrones` (navy, rogue AI) gets, from `ENEMY_DRONE_MIN_DEPTH`, a `module.droneBay` in
    its AI room (living crews) or its own sealed pod (drone ships) (`plan.ts`); the room spec's `drones` becomes `ShipTemplate.modules[].drones`
    (`generate.ts`), which `placeTemplateModules` spawns docked and `stampShip` hands to the new ship. Same drone system, same `drone.defence`
    def: they launch once a ship at war with them is in play, and shoot our missiles, shuttles and drones by the shared rules. Count and depth
    gates are in `tuning.ts` (`ENEMY_DRONE_*`). A drone whose ship is a wreck or gone is wrecked with it (`runDrone`). Debug start `?scenario=drones&fight&enemy=navy|drones[&depth=N]`; with `?hook`, `__cc.setSpeed(0..3)` freezes or runs the sim and `__cc.stepTicks(n)` advances it.
  - *Staggered return* (`drones/recall.ts` `landingBusy`, `queuePlace`): while a ship's drones are recalled a drone in space waits at a place
    of its own round the hatch until no other drone of the ship is cleared (`Drone.clear`) or less than `DRONE_LAND_GAP_SEC` into its landing.
    The recall wait grows with the queue, so only distance can strand a drone. SAVE_VERSION 91 (93 with the later fixes).
  - *Supplies:* `DroneDef.supply` (`{ item, capacity }`, data) is a load a drone carries (`Drone.load`, saved). Docked in a powered bay it tops
    up from the ship's storage every scan (`combat/ammo.ts` `takeStock`, shared with `consumeAmmo`); no hauling. The repair drone carries 4 metal.
    Medic supplies and drone ammo will use the same field. SAVE_VERSION 92.
  - *Outside breach repair* (`drones/seal.ts`, job `seal`, space): a repair drone with the wall's whole cost in its load (`structCosts`, via
    `sealCost`) takes a hole in its ship's hull (`crew/breach.ts` `breachesOf`, shared with the crew's seal job posting), flies out through the
    hatch, hovers over it for the crew's wall time, then finishes it through `finishStruct` (exported from `crew/jobWork.ts`) and pays from its
    load. A crew wall job on the same hole is destroyed. Recall and wrecks work as for any space job. Debug start `?scenario=drones&breach`.

## Vehicles (shuttles), `src/sim/vehicles/`

- A shuttle is an **entity** (`VehicleC`), never a grid. States: `stowed` (in its home bay), `flying` (sector x, y), `docked` (at an
  airlock's outer door). Crew aboard (`AboardC`) have no Position/Path: hidden, on no grid.
- `module.vehicle_bay` (4x5 interior pad, `vehicleBay: { class: 'shuttle' }`) holds one vehicle; later 3x3 `pod` bays and pods
  (mining, construction) reuse the same `class` match. Shuttles are crafted as `item.shuttle` and put in an empty bay with
  `vehicle.assign`.
- Commands: `vehicle.assign/embark/disembark/launch/dock/undock/return`. Embark walks the crew member (drafted) to the boarding tile
  (bay access tile, or the docked airlock's inside tile) and boards on arrival. The first aboard is the pilot; a launch needs one.
  Disembark without a crew id lets passengers off and keeps the pilot aboard.
- Docking is vehicle state, not a portal (a shuttle has no tiles): the airlock must be working; disembarking puts crew on the
  airlock's inside tile. Boarders of another faction are drafted so they stand where they land.
- Flight: straight line at `VehicleDef.speed` x (1 + SKILL_STEP x pilot's `piloting`).
- Combat: any weapon can target a shuttle that is flying or docked (`combat.setTarget` with `targetVehicle`); shots home on it,
  its `evasion` rolls, then it takes the weapon's total `moduleDamage` (ship shields do not cover it). Point defence covers its home
  ship's shuttles against missiles within `VEHICLE_PD_RANGE`, and shoots hostile shuttles that are in range or docked at its ship.
  Destroyed in flight: everyone aboard dies. Destroyed docked: they land on the airlock's inside tile downed (rescuable). A stowed
  shuttle is lost (crew die) if its bay is destroyed.
- Enemy boarding: `ShipTemplate.boarding` (doctrine flag -> `BoarderC`). Off for `ship.raider` (balance scenarios stay comparable);
  on for `ship.raiderBoarder`. See `systems/boardingAi.ts`.

## Events (story), `src/sim/story/`

Events are data (`EventDef`, `src/sim/story/defs.ts`; content in `src/content/events.ts`, `satisfies EventDef`, keyed `event.*`).
The event system is **independent of grids and sectors**: the world enters only through `StoryContext` (`danger` tier, `faction`
territory; plain parameters set with `story.setContext`) and leaves only through the stubbed `physical` effect.

**State** (`StoryState`, `sim.story`, saved in `SaveData.story`, optional so old saves load without a version bump): flags and
counters, reputation per faction, the open decision (`active`), a `queue` of due/delayed events, lead `notices`, `seen` counts
(for `once`/`cooldownSec`), the last resolution, the `physical` outcome queue and its **own Rng** state (so events never disturb
`sim.rng`; the roll sequence is deterministic and saved).

**EventDef**
- `mode`: `'decision'` (pauses the game in a modal) or `'notice'` (in-world, non-pausing alert; `effects` apply on arrival; `lead`
  makes the notice open that decision when tapped; `expireSec`).
- `triggers[]`: `transit` (weight; the only drawn pool: drawn at a hop of a hyperspace trip, see "Story events in transit" below; nothing is drawn
  while the ship idles in a node), `flag` (`flag`, `atLeast`, `delaySec`: queued when the flag first reaches the level), `chain` (only reached by a
  `chain` effect or debug fire).
- Pool filters: `danger {min,max}`, `factions[]` (null = open space), `eligible: Requirement[]`, `once`, `cooldownSec`. A draw sums
  the weights of a def's triggers of that kind and picks by weight with the story Rng.
- `choices[]` (`ChoiceDef`): `id`, `label`, `hint`, `requires: Requirement[]`, `cost: ItemQty[]` (required and spent), then either
  `outcome` or `check` + `success`/`failure`. An `Outcome` is `{ text?, effects? }`.
- `Requirement`: `species`, `implant`, `skill`, `module`, `item` (kept), `reputation` (min/max), `flag` (min/max; default "is set";
  `max: 0` = "not set"), `crew`, `shuttle {eva?}` (a player shuttle stowed in its bay). Unmet choices show greyed with the reason (`describeRequirement`).
- `SkillCheck {skill, difficulty, base=0.5, perLevel=0.1}`: odds = clamp(base + perLevel * (level - difficulty), 5%, 95%), the best
  crew member (highest `stat`, ties lowest id) rolls; the odds label ("Repair skill 6 (Mara): 70%") is shown on the choice.
- `EventEffect`: `items` (+/-, to/from player storage), `crewDamage`, `crewHeal`, `skillXp` (100 xp = 1 level via a stat modifier
  source), `reputation`, `flag` (`set`/`add`/`clear`), `chain` (`delaySec`), `physical`. Crew effects take `who`: `random`
  (default), `all`, `actor` (the skill-check roller).
- `physical` outcomes (`derelict`, `boarders`, `fire`, `combat`) are only **recorded** in `story.physical` (capped log). The sector
  layer will add a system that consumes and removes those entries; nothing else needs to change.

**Commands** (`story.*`): `choose {choice}`, `fire {event}` (debug, ignores triggers and eligibility), `setContext {danger?, faction?}`, `openNotice`, `dismissNotice`,
`setFlag` (debug). **Events** (output only): `story.started {event, mode, notice}`, `story.resolved {event, choice, success}`,
`story.effect {event, effect, text}`. `?hook` exposes `__cc.fireEvent(id)`, `setFlag`, `setContext`, `story()`.

**Pipeline:** `storySystem` runs last (not in hyperspace): lapses notices, starts due queued events (a flag-queued decision waits for hyperspace; `galaxy/storyHop.ts` pumps the queue there). Everything else happens in
command handlers. **UI:** `app/storySnapshot.ts` builds `UiStory`; the bridge pauses the game while a decision is open (and
answering it, `chooseStory`, restores the speed); `ui/StoryModal.svelte` is a centred card on desktop and a bottom sheet at <= 600px;
notices arrive through `alerts.ts` (`UiAlert.notice`).

**Adding an event:** add an entry to `src/content/events.ts` (the content test checks that chains, leads, items, species, modules
and flag triggers resolve and that every choice runs). For an arc, have one event set a flag and the next list a `flag` trigger
(with `eligible` on the flag) or be reached by `chain`. Add a new effect or requirement kind in `defs.ts`, then `effects.ts` /
`requirements.ts` (both switches are exhaustive).

### Physical encounters (scenes), `src/sim/scene/` (#173)

DESIGN.md "Physical encounters". Three parts kept apart: triggers (the transit draw, `galaxy/storyHop.ts`), scene specs and the outcome observer.
- **Spec** (`scene/types.ts`, `spec.ts`): content's `EventDef.scene` (`SceneRecipe`: ships, derelicts, timers, rule overrides) is rolled into a
  `SceneSpec` when the signal opens (`galaxy.signal`), from the world seed, the event id and the hop, so the same signal gives the same scene.
  Ships are contact descriptors (`spawnContact`); derelicts (`scene/derelicts.ts`) are the derelict generator's inputs (`planDerelict` in
  `combat/derelict.ts`: generate and ruin without placing) plus a `DerelictRead` of the ruin meta that a scan words (`app/storySnapshot.ts`).
- **Remote actions** (`ChoiceDef.remote`: `hail`, `scan`, `probe`, a deep scan that reads counts and cargo) reveal facts from the spec and keep
  the decision open. Investigating (a `scene` effect) opens the event grid (`galaxy/eventGrid.ts` `enterEvent`); `scene/open.ts` makes the
  derelicts and ships real (beside where the ship comes in, retried each second when there is no room) and departs neutral ships.
- **Observer** (`scene/observer.ts`): once a second, facts read from sim state (never events) per scene ship and derelict: traded, attacked,
  boarded, captured, destroyed, fled, salvaged (a salvage order stripped parts, or the wreck is stripped away), cleared (hostiles aboard at
  spawn, none now), plus `crewLost` per player crew member seen alive in the grid, `timer`, and `left` at leave. Rules are data: shared
  `content/sceneRules.ts` (with `of: ship | derelict` and `stance` filters), overridden per encounter. `derelicts_found` counts salvaged
  derelicts; a scan reads counts once it is 2.
- **Persistence:** everything in the grid is wiped on leave (a `discovery` spec keeps its stable key for a later node record).
- **Exploring by hand** uses the general tools: draft, `vehicle.embark`, `vehicle.hover` (the hover point comes in to the gap from the nearest
  hull-ring tile when a ragged hull lies inside its bounding box, so a hatch spot exists), `eva.out`, crew orders, `job.forceDoor`, and
  `eva.board`, which walks a crew member out of float range to the hatch spot first (`eva/board.ts`). Wrecks get no repair jobs.

- **Pirate ambush (step 4)** (`scene/visit.ts`, `boarding/party.ts`): a scene ship recipe may carry `ambush` (`AmbushRecipe`): the scene seed rolls
  trap or honest (`SceneShip.ambush`: `trap`, `party` 3, the hail `talk`, a `tell`, `askAfter`, `visit`). `attitude` adds to the hail score
  (`Trader.relation`) so a ship with a reason answers. **Boarding trigger outside combat:** either variant asks to dock `askAfter` s after the scene opens
  (`visit: 'asked'`, event `scene.dockAsked`, EventPanel's request with Let them dock / Refuse = command `galaxy.visit`). Granted: a 'visit' consent
  grant on the player's ship (`ConsentC`, from the skiff, see "Consent" below) lets `boardingAiSystem` run the neutral ship's party (`startParty`, moved to `boarding/party.ts`, sent from `tendVisit` so embark orders are in
  place); once one of them stands on the player's ship (`aboard`) they are guests (not invaders, off duty) for `AMBUSH_SPRING_SEC`, then `hostileAct(ship, 'ambush')` turns
  the group (`turnShip` now also turns `Boarder.crew` standing on another grid) and records it as every provocation does. Refusing a trap does the same
  without a party. An honest party never springs: at `aboard` it becomes `delivered` (observer fact, rule `honestPaid`; its missiles are an `items` effect with `at: 'visitAirlock'`: `spillItems` on the floor just inside the airlock the shuttle is docked at, hauled by the crew), `HONEST_STAY_SEC` later
  its crew `vehicle.embark`, the shuttle `undock`s and `return`s, `home` is set and the skiff is dismissed (`leaveAt` now, so `departScene` jumps it
  out). Refused, an honest skiff is dismissed at once (fact `declined`, rule `honestRefused`). A player shot first (`provoked` set) makes it `sprung` already. Observer facts `ambushed` (`provoked === 'ambush'`) and
  `boardersDown` (party all dead or down), rule filter `trap: true|false`. Scan rows are skill-sharpened (`app/ambushIntel.ts`: gunnery, piloting,
  hacking). Debug: `?scenario=ambush[&trap|&honest][&signal]` (`content/scenario/presets/ambush.ts`, `debug.ambush`).

## Food and farming, `src/sim/farm/`

- **Beds.** `ModuleDef.plot` gives a module `PlotC` (`farm/components.ts`): `crop` (what it sows next, set by `plot.setCrop`), `planted` (what is in the soil),
  `grown` (powered ticks) and `ready`. Crops are content (`content/crops.ts`, `CropDef`: item, yield, growSec, water, stockCap). `farmSystem` (pipeline,
  after `researchJobsSystem`, before supply) grows a planted crop one tick while its bed is whole, enabled and powered, and every `PLAN_INTERVAL` keeps one job
  per bed: `plant` (category `farming`; `needs` the crop's water, delivered by the ordinary supply planner, which hauls it under `farming`) while the bed is
  empty and set to a crop whose stock is under its cap, `harvest` once ready. `farm/work.ts` finishes them (the yield spills on the access tile and hauling stores it).
- **Cooking.** A recipe with `quality` (`RecipeDef.quality`: a skill and tiers worst first) makes its output from the cook's skill (`items/craft.ts` `qualityItem`);
  `keep` orders count every tier. Galley recipes (rations too) carry `category: 'cooking'`; the crafting job posts under it. Crafting a quality recipe trains its skill.
- **Eating.** `foodOn` takes the most nutritious food in storage, so meals go before rations. `ItemDef.food.mood` sets the galley mood factor (`Mood.mealItem`, `crew/mood.ts`).
- **Herbs.** `ItemDef.medicine.healMult`; `crew/treatment.ts` uses one in-stock item per stay in a `ModuleDef.medical` bed (first healing tick, `Downed.treated`) and
  vitals heals that much faster. `findFreeBed(..., patient)` offers medical beds to patients first; sleepers and bed owners never get one.
- `ItemDef.art` borrows another item's sprites (floor stacks, UI icons) for items waiting for their own art.

## Trade, `src/sim/trade/`

**Terminology (user decision, 2026-10-19):** a **node** is one playable grid or location (what older text and code call a "sector"); a
**sector** is a group of nodes; sectors are linked by **hyperlanes**; a **cluster** is a group of sectors (see "Starmap"). New code and docs say "node". Trade only needs "ships in the same
node", which is every ship in `sim.sector` today.

**Model.** Credits are a separate currency (`sim.trade.credits`, the player's; NPC wallets are `TraderC.credits`). Barter swaps items for
items. A **trade partner** is any entity with a `TraderC` (wallet + stock): a ship (`ShipC`) or a station (no grid yet). You deal with
partners in the same node by **hailing** them; goods are **delivered by shuttle** between airlocks; **payment settles on delivery**.

**State** (`TradeState`, `sim.trade`, saved in `SaveData.trade`, optional so old saves load without a version bump): `credits`, `hails`,
pending `offers`, `deals` (live ones plus the last 8 finished), `nextId`. `TraderC` is created on the first hail (`ensureTrader`), never by
a snapshot. Its stock and wallet are rolled from `hash(world seed, ship.gen.seed or entity id, profile)` with their own Rng, so they do not
depend on when the ship is hailed and never touch `sim.rng`.

**Content** (`ContentRegistry.trade`, `src/content/trade.ts`; item prices are `ItemDef.price`, an item with no price is not for sale):
- **Consent** (`src/sim/consent/`, #173): leave to come aboard is one record, `ConsentC` on the host ship: grants `{ by, faction, site?, crew?, from?, work? }`
  (`aid` scene help, `yard` contractors, `visit` an ambush skiff's party, `trade` the player's side on a station while a run is docked). `guestOn` is
  the one question: `isInvader`, provocation, the observer (`uninvitedOn`), a station's alarm, bed ownership and `wreckShip` (guests survive a wreck)
  read it; a guest without `work` is off duty. A grant is void while the host is at war with the guests' side.
- **Hostile rooms** (`eva/suit.ts` `suitNeeded`): thin air, or heat past `HOT_ABOVE` up to `SUIT_HEAT_MAX`. Every suit decision reads it (the
  scheduler suits a walker up for non-emergency work there, `ai/scheduler.ts` `hostileWork`; tank drain; the air drive; when a suit may come off), and a suit with air
  raises the heat hazard line to `SUIT_HEAT_MAX` (`crew/hazard.ts`). Paths still avoid thin air only.
- **Work blocks** (`WorkBlockC`, `crew/workBlock.ts`): work categories a crew member cannot do, each with a reason; `jobFits` skips them. A scene ship's
  `lacks` blocks them for its crew (reason 'scene': the freighter's crew cannot repair).
- **Enemy target choice** (`systems/enemyAi.ts` `TARGET_ORDER`): threat (`Combat.threat`, the last ship that fired on it, `AI_THREAT_SEC`), then
  `Combat.prey`, then `firstFoe`.
- **Distress freighter (step 5)**: scene timers start at deploy (`scene/clock.ts`); `due: 'wreck'` with `blast` applies weapon effects at the failing
  module, breaches the nearest hull wall, emits `ship.blast` (drawn by `render/sectorFx.ts`) and destroys every power source (the ship-state system wrecks it).
- `spread {sell, buy}` and `repStep`/`repMax`: a trader sells at base x 1.25 and buys at base x 0.6 before modifiers.
- `factions`: `TradeFactionDef` by generator faction id (`faction.civilian`) or combat side (`side.hostile`): `relation`, the `reputation`
  key into `story.reputation`, optional `sell`/`buy` multipliers. This table stands in for the faction system being built separately.
- `traders`: `TraderDef` by `trader.*` id (ship roles and station kinds): `match {faction?, role?, side?}` (most specific wins; the role is
  `ShipC.gen.role`, stored by `debug.spawnGenerated`), `shuttle` (sends its own), `sell`/`buy`, per-tag `tagMods`, wallet range, stock lines.

**Price of one unit** (`pricing.ts`) = base x spread x faction x trader kind x item-tag mods x reputation, rounded, minimum 1. Reputation
shifts by `repStep` per point (capped at `repMax`): friends are sold to cheaper and bought from dearer. A buy price never exceeds the
same item's sell price. `quote(give, get)` gives `balance = getValue - giveValue`: > 0 the player pays, < 0 they pay the player, 0 is an
even barter. A `barter` offer moves no credits and needs `balance <= 0` (a surplus is a gift).

**Hailing** (`hailVerdict`): a ship answers unless it is a wreck/fled (`silent`), its guns are locked on a player ship (`weaponsHot`, so
a hostile ship in combat always refuses), or `faction.relation + trader.relation + reputation[faction.reputation] < 0` (`hostile`).
Civilians start at +2 (they talk until you are at -3 with `traders`), navy at 0, pirates at -2 (they talk once you hold +2 with
`pirates`, only when not shooting), drones at -9 (never). `debug.spawnGenerated` now spawns a faction with `FactionDef.side` (civilians:
`'neutral'`, others `'hostile'`), so a civilian ship does not start a fight.

**Commands** (events out): `trade.hail {ship}` (`trade.hailAnswered` / `trade.hailRefused {reason}`), `trade.offer {ship, give, get,
barter?}` (validated and priced, becomes a pending offer, `trade.offered`; one offer per partner), `trade.accept {offer}`
(`trade.dealMade {courier}`), `trade.cancel {id}` (an offer, or a deal still in `dispatch`/`load`), `debug.spawnStation {kind?, size?, seed?, x?, y?, name?}` (the old
`{profile}` form spawns a trading outpost),
`debug.setCredits`. Offer rejects: `noTrader notAnswered empty badLine noPrice theyLack noItems unbalanced noFunds theyBroke noRoom`;
accept adds the courier ones `noCourier noPilot courierBusy noAirlock tooBig dealOpen`. `bridge.dispatch` runs one tick for `trade.*`
commands while paused so the window answers at once.

**Delivery (who flies, decided and documented; one flow for every carrier, #548).** `planCourier` (trade/courier.ts) picks one carrier for both
directions, by `freeShuttle` (the one answer to "which shuttle of this ship can carry now"):
1. The **player's free shuttle** first (it flies itself, no pilot or crew needed: `Vehicle.autopilot` lifts the pilot rules for the run only; it needs an
   empty hold and a free working airlock on the player's ship).
2. Else the **trader's own real shuttle** (courier 'them'): a station's, stowed in its hangar or on its pad, free. Nothing is ever made up for a run. It flies
   itself, nobody aboard, through the mirrored phases in `trade/theirRun.ts`: `dispatch` (stage the bought goods beside its bay) -> `load` (station crew,
   suited out onto a pad) -> `out` (dock at the player's airlock) -> `stationWork` (the player's crew unload what was bought, then load what was sold, hold
   sealed) -> `back` -> `unload` (station crew carry the player's goods in; they become trader stock) -> settle. `theirGiveUp` settles timeouts. Freighters
   and liners have no shuttle (#551): they trade only through the player's. `sendHome` is the one rule for a station shuttle going home after any job.
3. Stations are ships (an immobile `ShipC`, see "Stations" below). The player's shuttle **docks** at a station (`trade/stationDock.ts`) instead of hovering: `out` -> `dockStation` (dock at a free working station
   airlock; the dock order reserves it, `dockError` 'occupied' for anyone else) -> `stationWork` (the bought goods are staged from the
   trader's set-aside stock into the station storage nearest the airlock, station crew haul both ways between station storage and the
   shuttle, the player's goods pass from station storage into the trader's stock) -> undock -> `back`. No free station airlock, a
   failed dock or a station crew that never comes falls back to the hover swap (`Deal.via 'hover'`, shown in the deal status). A run
   can be cancelled while docked: haul jobs are dropped, the bought goods return to the trader, the player's goods to the hold, and
   the shuttle flies home. (The instant fallback for grid-less stations is gone.)
One run carries at most the shuttle hold (`VehicleDef.cargo`, 40 units) each way.

A **deal** (`Deal`) holds the payer's credits in **escrow** from accept (the player's if `balance > 0`, else the trader's) and takes the
goods the trader sells out of its stock. `systems/trade.ts` (after `vehicleSystem`) runs each deal's phases in `trade/dealFlow.ts`, issuing
ordinary vehicle commands (applied next tick, like the boarding AI):
`dispatch` (player shuttle `vehicle.dock`s at the player's airlock; skipped for a buy) -> `load` (crew haul the goods from storage into the
docked shuttle through the airlock unloaders; the hold is sealed with `Vehicle.outbound` so `cargoJobsSystem` does not unload it) -> `out`
(`undock`, `vehicle.hover` beside the trader's ship) -> `exchange` (`exchangeSec`: the player's goods go into the trader's stock, what was
bought goes into the hold; `trade.delivered {to: 'trader'}`) -> `back` (`vehicle.dock` at the player's airlock; `trade.delivered {to:
'player'}`) -> `unload` (crew haul it out through the unloaders into storage, existing `cargoJobsSystem`) -> **settled** when the hold is
empty (`trade.settled`: the escrow is paid to the other side). A sale with nothing coming back settles at the exchange and the shuttle
returns to its bay. Failures (`trade.failed {reason}`: `cancelled`, `lost` shuttle destroyed, `noDock`, `loadTimeout`, `flightTimeout`)
refund the escrow and put unsent goods back in the trader's stock; goods already flown on a destroyed shuttle are lost.

**UI.** `app/tradeSnapshot.ts` builds `UiTrade` (credits, hailable ships/stations with their lines, prices and delivery probe, deals);
`TradeWindow.svelte` (two columns, quantities, totals, barter box, offer/accept; a bottom
sheet with You/Them tabs on phones), a Hail window (`HailWindow.svelte`), the combat HUD (`ui/combat/`), trade status in `ShuttlePanel`, trade
alerts in `alerts.ts`.

**Adding a trader:** add a `TraderDef` to `trade.traders` in `src/content/trade.ts` with a `match` (a `faction` and `role` to catch a
generated ship kind, or a `side`); the content test checks that its stock items exist and are priced. **Adding a price:** set `price` on
the `ItemDef` (the content test fails for an unpriced item); tilt it per trader with `tagMods` or per faction with `sell`/`buy`.
**A new faction:** add a `TradeFactionDef` keyed by its faction id. When the real faction system arrives, replace `tradeFactionOf`,
`profileFor` and the `relation + reputation` rule in `trade/traders.ts`; everything else reads those.

## Asteroids, `src/sim/asteroids/`, `mining/`, `rock/`, `outposts/`

**Region model: its own `AsteroidC` entity plus the owner layer (not a `ShipC` kind).** An asteroid (one big body, or a whole
field of small rocks) is an entity with `AsteroidC { kind, seed, coverage, x, y, width, height, parts }` (sector tiles).
Its rock tiles carry the entity id in the `ship` owner layer, which now means "owning region". Why not `ShipC` with a new kind:
- Every field system, combat, AI, capture, the node strip and the UI iterate `ShipC` / `regions(sim)`. A ShipC asteroid would
  need a guard in each of them, and a 120x120 rock would join the air, heat and light sweeps every tick for nothing. With its
  own component, all of them ignore asteroids with no change.
- `shipAt(sim, x, y)` returns the owner only when it is a `ShipC`, so rock reads as "no ship" in every ship rule (`shipIdAt`,
  impacts: a shot landing on rock misses, build-owner rules). `ownerAt` is the raw layer; `asteroidAt` gives the asteroid.
- Jumps: `liftShip` only takes the ship's rectangle and `liftSet`, so asteroids never jump; `archiveSector` freezes every
  entity and chunk left, so an asteroid stays in its node's archive and comes back whole (`content/ships/asteroids.test.ts`).
  The translation table moves `asteroid` (x, y, parts).
- Gap rule: `placementGapError` (ships) also refuses overlap with, or coming within `ASTEROID_GAP` (4) of, any rock body's
  bbox (`parts`, not the field's whole bbox, so ships may sit inside a field's extent). `asteroidGapError(sim, parts)` is the
  asteroid side: rock bodies keep `ASTEROID_GAP` from every ship's padded frame and from other asteroids' rock.
- Bases (slice 3): an outpost is a `ShipC` region of its own over the base rectangle; the rock and ground inside it stay the
  asteroid's (owner layer), so its field systems see rock mass as walls and ground as vacuum, and its crew path over both.

**Tiles.** Two rock forms. `Struct.Rock` (5) is rock **mass**: solid, airtight (`gasConductance` 0; atmosphere and smoke zero
it like a wall), unwalkable, blocks sight (`los.ts`), no integrity (hp 0: weapons do not chip it), no room. `Struct.Ground` (6) is
rock **ground**: walkable (`isWalkable`), conductance 1 but airless (`isAirless`: atmosphere, smoke and temperature hold it at
vacuum like Space, so crew there need suits), a foundation for floors, walls, doors and modules. Helpers `isRock` (mass),
`isGround`, `isAsteroidRock` (either). Two u8 fields: `ore` (an `OreDef.code`, 0 none) and `oreAmt` (units left); ore sits on
either form. Pod mining turns a tile into Space (no rubble), which `syncOwner` already clears. Ore kinds are content
(`content/ores.ts`): iron -> `item.metal`, ice -> `item.ice`, rare metals -> `item.electronics`. Save v27.

**Generation** (`gen.ts`, `shape.ts`, `noise.ts`; pure, `Rng` per seed, separate from shipgen; `validateAsteroid` reuses
shipgen's `structureParts`):
- Big (`BIG`): 40-120 tiles on the long side, aspect 0.6-1, 5-9 metaballs roughened by seeded value-noise fbm (rough 0.75),
  largest 4-connected body kept and holes filled, then cropped. Veins: one per ~200 rock tiles, 12-40 step 4-connected random
  walks through either form, 35% of steps two wide, 70% starting in rock mass, ore picked by `weight.big`, amounts x1.6 in mass.
  Coverage (`BIG.coverage` odds open 3 : mixed 3 : dense 4, forced by `coverage`, the outline stays): a mass field = ridged
  noise cubed + 1-2 massifs (domes) + 1-4 craters (a sunken floor ringed by a rim) - an outer-band bias; the top `share` of body
  tiles (share drawn in `BIG.mass[class]`: 6-20%, 30-55%, 78-100%) become rock mass, the rest ground, so the class's range holds
  exactly. Field rocks are rock mass only.
- Field (`FIELD`): extent 70-110 x 45-70, 18-34 rocks of 3-15 tiles (sizes lean small), gathered around 2-4 clumps, placed by
  rejection sampling with 3 empty tiles between rock bboxes. 65% of rocks get 1-2 ore pockets (diamond blobs, radius 1-3).
- `stampAsteroid(sim, plan, x, y)` writes only rock tiles (struct, hp 0, owner, ore) through the grid API, so Space inside a
  field's bbox is untouched. `debug.spawnAsteroid { kind, seed, x?, y?, coverage? }` (auto spot: first fit scanning from the
  sector's top-left) emits `asteroid.spawned`.
- Render: `render/asteroidView.ts`, a PLACEHOLDER: rock mass as blocks `ROCK_MASS_Z` (1.2) tiles of height, ground as flat
  diamonds with hashed crater pits, ore tinting the top; sizes from `TILE_W`/`TILE_H`/`Z_PX`; one Graphics per asteroid in its
  own region layer set at the sector origin, rebuilt on the struct/ore chunk revisions under its bbox. A region's own tile art
  (`regionTiles.kindAt`, `gridView`) treats both rock forms as Space, so floors and walls are never drawn on rock.
- **Mining pods (slice 2)** (`src/sim/mining/`, `systems/mining.ts`):
  - `module.pod_bay` (3x3 solid pit, access tile beside the middle of its east side, `vehicleBay: { class: 'pod' }`) holds one
    `vehicle.mining_pod`. The pod is an ordinary `VehicleC` + `BodyC` (stowing, body pinning, targeting, jumps with its ship all
    come free) of class 'pod' (trade couriers and boarding parties skip that class), `VehicleDef.size` 2.6 tiles and
    `VehicleDef.mining { unitsPerSec }`. Numbers: speed 6 tiles/s, hold 24 units, laser 2 units/s, 30 hp, evasion 0.4, one pilot.
  - Pilot (`mining/pilot.ts`): a stowed pod with no pilot reserves the best free crew member (on its ship, of its side, not
    drafted, not reserved by another order, highest piloting, then lowest id) and sends them through `sendToEmbark` (the shared
    body of `vehicle.embark`, `vehicles/embark.ts`); the order records `pilot`. Nobody free: the order waits and emits
    `mining.waiting` once. The pilot stays aboard between trips; at the end of the order they climb out at the bay (or, still
    walking, are released back to their schedule).
  - `MiningPodC { asteroid, tiles, phase, target, progress, recall, trips, pilot, waiting? }` is the order. `mining.order { pod, asteroid, tiles? }`
    (replaces any order; a pod already out turns to it) and `mining.recall { pod }`.
  - The mining system (before the vehicle system): stowed and empty -> pick a tile and launch; outbound -> fly straight at the
    tile centre (the system steers; a vehicle with no destination just holds there); mining -> cut `oreAmt` into the hold,
    and at 0 clear `ore` and `writeStruct(Space)` (the owner layer clears with it); hop to the next tile while there is room;
    full, empty-handed or recalled -> `dest = bay` and the vehicle system flies it home and stows it. Stowed with ore aboard it
    waits ('unloading') while the existing cargo planner has crew haul the hold to storage from the bay's access tile; an empty
    pod with nothing left, or recalled, ends the order. The laser works from above, so buried vein tiles are mined like
    surface ones.
  - Tile picks (`pick.ts`): nearest unclaimed ore tile of the order to the pod (squared distance to the tile centre), ties to
    the lower y, then x. Tiles another pod targets are passed over while free ones remain; once every tile is taken, pods
    share them (user decision, 2026-10-22: two pods can share a mining task), so an order ends only when its ore is gone.
  - Events: `mining.ordered`, `mining.pilotSent`, `mining.waiting`, `mining.launched` (plus `vehicle.launched`),
    `mining.tileCleared`, `mining.returning`, `mining.done` (`exhausted` | `recalled` | `lost`). Render: `render/podView.ts`
    PLACEHOLDER: a hull ellipse inscribed in the pod's `size` diamond, canopy with a seated pilot stand-in, ground shadow, a
    pulsing laser from its belly; in the bay it sits on the deck in the shared depth layer, in flight it hovers at
    `ROCK_MASS_Z + 0.9` so it clears rock mass. There is no vehicle pick or hit radius in the sim (shots hit the body point), so
    nothing else scales with it. The bay is a tinted floor-plate fallback; pods are skipped by `shuttleView` and the shuttle panel.
- **Digging and levelling (slice 3, `rock/dig.ts`)**, folded into `job.build`: Floor on rock mass digs (`DIG_TICKS` 15 s, no
  materials; refused as `outerLayer` when a 4-neighbour is Space, ground or out of bounds), Ground on rock mass levels
  (`LEVEL_TICKS` 6 s); other builds on mass are `rockMass`, Ground on anything else `notRock`. `finishDig` writes Floor owned
  by the digging ship and drops the tile's ore as a loose stack (`rock.dug`). Module placement (`placementError`) accepts floor
  or ground and up to `AUTO_LEVEL_MAX` (25%) rock mass; `job.buildModule` adds `AUTO_LEVEL_TICKS` (3 s) per rock tile and
  `finishModule` levels them to ground.
- **Outposts (`outposts/`)**: an outpost is a station (see "Stations"). `generateOutpost(style, seed, {ores, modules, stations}, kind?)`
  generates a `station.<kind>` at the 'outpost' tier (`OUTPOST_STATION` maps trading, farming, mining; pirate, criminal and covert use
  `station.pirate`) and a big asteroid with `minSize`, and `site.ts` fits one to the other: `pickDock` (the n/s airlock nearest the
  template edge with nothing built in the three columns beyond), `placeAt` (dock outer door on the rock face, least overhang), and
  for dug `carveInRock` (hull walls bordering outside become rock; outside cargo frames dropped). Surface levels the base plus a
  one-tile ring to ground; dug packs it with rock mass; both cut the dock's notch to space. `OutpostPlan` carries the template, the
  generated station (rooms) and the dock. `validateOutpost` = `validateTemplate` (immobile), crew, an airlock, the dock collar on
  open space, the asteroid sound, and (dug) no carved tile touching anything but rock mass or base tiles. `stampOutpost` stamps the
  asteroid, writes the base tiles, places modules, makes the `ShipC` (`outpost`, `immobile`, `dormant`), then `spawnCrew` and the
  shared `outfitStation` (stations/spawn.ts: `gen`, trader, `StationC`, `StationAlarmC`, `StationCrewC`), so `stationDirector`,
  `stationAlarm` and the crew AI run it like any station. `debug.spawnOutpost { style, seed, kind?, x?, y? }`, event
  `outpost.spawned`. Render: `rockRoofView.ts` caps a roofed dug base with rock blocks, so from outside it is plain rock.
- **Outpost hostility (`outposts/state.ts`, `systems/outposts.ts`)**: an outpost is stamped `immobile` and `dormant` (the same state as a
  pirate den, see "Stations"); `ShipC.outpost { style, kind, hidden }` holds only the style and the hidden flag. `isDormant` /
  `wake` live in `combat/dormant.ts`. A dormant outpost has no `CombatC`, so the combat snapshot (enemies, auto-target, hostile
  count) never lists it as a threat. `isHiddenOutpost` ships are refused by `targetableShip` and `combat.setTarget`, left out of the
  shuttle targets and trade partners (so the node strip and hail list), skipped by tile and crew picking (`PickHost.hidden`) and
  always roofed. `outpostSystem` (every 10 ticks, before dormancy) discovers by player crew or vehicles within `DISCOVER_RANGE` (6)
  of the base tiles' box (`outpost.discovered`) and wakes on a breach (a base floor touching a floor it does not own). `job.build` /
  `job.deconstruct` into its region wake it ('dug'); aim, damage and boarding wake it in `dormancySystem` (shots at a dormant ship
  without `CombatC` still land with no shields or evasion). `wake` reveals it and adds a `CombatC`.
  `shipStateSystem` never disables an outpost.
- **Claimed bases (slice 4)**: `asteroid.claim { asteroid, x, y, w, h }` creates a player `ShipC` with `base: { asteroid }` over
  the rectangle (validated in `asteroids/handlers.ts`). `shipStateSystem` skips bases. `finishStruct` hands a tile built on asteroid
  rock to the building ship's owner layer; `finishDig` already did. `nearestExterior` (EVA landing) accepts rock ground. The UI's
  build tools resolve the player region per tile (`controller.mineAt`), so the same tools work on the home ship and on bases;
  input paints with `Renderer.pickSector` (any sector tile).
- **Mining UI (slice 4)**: `app/miningSnapshot.ts` (`UiMining { asteroids, pods }`: ore totals per kind over each asteroid's rock,
  pods with phase, pilot, hold, trips), `ui/AsteroidPanel.svelte`, `ui/PodList.svelte` (also in `ShuttlePanel`), asteroid tiles in
  `NodeStrip`, `api.selectAsteroid` (the controller also opens it on a tap on rock no region claims). Pod bays come with their pod
  when built by crew (`ModuleDef.vehicleBay.builtWith`, spawned in `finishModule`).
- **Base logistics (`ferry/`, slice 5)**: `FerryC` on a shuttle is a run between two player regions (`ferry.order`, `ferry.cancel`); `ferrySystem`
  (after `tradeSystem`) steps `toFrom -> gather -> toDest -> deliver -> home` with ordinary vehicle commands, `makeHaul` loads and the existing
  `cargoJobsSystem` unload. Dock at a free working airlock (`regionAirlock`, `dockError`) else hover (`ferryMode`); hover swaps are instant, crew
  by `eva.out`/`eva.board`. Landed suited crew drop `Suit.vehicle` and are undrafted (they belong to the region). `UiShuttles.regions` /
  `ferryReady`; shuttle panel "Base run", crew card "Base trip". Mining paint: tool `mine` in `app/controller.ts` (`UiToolState.pods`).
  Outposts record their dock (`ShipC.outpost.dock`); `dockError` returns `notDock` for the rest.
- Contact sheets: `node tools/asteroids/cli.js <big|field|all> [--from 1] [--count 12] [--scale 4] [--coverage open|mixed|dense] [--out dir]`.

## Starmap (galaxy), `src/sim/galaxy/`

Galaxy generation, routes, travel and encounters live in `src/sim/galaxy/`. The app builds the UI snapshot in
`src/app/starmapSnapshot.ts` and publishes it through the bridge. `src/ui/StarmapView.svelte` owns map interaction
and panels, while `src/render/starmap/` draws the zoom levels in Pixi. The starmap issues commands through the app
to change sim state.

**Terms (user decisions).**
- **Node:** one playable location (one sector grid; older text says "sector" for it).
- **Sector:** a group of nodes (a blob of 6 to 12) around a **central body**.
- **Cluster:** a named group of sectors with one owner (2026-10-22: "cluster", not "region", because "region" is the sector-grid ship
  region of `sim/regions.ts`). Code, ids (`g.<rx>.<ry>`), tuning (`CLUSTER_*`) and strings say cluster.
- **Galaxy:** all clusters. Nodes inside a sector are joined by **routes**, sectors by **hyperlanes**, clusters by **gates** (a hyperlane
  that crosses a cluster border) and, across voids, **rift lanes**.

**Model** (`types.ts`). Generated data is immutable and a pure function of (seed, galaxy content, chunk): `ChunkData { sectors, nodes, edges }`.
- `SectorData`: site, radius, padded hull, name, generated faction (`genFaction`), danger, its `cluster` / `clusterName` / `clusterType`, `hub`, layout style and
  central `body`.
- `NodeData`: position, danger, generated territory faction (`genFaction`), `structures: {def, genOwner}[]` descriptors, `resources`, `contacts` present at generation.
- `EdgeData`: `route` or `hyperlane`, length, `fuel`, `charge`, `time`, optional mid-lane `anchor`, `gate`, `rift`.
- The mutable `GalaxyState` (`sim.galaxy`): current node, generated chunks, `discovered` / `visited` (node to tick), per-node
  `NodeState { contacts }` (made on first use from the generated contacts), its own Rng (arrival rolls never touch `sim.rng`), the next
  arrival tick, jump count, travel days and a `rev` counter.
- `galaxyIndex(g)` is a derived lookup (nodes, sectors, edges, adjacency in edge-id order), cached per chunk count, never saved.

**Generation pipeline** (`generator.ts` and the files it composes). Every stage is a pure function of (seed, position or id) that reads a bounded
neighbourhood, so any chunk can be generated first, in any order, and agrees with its neighbours at the seams.
1. **Terrain** (`terrain.ts`): a density field in [0, 1] from domain-warped fractal noise: filaments along one contour of the warped
   noise, **cloud** (nebula) patches on a second channel, a large-scale tide (dense core expanses vs a sparse rim) and a guaranteed
   bump at the start. Zero density is **void**, the **rifts**. Cached on lattices (`TERRAIN_LATTICE`, `TERRAIN_COARSE`, `TERRAIN_LOW`); the
   cloud channel is the nebula data the starmap view paints.
2. **Sites** (`sites.ts`): one candidate per `SITE_CELL` (320) cell, alive with a chance rising with density (`DENSITY_MIN` to
   `DENSITY_FULL`), thinned Matérn-style so sites keep `SITE_SPACING` apart (360 in the core, 640 in thin space), then a radius
   (`SECTOR_RADIUS`, capped so neighbouring hulls keep `HULL_GAP`: hulls never overlap, also across chunk borders). The start cell's
   site is pinned at (0, 0).
3. **Clusters** (`clusters.ts`): seeds on dense ground, one candidate per `CLUSTER_CELL` (1800), thinned to a varied spacing
   (`CLUSTER_SPACING`, skewed small so a few are large). A sector joins the seed cheapest to reach within `CLUSTER_REACH`: distance
   (wobbled by `CLUSTER_BORDER_WOBBLE`) plus `CLUSTER_RIFT_COST` per unit of void crossed, so borders follow the rifts. Clusters with
   fewer than `MIN_CLUSTER_SECTORS` are absorbed; sites within `BORDER_GAP` of a border are left empty (clusters sit apart); **wild space**
   (sectors the cluster reaches only over void or with too few mates) belongs to no cluster and no faction. A cluster has a **name**
   (content name parts), a **type** (`core`, `border`, `corporate`, `trade`, `pirate`, `machine`, `frontier`, `rich`, from its owner's
   kind, danger and density) and a **hub**: its best-scoring sector, the crossroads (more nodes, `spokes` layout, every clear lane kept).
4. **Territory** (`territory.ts`): a faction seed field read at the **cluster seeds**, so whole clusters change hands: one seed per
   `TERRITORY_CELL x TERRITORY_SCALE`, its faction drawn by `GalaxyFactionDef.territory.weight` among factions whose danger range admits
   the seed's tier (plus open space), reach `territory.reach` (default `TERRITORY_REACH`). The start's seed belongs to the `home` faction.
   `danger = min(DANGER_MAX (9), floor(distance from start / DANGER_STEP (650)))`.
5. **Sectors** (`sector.ts`, `layout.ts`): a layout style (`cloud streak clumps ring fork corridor`, weighted, with a looseness; a hub is
   `spokes`, the start sector a `cloud`) and a **central body** (`star red_dwarf blue_giant gas_giant nebula black_hole`, weighted). Nodes
   are Poisson-disk darts inside the disc accepted against the style weight times the body's pull (keep-out around the body, a mild orbit
   band), 6 to 12 of them; the start sector's node 0 is pinned at the origin (`START_NODE` = `s.0.0.n0`). Routes are the Gabriel graph's
   spanning tree plus `ROUTE_EXTRA`. Contents: territory faction, a station of the owner's kinds (or a free traders' station in open
   space), one **node content** draw per node, contacts at `CONTACT_PER_DANGER x danger`; the start node has a trade station.
   **Node content** (`nodeContent.ts`, table `galaxy.nodeContents` in `content/galaxy.ts`): `quiet` (an empty node, a weight curve of the tier)
   plus one entry per kind: `structure`, `danger {min,max}`, `weight {base, perTier}`, `owner`, optional `notIn` (faction kinds) and `notAtStart`.
   One hashed draw per node (`unit(seed, x, y, 77)`, not the sector stream) picks `quiet` or one entry by weight at the node's danger
   tier; a barred entry (`notIn`, `notAtStart`) leaves the node quiet and does not raise the others. At most one table kind per node, and the
   tier stays behind the scenes (no band field). Entries are tried in table order; research comes first so its placement is exactly that of the old per-node research roll (which used the same hash), and the stations and fleets built on it did not move. Adding a kind is one entry. Contacts stay a separate roll: they are ships present, not a
   place, and sit on top of whatever the node holds. Faction stations, the open trade station and the start station keep their own rules.
6. **Hyperlanes** (`generator.ts`): candidates are Gabriel pairs that keep out of the void (no stretch over `LANE_MAX_VOID` below
   `LANE_MIN_DENSITY`) plus **rift lanes**: relative-neighbour pairs up to `RIFT_MAX` that do cross it, so no island of sectors is stranded.
   Inside a cluster: a spanning tree of the cluster's relative-neighbour backbone plus `LOOP_CHANCE` of the other links (some choice, some
   chokepoints), and the hub keeps all its clear lanes. Wild sectors keep their relative-neighbour lanes. Each lane joins the two
   **gateway** nodes facing each other. `ANCHOR_CHANCE` of lanes carry a mid-lane anchor.
7. **Gates**: between two touching clusters one crossing lane is kept (shortest, rift lanes penalised by `RIFT_GATE_PENALTY`), plus a second and
   third with `GATE_SECOND` / `GATE_THIRD` chance at least `GATE_SPREAD` apart; a border that has a detour through a third cluster closes with
   `NO_GATE` chance. Crossing a gate costs `GATE_FUEL` extra and `GATE_TIME` times the days.

**Chunks and the lazy frontier.** A chunk is `CHUNK_CELLS`^2 (4x4) site cells (1280 units). It holds the sectors whose cell lies in it, their routes
and every hyperlane touching them (a lane between two chunks is stored in both, identical). `ensureAround(sim, node)` generates every chunk within
`FRONTIER_RING` (1, so 3x3 chunks) of the node's chunk on arrival; the sensor scan generates the chunk a hyperlane leads into.
`GalaxyGen` (`galaxyGen(seed, content)`) memoises the pure functions per (seed, content); it is a cache and never saved.

**Save.** `SaveData.galaxy` (save v26) holds the state with `chunks` as sorted keys plus `generatorVersion`; `loadGalaxy` regenerates the
chunks from the seed. `GENERATOR_VERSION` (`tuning.ts`) must be bumped whenever the generator or the galaxy content tables change what a key
generates; a save of another version is refused (no migrations, like `SAVE_VERSION`).

**Travel** (`travel.ts`, `route.ts`, `costs.ts`). Costs by length: fuel = ceil(length / 90) for routes, ceil(length / 220) for hyperlanes (+ `GATE_FUEL`
through a gate); FTL charge = 10 + 0.12 x length (max 30 s) for routes, a full charge (`FTL_CHARGE_SEC`) for hyperlanes; days = length / 40 or / 110
(x `GATE_TIME` for a gate). The charge is the existing `CombatC.ftl`; fuel is `item.fuel` in player storage. `planStarRoute(g, from, to)` is Dijkstra on fuel,
ties on time then node id, over discovered nodes.
- **Hyperspace (user decisions 2026-10-22: the starmap is turn-based; a jump enters hyperspace).** `galaxy.jump { ship, route, withDocked? }` is the only way to
  travel (`sector.jump` no longer exists). `route` is the nodes to pass, each pair joined by an edge. It validates (rejections `inHyperspace`, `deploying`,
  `notPlayerShip`, `tradeInProgress`, `noRoute`, `notCharged`, `noFuel`), pays the **FTL charge once** (the largest any hop needs; a hyperlane hop needs a full
  drive, and per-hop charge would make a mid-route hyperlane impossible without recharging in flight) and the **first hop's fuel**, then lifts the ship into a
  packet and archives the node (`enterHyperspace`, `sector/jump.ts`). `sector.state` is `'hyperspace'`, the sector is empty and `Sim.step` runs `advanceTravel`
  instead of the pipeline: the ship's interior stays frozen in the packet. `GalaxyState.travel` holds the route, the node last passed (`at`), the tick in the hop
  and the phase (`hop`, `arrived`, `noFuel`).
- **Turns.** Each hop entered is one turn (`GalaxyState.turn`; edge days stay as data in `galaxy.days` but do not set the pace). The sim moves one hop per
  `TURN_TICKS` (16) ticks, only as pacing. `onTurn(sim, turn)` (`galaxy/turn.ts`) runs once per hop entered (the first on `galaxy.jump`, the rest in
  `advanceTravel`) and emits `galaxy.turn`; NPC movement runs there (see NPC traffic below). The map's glide between nodes is a fixed 700 ms tween in the view, not sim time.
- **Fuel in hyperspace** is read from and burnt in the packet (`galaxy/fuel.ts`: `fuelStock`, `burnFuel`, `ftlCharge`), each hop's fuel as it is entered. A route may start
  with fuel for its first hop only; the trip stops (`noFuel`, event `galaxy.stalled`) at the last node reached when the next hop cannot be paid, and waits there.
  `galaxy.current` and `sector.node` move as each node is passed; the arrival scan and `story.context` follow, then the hop's interdiction check and story draw.
- **Story events in transit** (user, 2026-10-23: they used to pop up while idle, from a periodic draw every ~3 minutes and an arrival draw at deploy). `galaxy/storyHop.ts`: after a hop that did not interdict, a due queued follow-up opens, else one roll (`STORY_HOP_CHANCE` 0.2, `STORY_ANCHOR_CHANCE` 0.5 on an anchored lane; user, 2026-10-24) draws from the `transit` pool. A decision holds the trip (`Travel.phase 'story'`, `held 'hopEnd'` resumes the hop's end; mid-hop `held 'hop'`) until `story.choose`; `galaxy.drop` is refused (`inStory`). Notices do not hold. Physical outcomes are still only recorded, so no outcome needs a node. Save v43. **Packet-aware:** in hyperspace the ship's crew and cargo are packet data, so story requirements, odds, pools and effects run inside `story/world.ts` `withPlayerAboard` (the packet's entities are restored into the world under their ids, used, and lifted back; re-entrant, a plain call in a node). Every effect kind works on the packet; only item overflow differs (no floor to spill on, so what does not fit in storage is lost) and `physical` stays a log entry.
- **`galaxy.drop`** ends the trip. At a node (the end, stalled) it drops at once; mid-hop it cuts the route after the hop under way and drops at the next node on arrival
  (the ship is in a lane, not at a node, and falling back would waste the hop's fuel). Dropping restores the node's archive (`dropOut`), or on the first entry makes its
  generated contacts real ships (the node's archive owns them once left), and the ship waits in state `'deploying'`; `sector.deploy` places it (the deploy picker),
  restarts the arrival clock and draws the owed story event.
- **Flee is a one-hop hyperspace trip.** `combat.flee { ship, to? }` for the player's ship is `galaxy.jump` with a one-hop route to `to` (an adjacent node) or, by default,
  the cheapest adjacent node it can pay for now (least fuel, then charge, then node id). The player then drops (or opens the map). AI ships keep the old flee (`'fled'`).
- Ids: `Sector.node`, `SectorArchive.node`, `archiveOf`, `restoreArchive` and `sector.jumped` (emitted at the drop) use the galaxy node id (a string; `START_NODE` at the start).
- While `sector.state` is not `'active'` the pipeline is skipped, `galaxySystem` and `rollArrival` return early, and arrivals only spawn into an active node.

**Turn clock** (`turn.ts`). Turns come from two triggers that share `GalaxyState.turn` and both call `onTurn(sim, turn, cause)`: a hop entered (`takeHopTurn`), and
TURN_SEC (180, three minutes) seconds of game time while the sector is `'active'` (`tickTurnClock`, `galaxy.turn` with `cause: 'time'`). `GalaxyState.turnClock` counts only active ticks
and is reset by a hop's turn and at `sector.deploy` (`resetTurnClock`), so a hop never also fires a time turn for the same stretch.

**NPC population** (stage 2 of the living world; `ports.ts`, `roster.ts`, `agenda.ts`, `fleets.ts`, `fleetShips.ts`, `rebuild.ts`, `graph.ts`, `names.ts`, `dock.ts`). Fleets are
persistent: nothing spawns or despawns.
- **Ports** (`ports.ts`, derived from node structures, nothing stored): a station of a pirate faction is a `den`, a military station of a government a `depot`, any other station a `station`;
  an asteroid field a faction owns (its territory) is a mining `outpost` (if it fields miners); a derelict in rogue space is a drone `nest`. `Port { id: '<node>#<i>', kind, size 1..3, owner, role, trade }`;
  size = 1, +1 on a coin flip, +1 in a hub sector. `PortKindDef.groups[size - 1]` (content) is how many groups it fields; a market also hosts free traders (TRADE_GUESTS).
- **Rosters** (`roster.ts`): `ensureChunk` calls `populate(sim, chunk)`, which makes each port's fleets from (seed, port, slot), so a region has its ships the moment it exists. A group's size is a
  budget (`FleetGroupDef`: a drawn `budget` spent on `sizes` costing `FleetContent.sizeCost`, up to `maxShips`; traders, miners and civilians are `maxShips: 1`). `FleetContent.classes` maps each generator
  hull family to a size class and roles; a seed is searched whose first generation attempt builds that family (`previewHull` in `shipgen/generate.ts`), so a heavy ship is a cruiser. A `Fleet`
  holds `home` (port id), `Contact`s with `name` (`names.ts`, per-faction `FactionFleetDef.names`, unique among living ships) and `size`, `legs`, `synced`. Nothing is made in the player's own node: a port
  homed there starts its fleets one hop out and coming in. No `GENERATOR_VERSION` bump: chunk output is unchanged (rosters are state, not chunk data).
- **Agendas** (`agenda.ts`, `stepAgenda`; all tuning in `tuning.ts`): rest at home, then an outing of `FLEET_LEGS` stops, `FLEET_WORK` turns at each, then home. Traders pick stations within `FLEET_RANGE` of home
  (`onDock(sim, fleet, port)` in `dock.ts` is the stage 3 hook, called on every arrival at a port), miners the nearest ore fields, patrols nodes of their faction's territory, pirates and raiders any node near the den.
  A hop away from home may break the fleet down (`BREAKDOWN_CHANCE`): it is stranded (`damaged`, `dwell` = repair turns) and calls for help; a crippled ship after a fight strands its fleet too.
  Every step is a function of (seed, fleet id, turn) hashes, never an Rng. Paths and targets come from cached BFS reaches (`graph.ts`, per galaxy index).
- **Scale** (`fleets.ts`): `stepFleets` runs once per turn from `onTurn`. A fleet is *simulated* while its node or its home is within FLEET_AREA_HOPS of the player; others are frozen (`Fleet.synced` stays
  behind). `syncFleets` (at the start of a turn and on arrival) plays simulated fleets forward with `catchUp`: exactly turn by turn for up to CATCHUP_MAX turns, so a region caught up equals one stepped; after a
  longer absence the fleet goes back to its home with a hashed rest and only the last CATCHUP_MAX turns are played (the cycle phase differs; deterministic and valid). The save holds descriptors only.
- **Losses and rebuilds** (`fleetShips.ts` `reap`, `portIndex.ts` `owe`, `rebuild.ts`): ships only become real in the player's node (`materialiseFleet`, `Contact.ship` set, `ShipC.name` is the ship's name) and are lifted out when
  the fleet or the player leaves. A ship found wrecked or taken is gone: the fleet forgets it and its port owes a replacement (`GalaxyState.ports[port].queue`), one built every `PortKindDef.rebuildTurns`
  (a single-ship fleet of the lost role and size, at the due turn; frozen ports build what fell due when the player comes near). A ship that fled survives and its fleet runs for home. A fleet with no ship left is gone.
- The same ships are the node's: crossings (`crossAfterHop`, when the player's hop ends): `pass`, `overlap`
or `node` -> `galaxy.crossing`, an `Encounter` (`interdict` | `hail` | `scan` | `distress`, by faction and role; a stranded fleet never interdicts) stored in `GalaxyState.encounters` and `galaxy.encounter`. A pending
interdiction halts the trip in hyperspace (`Travel.phase === 'interdicted'`, `galaxy.interdicted`; the ship stays a packet, `galaxy.drop` and `galaxy.jump` are refused) until `galaxy.respond`.
The view shows fleets within SENSOR_HOPS (`visibleFleets`, `UiStarFleet`): chevrons beside their nodes at the sector level
and a Traffic list in the node drawer (ship name, faction and role, what it is doing, home port). Tests: `content/galaxyPopulation.test.ts` (+ `.slow`), `galaxyTraffic.test.ts`.

**NPC economy** (stage 3 of the living world; `market.ts`, `marketLive.ts`, `dock.ts`, `trade/pricing.ts`, content `galaxyMarket.ts`). Ports have markets; NPC traders and miners move their stock.
- **State.** `GalaxyState.markets[portId] = { turn, stock }` holds only the items whose level is not the port's baseline (`econOf(port).base`: its trade profile's `rollTrader` stock, the commodities at 0, and 20 turns of whatever it consumes). No entry means baseline at turn 0. `Fleet.cargo` / `Fleet.pick` are plain data. `Econ` (baseline, net rates, a pricing trader record) is derived per port and cached, never saved.
- **Model.** Per item with baseline b, net = (production - consumption) x port size and D = 0.04: `stock(n) = (b + net/D) + (stock - (b + net/D)) x (1 - D)^n`, clamped to [0, max(40, 3b)]. Because the stock moves monotonically toward its level, clamping at the end equals clamping every turn, so `advance(econ, state, toTurn)` is the exact catch-up for any gap, the same code path as one turn. Nothing runs per turn for ports: a market is advanced when a fleet docks, the player enters or the UI reads it (reads do not store). `moveStock` is the only write.
- **Price.** `trade/pricing.ts`: `unitPrice` multiplies by `stockFactor(stock, base)` when the trader has `base` (set only while bound to a port); NPCs use `marketValue` (same mods, no spread, no rounding).
- **Decision rule.** On `onDock` a trader sells its cargo, then picks among its next stops (`stops()`, the agenda's own target list, nearest 6) the one where `sum(count x (valueThere - valueHere))` is largest over goods whose value there exceeds here by 15%, and loads them (half the stock, hull cargo). `Fleet.pick` is honoured by `pickTarget` if still a valid stop. Miners load ore at the field (`onWork`, also reached for fields that are no port) and sell it at their home outpost.
- **Live station.** `bindMarkets` (on `drop`, and each turn through `stepLiveMarkets`) makes unbound station traders of the player's node the markets of its ports (`Trader.port`, `Trader.base`, profile and stock from the market); `unbindMarkets` (before `liftFleetsAt` in `jump` and `teleport`) writes the trader's stock back to `markets`. While bound `liveTrader(portId)` wins in `stockAt` / `moveStock`: one copy only. Live stock is integer; a turn steps it with a hashed dither so slow rates still move.
- Save v38. Tests: `content/galaxyMarket.test.ts`.

**Node population** (`populate.ts`, `populateSpawn.ts`, `combat/derelict.ts` `spawnDerelict`, `marketLive.ts` `bindStation`). The galaxy's structures are data until the player first drops into the node; `populateNode(sim, id)` then makes them real, once (`NodeState.populated`), and from then on the node's archive owns them.
- **Order.** `drop`: `dropOut` (restores an archive), on the first entry the node's contacts, `materialiseFleetsAt`, then `populateNode`, then `bindMarkets`. Population goes last so the free water ships appear in and the player's contacts keep their usual places; the structures are laid out west to east from `WEST_MARGIN` (70 tiles) and `SLOT_GAP` (30) east of everything already in the sector, centred on a mid line with a hashed offset, and the sector grows to hold them (`growSector`). `newGame(..., populate = true)` runs it for the start node (the app does; tests default to an empty node).
- **Mapping.** Structure kind and its port decide the generator: station -> `spawnStation(kind, size)` (kind: `station.pirate` for dens, `station.military` for depots, else the station kind named by the port's market profile: `trader.station.trading` -> `station.trading`; size = port size), asteroid field -> `generateAsteroid('field')` (+ a surface `mining` outpost for an outpost port), den in a node with a field -> a dug `pirate` outpost, derelict -> `spawnDerelict` of the node faction's hull (nest: rogue hull, intensity 0.7, robots). Seeds are `hash32(seed, node, structure index, salt)`; nothing reads `sim.rng`.
- **Markets.** `bindStation(sim, station, port)` makes the station's trader the port's market (the same `bindTrader` the free-station binder uses), so the player's trades and the NPC docks of stage 3 act on one copy. `unbindMarkets` on leaving writes it back; on a return `bindMarkets` rebinds stations to ports in id order, which is the order they were made in.
- Save v39 (`NodeState.populated`). Tests: `content/galaxyPopulate.test.ts`.

**Off-screen life** (stage 4 of the living world; `clash.ts`, `meetings.ts`, `wrecks.ts`, `news.ts`, `tuningWar.ts`, `agenda.ts` `hunt` / `headHome` / `chase`). NPC fleets fight each other outside the player's node.
- **Settling a meeting** (`clash(sim, a, b, turn)`, pure): power per ship = `SHIP_POWER[size] x ROLE_POWER[role] x (1 + DEPTH_POWER x depth)`, a fleet's the sum (x 0.5 while stranded). With `ra`, `rb` the powers scaled by `1 +- CLASH_NOISE` (hashes of seed, both fleet ids, turn) and `p = ra / (ra + rb)`, `s = max(p, 1 - p)`: `s >= WIN_ALL` destroys the weaker fleet, `s >= WIN_DRIVE` drives it off (each ship lost with `LOSS_DRIVEN x (s - WIN_DRIVE) / (WIN_ALL - WIN_DRIVE)`, survivors flee), below that both are hurt and each ship is lost with `LOSS_DRAW`. The stronger side is hurt with chance `HURT_WINNER x (1 - s)`. A pirate fleet under `AVOID_RATIO` of a patrol's power avoids it with `AVOID_CHANCE` (kind `avoided`, it flees, nothing else happens). Result: `Clash { kind, winner, share, a, b }`, each side `{ lost: Contact[], fate }`.
- **Finding meetings** (`findMeetings`): of the fleets that stepped this turn, those not in the player's node and not just out of it; opposite directions on one lane (`from`/`node` swapped, settled at a hashed end), then the same node (`wouldFight`: `atWar` and an armed role). One fight per fleet per turn. `resolveMeetings(sim, turn, stepped)` runs from `stepFleets` and, per replayed turn, from `catchUpFleets(..., after)`.
- **Applying** (`apply`): lost ships leave the fleet, `owe` the home port a replacement, and `leaveWreck` writes a `WreckSeed` (generator key, name, faction, turn) into `NodeState.wrecks`; `retreat` for the fled, `strand` for the hurt, `chase` for a patrol that drove a pirate off, `loot` + `headHome` for a pirate that won against a fleet with cargo (`dock.ts` `onDock` unloads it into the den market at home); empty fleets leave `GalaxyState.fleets`. The player's node is left to real combat.
- **Wrecks** (`wrecks.ts`): `drop` calls `placeWrecks(sim, node)` after population: each waiting seed becomes a `spawnDerelict` of that generator key (cause combat, intensity 0.6, `infest: 'none'`, the ship's own name) at `slot(...)` east of everything, then the list is cleared. The archive owns them afterwards.
- **Hunting** (`agenda.ts`): `pickTarget` first tries `hunt`: with `HUNT_CHANCE` a patrol picks a node (within its range of home, any territory) holding a hostile pirate or raider it is at least `HUNT_EDGE` times as strong as, a pirate a node with a trader or miner. Reads the other fleets' current positions (fleets step in id order).
- **News** (`news.ts`): `report(sim, item, turn)` appends a `NewsItem` (facts only: kind, node, who, faction, foe, foeFaction, item, count) to `GalaxyState.news` (bounded `NEWS_MAX`, ids from `nextNews`), emits `galaxy.news` and bumps `rev`; `newsFeed(sim)` is the newest-first query with `precise` = within `SENSOR_HOPS`. Reporters: `meetings.ts` (destroyed, raid, driven, clash, cut, loot), `dock.ts` (shortage, once per port and item per `NEWS_SHORTAGE_TURNS`), `rebuild.ts` (rebuilt). `app/newsSnapshot.ts` words them for the starmap (`UiStarmap.news`, precise or rumour) and `ui/StarmapNews.svelte` shows them.
- Save v40 (`galaxy.news`, `galaxy.nextNews`, `NodeState.wrecks`). Tests: `content/galaxyWar.test.ts`, `app/newsSnapshot.test.ts`.

**The far galaxy keeps living** (#604 slice 1; `control.ts`, `coarse.ts`, `flip.ts`, `pressure.ts`, `tuningCoarse.ts`; plan in `docs/plans/far-galaxy-604.md`). Territory is generated,
but a sector can change hands, so the generated values are `genFaction` / `genOwner` and nothing reads them to mean "who owns this".
- **One answer** (`control.ts`): `sectorOwner(sim, sectorId)`, `nodeOwner(sim, node)`, `nodeOwnerAt(sim, nodeId)`, `structureOwner(sim, node, structure)` (a station owned by its sector's generated faction follows the sector; a derelict, a free trader or another faction's station keeps its owner), `sectorOwners(sim)` (all in one pass). `GalaxyState.control` holds only the sectors that differ from generated: `{ owner, since, pressure?: { by, value, ticks } }` (`tidyControl` drops an entry that says nothing; a flip-back lingers through the cooldown). Ports (`portsOf`) take the current owner, so a port's kind, role mix and market follow it.
- **The coarse tick** (`stepCoarse`, from `onTurn`): on every `COARSE_TURNS`-th turn, over the generated sectors only. Fronts are lane-adjacent sectors (`sectorLanes`: hyperlanes between sectors) held by factions at war (`relations.ts`). A faction's strength around a sector is its own sectors within `STRENGTH_LANES` lanes weighted by hub, stations and `FALLOFF`, less what its ports still owe (`PortState.queue`). The stronger side adds `PUSH_RATE x share x hashed swing` to the weaker sector's pressure (`PRESSURE_KEEP` while the push goes on, `PRESSURE_DECAY` after). A sector flips after `FLIP_TICKS` ticks in a row over the threshold, at most `FLIPS_PER_TICK` per tick galaxy-wide and never two within `FLIP_SPACING` lanes (about a player's 9-hop region), strongest first; never the start sector, a cluster hub, a faction's last `FACTION_MIN_SECTORS`, the player's own sector or one inside its `FLIP_COOLDOWN`; the taker must border it. Pirates raid rather than hold (`PIRATE_RAID`, `PIRATE_HOLD`, a higher flip threshold). **Expansion** is the same machinery: an unowned sector has no defender but `UNOWNED_DEFENCE`, and any lane-adjacent faction that settles (not pirates, not the rogue AI) pushes at `EXPAND_RATE`; a claim is reported as `fell` with no `foeFaction`. Rolls are `unit(seed, sector, tick)`: no Rng, no catch-up. Cost is O(sectors) per tick (about 1.4 ms at 540 sectors). A sector just taken **consolidates** (`CONSOLIDATE_BONUS`, `CONSOLIDATE_TICKS`: extra defence fading over 24 ticks, plus an 8-tick `FLIP_COOLDOWN`), so a front advances instead of trading a sector back and forth. Pace is measured on the map a player really has (`test/support/fixtures/coarse.ts`: a walker that explores outward with the real frontier while ticks run; slow sweep in `galaxyCoarse.slow.test.ts`): after the opening land grab, 0 to 1.6 flips per 100 ticks inside the player's region (most of the time nothing, since there is no front or free sector there), 0 to 60 galaxy-wide, 0 to 38% of flips retaken within 20 ticks.
- **Fine feeds coarse** (`pressure.ts`): `addPressure(sim, node, by, amount)` builds pressure on the sector holding `node` when `by` is at war with its owner, and relieves it when `by` is the owner. `fightPressure` is the one call a fleet outcome makes (meetings: destroyed, driven, raid); `playerFightPressure` is the player's (called from `heat.ts` `charge`, once per ship destroyed or captured): if the beaten faction holds the sector the player is in, the sorted-first faction at war with it that borders the sector gets the push.
- **Coarse feeds fine** (`flip.ts`): on a flip the port owners change (`structureOwner`); the old owner's fleets homed there go home to another port of theirs (in the fleet area) or are disbanded (frozen); the port drops what the old owner owed, its market resets, and it owes the new owner's roster (`rosterOrders` in `roster.ts`, through `owe`), built by `rebuild.ts`. Stations already made real (a visited node) keep their kind and look until slice 2.
- **News**: `front` (a push first holds over the threshold), `fell`, `held`; `front` and `held` only outside the fleet area and at most `NEWS_PER_TICK` per tick, `fell` always.
- The starmap colours sectors from `sectorOwner`; a cluster takes the colour of the faction holding most of its sectors. Save v130. Tests: `content/galaxyCoarse.test.ts`.

**Encounters and event grids** (`encounterOdds.ts`, `respond.ts`, `eventGrid.ts`). `galaxy.respond { encounter, choice }` is the one answer (`respond`; the stub
`galaxy.dismissEncounter` is gone). Interdiction: `evade` (roll `unit(seed, encounter id, salt)` against `evadeOdds`: mainly the pilot, `(0.32 + 0.57 x pilot) x (0.6 + 0.4 x engine) - 0.06 x fleet strength`, clamped to [0.05, 0.9], from `Combat.pilot` / `Combat.evasion` read from
the packet; formula and examples in `tuning.ts`; failure fights), `bribe` (`bribeCost`: 12 x strength x (1 + 0.4 x danger) x a standing factor, at least 10 credits; refused as
`cantAfford`; starts the fleet's cooldown) or `fight`. Fleet strength is the sum over its ships of 1 + 0.5 x depth. Distress: `respond` (an event grid with the damaged ships as
neutrals; leaving it earns reputation and the fleet moves on) or `ignore`. Hail and scan: `acknowledge`; a non-hostile crossing only makes one with chance `PASSING_ENCOUNTER_CHANCE` (`passingMeets`). The interdiction is answered in the comms window (`ui/HailWindow.svelte`, see Mid-jump hails below); the other kinds stay in the drawer. `incomingFleets(sim)` (`incoming.ts`) is the pure query behind the arrival-warning alerts (`alerts.syncIncoming`). Success lets the held trip go on (`resumeAfterHop`).
An **event grid** (`GalaxyState.event`, node id `event:<encounter id>`) is a pocket that is not a node: it is not in the galaxy index, has no chunk contents or contacts, is never
archived, and runs no turns, arrivals or story draws. `enterEvent` takes the fleet out of `GalaxyState.fleets`, swaps in an empty sector, makes the fleet's ships real
(`materialiseFleet` with the real node as `node`) and sets the packet waiting to deploy (the deploy picker). `GalaxyState.current` stays the real node; `sim.sector.node` is the event id and the
trip is `phase: 'event'` (`held` remembers the phase to return to). `galaxy.leaveEvent` (also the player's `combat.flee` there) lifts the ship back into a packet, wipes the sector (every
entity destroyed, a fresh grid), returns the fleet's survivors as descriptors (cooldown set; a crippled ship strands the fleet; lost ships are owed by the home port) or forgets the fleet if none are left, and carries the trip on. Leaving with hostiles
about is a flee and needs the drive charged (spent). `GalaxyState.lastResult` keeps the last outcome for the drawer's outcome line. `EventGrid.fled` keeps ships that jumped away from the grid. Save v37.

**Arrivals** (`galaxySystem`, `arrivals.ts`). Every `ARRIVAL_EVERY_SEC` (60) at the current node: chance `ARRIVAL_PER_DANGER x danger` (cap
`ARRIVAL_MAX_CHANCE`; x1.5 in hostile territory, x0.4 in friendly), up to `MAX_HOSTILE_CONTACTS`, the faction drawn from the node's traffic pool
(factions with `traffic` at that danger, the owner weighted up) filtered to hostile ones. Rolls use the galaxy Rng. Contacts of wrecked, fled or
captured ships are pruned each second. Danger 0 never rolls. `playerShipInfo` is the galaxy's `{id, ship}` helper; trade's `playerShip(sim)` is the id.

**Factions and standings** (`standing.ts`, `relations.ts`, `src/content/galaxy.ts`, `galaxyRelations.ts`). There is one faction table: the galaxy
faction defs. Each names the generator styles of its ships, combat side, territory, stations, traffic, `baseStanding`, `specialities` and a
**reputation key** (`reputation`), one per faction (`navy`, `meridian`, `helix`, `vantor`, `traders`, `pirates`, `drones`; the test checks they are
unique). Reputation stays in `sim.story.reputation`, the only store. Who is at war and who shares standing is the **pairwise relations table**
(`GalaxyContent.relations`: `{ a, b, stance: 'war' | 'neutral' | 'allied', spill?: [into a, into b] }`, one row per pair; an unlisted pair is
neutral; `alwaysHostile` factions are at war with all). `stanceBetween`, `atWar` and `spillSources` read it; phase 2b adds rows. Standing:
`baseStanding + reputation[own key] + STANDING_SPILLOVER (0.25) x sum(spill x reputation[their key])`, tiers hostile below `HOSTILE_BELOW` (-2),
friendly from `FRIENDLY_AT` (3). Trade reads the **owner**: `Trader.owner` (a galaxy faction id, set from the port by `bindTrader`/`Econ`, or from
`Ship.gen.owner` for fleet ships) picks the reputation key for prices and hails (`repKeyOf`); a trader with no owner falls back to its trade faction's
key. `story.context.faction` is the territory owner's reputation key (so event `factions: ['meridian']` matches Meridian space). Save v58.

**Faction specialities** (`FactionSpecialityDef`). The station kind decides what a station sells; the owner faction weights it. `stock` is a tag ->
weight on the count and odds of the trade profile's stock lines (`rollTrader`, same draws, so unweighted lines roll as before); `prices` multiplies
what its stations sell an item or tag for (Meridian fuel x0.85, in `applyMods`); `blueprints` lists the module categories it always stocks (others at
`OFF_SPECIALITY_STOCK` odds, a fixed roll per port and def); `gate` holds a category's tier back until standing with the owner reaches a number (the
navy: Mk II defence from 0, Mk III from 3); `shipyard` is Vantor's hook for #125 and nothing reads it yet. The starmap node info and the station
inspector show `app/stockHints.ts` (`portHints`, `nodeHints`).

**Zoom levels** (view design, built on `starmap-macro-wip`, not ported). The map has three levels by zoom, each drawing from the same chunks:
1. **Sector:** nodes, routes, hyperlane exits labelled with where they lead, central bodies, sector outlines, the nebula cloud channel, the plotted
   route.
2. **Cluster:** sectors as patches in their cluster's colour with body, name, danger and known services, joined by connectors; for route planning.
3. **Galaxy:** clusters as patches (uncharted ones as fog) joined by gates, rift lanes and routes through unclaimed space.
The sim side is `clusterName` / `clusterType` / `cluster` on sectors and the `gate` / `rift` flags on edges.

**View** (`app/starmap*.ts`, `ui/Starmap*.svelte`). `buildStarmap(sim)` (app) turns the generated galaxy into `UiStarmap` (plain data in `ui/starmapApi.ts`: sectors with outlines and bodies, nodes, edges, exits, clusters and their links,
nebula tiles; colours as theme tones). The bridge builds it lazily (`warmStarmap` in idle slots, or on first open), keeps fuel and charge fresh while the screen is open, and rebuilds on `galaxy.rev`. `StarmapView` owns the camera, hit testing and hover and
picks the level by zoom (sector below 2200 units across the short side, cluster below 11000, galaxy above); the level components draw with `starmapStyle.ts`, the only module that maps tones and danger to theme tokens. Flee mode (`flee` prop) restricts picks to
nodes one jump away. While the map is open the world is not rendered.

**Fuel economy and stranding** (user decisions 2026-10-26; `galaxy/stranded.ts`, `content/galaxyMarket.ts`, `content/trade.ts`). `item.fuel` is a market good: trade stations make 1/turn x size, mining outposts 0.6, farms 0.3, and every
civilian station, outpost, farm and depot profile stocks it at a price near 8 credits. A purchase through the normal deal flow bumps `fuelBought` (goal `goal.buy_fuel`). The trade window has a **Refuel** button
(`TradeSlip.svelte`: fill up to 24 units, one `trade.offer` then an automatic `trade.accept`) when the structure lists the `fuel` service. **Distress tug:** `isStranded` (active at a node, fuel below the cheapest adjacent jump) and no
affordable fuel on sale in the node (`fuelOnSale`) allow `galaxy.distress`; it saves `GalaxyState.distress { node, sent, due }` and the tug arrives `DISTRESS_TURNS` (2) turns later (`stepDistress`, from `onTurn`): fuel for two
of the cheapest jumps (at least 6) at 3x the item price. It always delivers: the player pays what they can, the unpaid part costs `DISTRESS_UNPAID_REP` reputation with the traders (no debt to track, never a dead end). UI: `StrandedBanner`
(`api.stranded`, `app/strandedSnapshot.ts`). Save v52.

**Debug commands:** `debug.galaxyReveal {radius}`, `debug.galaxyTeleport {node}`, `debug.chargeFtl`.

**Tests:** `galaxy/generator.test.ts` (determinism, order independence, seams, costs, start), `generator.slow.test.ts` (7x7 spacing and hull overlap, 9x9
connectivity), `route.test.ts`, `content/galaxy.test.ts` (content, standings, travel, arrivals, save, generator version, deploying).
**`newGame` cost with the galaxy: about 350 to 450 ms** (measured 2026-10-22 at `FRONTIER_RING` 2: 25 chunks; at 1 (now): 9 chunks, 270 to 450 ms), mostly generation.

**Tuning** (`galaxy/tuning.ts`): denser galaxy: `SITE_SPACING`, `SITE_CELL`; bigger sectors: `SECTOR_RADIUS`; busier sectors: `NODES_PER_SECTOR`, `NODE_SPACING`;
more loops: `ROUTE_EXTRA`, `LOOP_CHANCE`; cluster size and spacing: `CLUSTER_SPACING`, `CLUSTER_REACH`, `MIN_CLUSTER_SECTORS`; how closed the borders are:
`GATE_*`, `NO_GATE`; faster danger ramp: `DANGER_STEP`; bigger faction blobs: `TERRITORY_CELL`, `TERRITORY_SCALE`; jump prices: `*_UNITS_PER_FUEL`,
`ROUTE_CHARGE`; pressure while staying: `ARRIVAL_*`.

## Sector grid

`sim.sector.grid` is the sparse, chunked `SectorGrid` for the playable node. A ship or station's `ShipC` holds its
bounds. The tile store's `ship` field identifies the owner of each tile, and `shipGrid(sim, shipId)` gives
field systems a bounded view for region work. Reads and writes on that view use sector coordinates directly.

Templates and generated layouts are stamped from local coordinates into the node. Live crew, modules, jobs,
projectiles and vehicle bodies use sector coordinates. A jump uses a `ShipPacket` from
`src/sim/sector/packet.ts` to lift the ship and stamp it into the destination. The renderer shows the node
through the [main and inset cameras](#camera-passes-and-layer-ownership).

## Historical sector-grid migration

The October 2026 refactor notes (inventory, data model, migration steps, split plan, risks) moved to the
[status archive](STATUS_ARCHIVE.md#historical-sector-grid-migration). The live model is [Sector grid](#sector-grid).

## Crew AI: one system for every ship (user principle, 2026-10-21)

NPCs use almost exactly the same crew AI as the player's crew. There is no parallel "NPC behaviour" stack:
- Station, enemy and player crew all run through the same needs (`systems/needs.ts`), job generation (the `*Jobs` systems),
  reservation, the scheduler (`assignJobs` in `ai/scheduler.ts`, by role priorities and `WORK_CATEGORIES`), work (`performJob`) and fight (`fight/`) code. Jobs are
  per ship and picked by crew aboard that ship, for every faction.
- The only differences are the **command source** and a **policy layer**. The player issues commands (priorities, drafts, orders);
  an NPC ship has a small per-ship **director**, data and config that sets the same things: it posts jobs and later drafts and
  orders. `systems/stationDirector.ts` is the first one.
- New NPC behaviour is a job kind, a work category or a priority, not bespoke movement code. Patrols are `patrol` jobs; alarm
  response withdraws them and lets the shared fight code hunt (fighter roles engage hostiles on their grid, unarmed civilians flee).
- Remaining player-only spots are listed in docs/STATUS.md (stations, slice 4) and should be made faction-agnostic as they are touched.

## Stations

Built by the station assembly, `shipgen/stationBuild.ts` `buildStation` (kinds, sizes and recipes in `content/stations.ts`;
see docs/STATION_ASSEMBLY.md), and stamped by
`stations/spawn.ts` `spawnStation(sim, kind, size, seed, at?, name?)` (the `debug.spawnStation` command):
- A station is an ordinary ship region with `ShipC.immobile: true` and `gen = {faction: kind, role: size}`: tiles, modules, crew and
  security of the kind's side (`spawnShip`), and a trader (`ensureTrader`, profile `trader.station.<kind>`, `Trader.station` true).
- Immobile: no engines or FTL; `combat.flee` is refused (`immobile`) and the enemy AI never tries; the ship-state rule never disables it
  for lacking engines (it has none to lose: disabled is crew and power only). A jump archives it with its node like anything else.
- Placement: east of everything in the node, vertically centred. The node's width/height grow to fit a hub (nodes are sparse chunked
  grids; the size bounds placement and the camera only).
- Hostile kinds (pirate dens) and asteroid outposts start **dormant** (`ShipC.dormant` = the integrity it went quiet at; one
  mechanism, `isDormant` / `wake` in `combat/dormant.ts`). `systems/dormancy.ts` wakes it when a player ship or weapon aims at it
  ('aimed'), it is damaged ('damaged'), or player crew stand aboard ('boarded'); outposts also wake on 'dug' and 'breach'. `wake`
  emits `ship.provoked {reason}`, reveals a hidden outpost and adds a `CombatC` if missing. While dormant it does not count for
  `combatState` and the enemy AI skips it.
- Camera: `frameShips` can now zoom below 1 device px per art px (`camera.ts` OUT_LEVELS 1/2..1/8) so a hub fits the screen.
- Cost: a trading hub (149x126, 44 crew) in the node takes the sim from about 0.7 to 7.5 ms per tick (20 Hz budget 50 ms). The
  per-tile field systems dominate: lighting 1.3, atmosphere 1.2, temperature 1.1, smoke 0.8, doors 0.5 ms; settled regions do not
  sleep yet on a fresh station.
- **Station life (slice 4).** `settleIn` (end of `spawnStation`) adds `StationC {courts, posts, nextPost}` (strolling tiles in
  plazas, gardens and rest rooms; patrol stops at the armoury, docks, plazas, gardens, drill hall and bridge), `StationAlarmC` and
  `StationCrewC {station}` on its crew. Crew with a role loadout start carrying its first item the station's storage holds
  (taken out of the armoury lockers): a station has been running long before anyone arrives. Station crew live on the shared crew AI: they eat (hunger floors at 25, as the station is
  resupplied off-screen), sleep, work their station's jobs, and idle crew sometimes stroll to a court (`ai/machines/idle.ts`, a
  fallback before `wander`).
- **Director** (`systems/stationDirector.ts`, every 10 ticks): while calm it keeps one `patrol` job (category `patrol`, kind
  `patrol`, an on-tile job worked for 3 s) per able guard at rotating walkable posts. Roles opt in with `priorities.patrol`
  (security and security bots at 2; the player's grid hides the column, as no player director posts patrols yet). On alarm it
  withdraws every patrol job.
- **Alarm** (`systems/stationAlarm.ts`, before the director): per station, outsiders aboard (another faction, no `StationCrewC`)
  who are not invited become `WantedC {station}`; player crew are invited while a docked trade run is in `dockStation` or
  `stationWork`, unless they attack station crew. Station damage (an integrity drop) makes all player crew aboard wanted. A
  hazard scan every 20 ticks raises it for fire or breach with nobody wanted. An intrusion wakes a dormant den. `fight/relations`
  `isHostile` treats wanted crew and that station's crew as mutual enemies, so guards (armed from the armoury lockers at spawn)
  engage and unarmed station civilians flee. An unarmed AI fighter that is on its way to a locker (`EquipOrderC`) arms
  first and only fights bare-handed with a foe in reach (before, the chase and the fetch took turns rewriting its path and it
  reached neither). Events `station.alarm {ship, reason}` and `station.calm`. After 30 s quiet the alarm
  calms and the station's `WantedC` are cleared.


## Crew for hire

Trade stations post candidates derived from hashes (`galaxy/recruit.ts`, `tuningRecruit.ts`). While the player is at the node, `recruitsSystem`
(after `galaxySystem`) keeps one real crew member per candidate aboard the port's station (`ForHireC {key, cost, station}`, station faction
and `StationCrewC`, so they live the station's life) and removes unhired ones when the 20-turn window turns over. `crew.hire {key}` opens a
**hiring run**: a trade `Deal` with `crew: [id]` and the cost in escrow. The existing deal flow does the rest (`dealFlow.ts`): the player's
shuttle docks at a station airlock (no hover fallback: `noDock`), the recruit walks aboard (`trade/recruitLand.ts`), the shuttle flies home,
and on docking the recruit steps out as player crew (allegiance switch, `crew.hired`, key into `recruitLog`) and the escrow is paid. Any failure
(no shuttle, no dock, recruit dead, board timeout, cancel) refunds and puts the recruit back to station life. One live deal per station.
UI: selecting a station opens `ChannelPanel` (`ui/ChannelPanel.svelte`, the comms channel: `JobCards`, `RecruitList`, `PrisonerDeals`; its Trade button opens `TradeWindow`); recruits ride in `UiTradePartner`.


## Engine capacity and the shipyard (progression phase 5)

**Size = the area inside the outer hull.** `hullArea(grid)` (`combat/hull.ts`, `interiorArea`) counts every tile the outer hull profile encloses: interior
walls, doors, modules and floor all count as area, the outer ring itself does not. It is the number behind the ship panel's "Size N / M", engine capacity,
and the jobs screen. There is no overall ship maximum: engine capacity, summed over any number of engines, is the only size limit (add engines to grow). The quiet technical guards are the plan reach (`PLAN_REACH`, 40 tiles from the ship's rectangle), `MAX_PLAN` and the growth clearance from neighbouring ships and rocks (`crowded`), none of them a readout. The jobs screen (an enemy's is `templateHullArea(rows)`, the same rule on its template). The outer ring is
`hullTiles(grid)` (`outerProfile`: hull-kind tiles facing open space or the grid edge). The yard prices and caps by tiles built, outline and floor together. The starter is 416 (ring 88).

**Engine capacity** (`sim/ftl/capacity.ts`, `ftl/overcharge.ts`). `EngineDef.hullCapacity` is the size one engine carries (Mk I 330 in
`content/modules.ts`, Mk II 495 and Mk III 700 in `content/tiers.ts`; the starter on two Mk I is 416 / 660, 63%). `hullLoad(sim, ship)` gives tiles, capacity
(engines with hp above 0), `over` and `ratio`; a ship with no engine module has no limit. Over capacity, `jump` rejects with `overweight` (`galaxy.jump`
and a queued `ftl.charge` with a route) unless the command carries `overcharge`; `combat.flee` always overcharges. Generated ships obey it too: `templateHullLoad`
(the same measure on a template) is a generation check (`fitShell`; hand-drawn templates are not held to it), and `generateAttempt` rebuilds a hull short of engines with the engines it lacks
added to the plan (#129), so an NPC ship, and a prize taken from one, starts within capacity. An overcharged jump calls `applyOvercharge`
before the ship is lifted: risk = overload (tiles over capacity / capacity) against `OVERCHARGE_FULL` (0.5), zero at capacity (nothing rolled). Each working
engine rolls once for its fate (hit for 25-60% of max hp, or destroyed) and once for a fire in its room, on `sim.rng` in engine id order. Event
`ftl.overcharged`. No fuel scaling by hull size. UI: "Size N / M" in the ship overview, and the starmap drawer's overweight line, warning and Overcharge button.

**The hull plan** (`HullPlanC` on the player's ship, set by `hull.plan { ship, tiles }`; free, any time, saved). It is the planned outer hull only: tiles
of open space. Interior walls and doors stay ordinary free builds. `viewPlan` reads it: the tiles a chain of neighbours can build from the ship
(`connected`), floating ones (`loose`), ones in a shuttle's way (`blocked`), and the floor the connected hull shuts in (flood fill). The build tools'
**Hull plan** tool (`app/hullPlanTool.ts`, `HullPlanBar`) paints it with `app/areaPaint.ts` (drag a rectangle's outline; erase takes tiles out) and draws ghost
tiles with `Renderer.setAreas`, only while that tool or a station's Shipyard tab is open (plus the live order's unbuilt tiles at any time).

**The shipyard** (`sim/yard/`). Trading and military stations of the station and hub tiers (`ContentRegistry.yard`, `content/yard.ts`, via `yardService`;
the station must answer hails) sell the plan, in two passes. **Planning pass:** the contractors truss the whole footprint that is still open space (every reachable planned tile and all the
floor the plan encloses), quickly (1 s a tile) and outside the visit cap, for a planning fee (`YardDef.trussFee`, 2 credits a tile, no metal; a tile that already
has a truss is never charged again). A truss is a real `Struct.Beam` tile (existing beam art and rules: saved with the ship, owned by it, not walkable on deck, no
integrity so combat leaves it alone; a suited crew member walks along it, `isEvaWalkable`; the ship's size and engine capacity ignore it: `interiorArea` reads an
open truss as open space). A planned tile stays part of the plan after it is trussed; deconstructing a truss with the normal tool removes it from the plan
(`yard/trussPlan.ts`). **Hull pass:** `quoteYard(sim, station)` turns up to the tier's cap of tiles (walls and floor together) into hull, laid out in rows
(`yard/rows.ts`: the distance in steps from the ship's own structure, trusses not counted; nearest rows first). When the cap cuts a room short it takes the rows
up to a depth that fits plus a cross wall that shuts them in (so the ship left behind is closed and rectangular; the cross wall is paid as hull). If no cut
fits, it builds the largest closed rectangle of the plan's floor against the ship, with its own rim of new walls (`closedRect`), so every visit ends sealed with
no floorless wall stubs. What the cap does not reach stays as truss (open scaffolding) and the next yard picks it up from there. Jobs go up in row order
(`Job.yardRank`) and the crew work the nearest open row and the next (`YardOrder.rank`, `jobFits`); the hull jobs are posted when the planning pass is done
(`yard/jobs.ts`, `YardOrder.stage`). The hull is priced by tile built, outline and floor alike (credits and metal x the tier's multiplier x 1 + `dangerStep` x node
danger; station cap 40 tiles at 10 credits and 0.75 metal each, hub 100 at x1.4); the quote lists the planning fee on its own line and reports the size after
against capacity. `yard.order { station }` pays the whole price into escrow (metal from storage), grows the `ShipC` rectangle, posts the truss jobs (`Job.yard`)
and the station sends its shuttle. `yardSystem` (`yard/flow.ts`, after the trade system) runs it: `launch` (the station's own real shuttle, `freeShuttle`; it waits LAUNCH_WAIT_SEC while that is busy, with
`YardDef.crew` contractors aboard, neutral allegiance, `YardCrewC`; since #287 it is an away site on the player's ship, owner 'yard', the contractors its party from
the start: `dock` the order's airlock, `outside` (they land suited from the shuttle), `noLoot`, no demand; the site's run flies, lands them, takes the
tired or hurt home to the station, and brings everyone home when the order closes the site), `fly` (until one has landed), `work` (they take the jobs through the normal crew AI;
the player's crew take them too, fetching a suit: `planSiteWalk` offers hull-ring sites to crew who breathe), `seal` (the gap wall of each enclosed floor patch
is left for last: everyone inside, the ship's own crew included, walks out first, and only yard crew may close it: `Job.yardOnly`), old hull turned inward (#385, #429: not a stage, no crew job: each time a tile is built, `yard/open.ts` `openInnerWalls` turns the walls `innerWalls` finds, plain walls with no module whose eight neighbours are all the ship's own structure, into floor when the section's floor, walked from them, touches no open space or truss; the section is delivered pressurised: its floor and each opened wall take the air of the room it joins, `YardOrder.air`/`opens`), `recall` (the site closes: its run
calls them aboard, lifting whoever cannot come), `home` (the run ends at the station, where those aboard step out), `done` (`dismiss` ends the run if it still stands and
removes the crew and shuttle). Their air is the air drive's like anyone's: the ledger gives a crew member a docked shuttle's air first when it is of their side or
serves their site (`suppliesTo`), so contractors draw the station shuttle before the player's airlock store, and the player's crew never draw a foreign shuttle. The unbuilt share of the price (hull and fee each by their own tiles) is refunded when work ends early
(`yard.cancel`, combat, a stall, no dock), the built share paid to the station when the shuttle is home; leaving the node ends the order on the spot
(`abortYards`). Save v61. UI: the station panel's
Shipyard tab (`YardPane`: the quote, a Buy button, the order's progress). The panel does not paint: the plan is made in the build tools.

## Black markets, contraband, scans and the truce (progression phase 2b slice 2), `src/sim/blackmarket/`

Design: DESIGN.md "Pirate factions and the black market". Content: `content/blackMarkets.ts` (`ContentRegistry.blackMarkets`, `BlackMarketDef`).

- **Service sets.** A set (`bm.lesser`, and the named `bm.cartel`, `bm.zealot`, `bm.mercenary`) is attached to any station with `attachServices(sim, station, setId)`
  (`attach.ts`): it records the set on `Trader.services`, rolls the fence rate (`Trader.fence`), adds the set's stock lines to the shelf, takes the owner faction if the
  galaxy has one by that string id, and sets the node's truce flag when the set has a truce. The lesser set is attached at populate time to a seeded 25% (LESSER_SHARE) of pirate-held stations and of
  unowned stations in lawless space (`attachLesser`, `galaxy/populateSpawn.ts`); the rest stay hostile dens. Every set has a truce. The named sets are not spawned by the galaxy yet. The station keeps its own trade profile and
  port market; `galaxy/marketLive.ts` leaves the service shelves alone when it binds, steps and unbinds a market.
- **Contraband** is the `contraband` item tag (`item.stolen_goods`, `item.looted_goods`, `item.disruptor`). Sources: a delivery crate broken open or abandoned spills stolen
  goods instead of the delivery (`galaxy/jobs.ts`); a captured ship's hold gets looted goods (`capture/prize.ts`, LOOT_*); the disruptor is sold only at black markets.
  A legitimate trader does not buy contraband (`unitPrice` is null, `checkOffer` says `contraband`); a black market pays `contrabandBuy` of the base value; the fence (cartel
  only) pays its 50-60% for anything.
- **Scans** (`scan.ts`). A navy or corporation station inspects the player when they hail it (`trade.hail`, once per SCAN_COOLDOWN turns per node: `dockScan` starts an
  inspection, below), and a patrol that crosses
  them scans with the usual PASSING_ENCOUNTER_CHANCE (`galaxy/encounters.ts`). A scan that finds contraband carries `Encounter.scan` (`value`): the patrol hails the
  player to stop (Patrol hails, below); trade offers are refused meanwhile (`scanPending`).
- **Inspections** (#138 step 1, `src/sim/inspect/`). The station's inspectors come aboard (design: DESIGN.md "Contraband inspections in the world").
  - `InspectionC` sits on the inspectors' shuttle (the station's own real one, `freeShuttle`, #548; only a ship with no shuttle at all, a patrol
    corvette, gets a made-up stand-in, `Inspection.standIn`; its hold sealed with `Vehicle.outbound` so the player's
    airlock unloaders leave it alone). `start.ts` opens an away site on the player's ship (owner `inspect`, `noLoot`) served by it: the site's run docks at a free
    airlock or hovers, and the party goes out of the hatch in suits (EVA boarding). The inspectors (INSPECTORS of INSPECTOR_ROLE, neutral) are the party, aboard
    by an `inspect` consent grant; their only priority is `patrol`.
  - Party jobs: `Job.party` (the shuttle) makes a job its party's alone, and an inspector takes no other (`crew/jobFit.ts`). `search.ts` posts a `search` job
    (worked from beside the module) at every storage module and every module with an upgrade fitted; `finishSearch` (from `crew/jobWork.ts`) turns the module's
    contraband (`heldItems`) into ordinary hauls into the shuttle (a fitted upgrade comes off and is hauled from the floor). `spotCheck` takes contraband off player
    crew and floors near an inspector. What is claimed is `Inspection.found` and `value`.
  - `flow.ts` (`inspectSystem`, after the yard): fly, search, settle (the lead waits; `blocked` while nobody is aboard or the searches stall), leave (the site
    closes, the run takes them home, `endInspection` removes them with the shuttle). A fight or a lost station ends it; leaving the node (`abortInspections`,
    `galaxy/hyperspace.ts`) during search or settle counts as refusing.
  - `settle.ts`: `inspect.settle` with `fine` (paid, standing hit, they keep the goods), `bribe` (INSPECT_BRIBE_CHANCE seeded roll; taken: paid and the goods
    set down by the shuttle door; turned down: standing hit, no second bribe) or `refuse` (INSPECT_REFUSE_HIT and `Trader.barredUntil`: the station answers no hail
    for INSPECT_BAN_TURNS turns, hail reason `barred`). `scanPending` holds trade only while the inspectors search or wait.
  - Read inspections through `inspections(sim)` (a query of `InspectionC` itself would make its store and change save bytes). The alerts (`app/alertsDerived.ts`):
    `inspect.waiting` (subject the lead, the three answers as alert actions) and `inspect.blocked`. Visitors aboard by a non-lodging grant are `side: 'visitor'` in
    the crew lists (`UiCrew.visit`: Inspector, Contractor). Debug start `?scenario=inspect[&clean][&eva]`.
- **Mid-jump hails** (#138 step 2, #363). An encounter that halts the trip and asks for an answer opens `ui/HailWindow.svelte`, the `src/ui/comms` pieces over
  `UiEncounter.hail` (`UiHail`: caller, look, transcript, holo request, readout, `replies` by outcome). Adapters: `app/comms/patrolComms.ts` (a patrol's hail to
  stop, comply / run) and `app/comms/pirateComms.ts` (an interdiction, evade / bribe / fight: the demand by faction and motive, `motiveOf`: hunter, toll for a
  route guard, else raid; a machine faction has no face; a fleet that has gone still gets a static window). `App.svelte` keeps the answered encounter's
  snapshot so the window stays open after `galaxy.respond`, with `UiEncounterResult` (`id`, `outcome`, text) as narration and the caller's reply, until
  Close (over the deploy picker when the answer dropped out). Debug starts `?scenario=patrol[&clean]` and `?scenario=pirates[&faction=][&hunt][&broke]`
  (`debug.pirates`, `galaxy/pirateDebug.ts`).
- **Refusing and fighting inspectors** (#138 step 3, `inspect/fight.ts`). `crew.attack` on an inspector (`attackableInspector`, checked in `fight/handlers.ts` before the
  hostility check) calls `fightInspection`: INSPECT_FIGHT_HIT, the inspectors' `AllegianceC` set to their faction's combat side, the 'inspect' grant revoked, phase
  'fight', a station's `Trader.barredUntil` pushed out by INSPECT_FIGHT_BAN_TURNS, and `hostileAct(source, 'inspection')` provokes the ship that sent them with its group
  (combat/provoke.ts). `flow.ts` also starts the fight when the source turns hostile some other way (the player fired on it), ends it once no inspector stands aboard,
  and `release`s the ones on the player's ship as ordinary hostile crew (also when the player leaves mid-fight). The fight takes the inspectors on the player's ship
  off the away run (`AwayC` removed), so the site's recall cannot lift them. `abortInspections` (on a jump or flee) starts a fight when any inspector is aboard, in any
  phase, else counts a refusal before the answer. Refusing turns nobody hostile: `refuseConsequences`
  costs INSPECT_PATROL_REFUSE_HIT at a patrol (INSPECT_REFUSE_HIT and the bar at a station).
  Debug: `?scenario=inspect&fight`, `?scenario=patrol&fight`.
- **Truce** (`truce.ts`, `systems/truce.ts`). `NodeState.truce` is the flag; while it holds, the enemy AI holds fire, the node is not in combat and no interdiction is made
  there. The system breaks it when a player ship or weapon aims at a live ship there or player crew stand aboard one. A breach sets `banUntil` (BAN_TURNS), costs standing with
  every faction of kind `pirates`, and turns every ship there (`Ship.banned` remembers the old side) hostile until the ban lapses. Travel is never blocked.
- **Shady crew** (`galaxy/recruit.ts`, `shadyRecruits`). Sets with `shadyCrew` post extra candidates (`ForHire.shady`) with extra skill levels (`SkillXpC`) for a higher
  one-time fee. No wages exist for anyone.

### Pirate factions (phase 2b slice 1)

- Galaxy factions `pirates` (Scrappers), `raiders`, `cartel`, `zealots`, `mercenaries`, each with its own reputation key and generator style (`content/factions/pirates.ts`, scrapper hulls, told apart by loadout, budget, crew and doctrine; `livery.<id>` hooks await #127). Every pirate pair has a row in `galaxyRelations.ts`; an `allied` row beats `alwaysHostile` (zealots and the Rogue AI). Zealots fly on the rogue combat side so drones never shoot them.
- Territory: `territory.shares` (raiders, cartel, mercenaries share the Scrappers' seeds) and `territory.near` (zealots take open or pirate seeds beside the machines'); neither moves any other power's map.
- Cartel: `guardsRoutes` (interdicts only in its own space, hunts only there) and `FleetGroupDef.escort` (hired mercenary ships, `Contact.hired`, fly on the employer's side).
- Raiders: `boarding.prefer` (the ship holds fire while its party is out). Zealots: `boarding.coreRaid`, `capture/coreRaid.ts` (the party walks to the AI core; held for CORE_RAID_HOLD_TICKS undefended, the core module is removed and robots go inert), `FactionDef.neverSurrender` (no prize; the fight ends in a derelict).
- Standing: kills lower the victim faction's key (heat.ts); relation spill warms its rivals; a done bounty also pleases pirate factions at war with its target (jobs.ts `RIVAL_REPUTATION`). Trade: zealots answer a hail only at high standing; `trade/augmentation.ts` is a stub (always 0) until implants (phase 7).

## Hull width rule and the hull plan brushes (#143)

**The rule.** No part of a ship may be narrower than 3 tiles. The footprint (every `struct` tile except Space and `Struct.Beam`: struts and the yard's scaffolding
trusses are exempt) must equal its morphological opening by a 3x3 square (erode, then dilate). Straight edges and 45 degree staircases survive it, 1-2 wide
spines and stubs do not (a 1-step corner notch passes too). `sim/footprint.ts` is the pure helper (`footprintFromGrid`, `footprintFromTiles`, `openingOf`,
`widthViolations(footprint, change?)`, flat byte masks, about 0.2 ms on 120x80). Generated ships, stations and wrecks obey it (shipgen validators reseed an
attempt that breaks it, ruins open by a 3x3 square; see `docs/SHIPGEN.md`).

**The plan is judged as ship hull plus the planned footprint** (the outline plus the floor it shuts in, `yard/width.ts`), and only violations the plan ADDS count
(`changeViolations`), so an old thin template can still be planned on elsewhere. `hull.plan` rejects `narrowHull`; `quoteYard` returns `narrowHull` for a
plan that has violations, and `narrowCut` if no cut the visit cap pays for stays wide (`pickSection` and `closedRect` take a `wide` predicate). I could not make the
cut leave a narrow strip (strips flush against the hull count as supported), so the guard is defensive; `content/yardWidth.test.ts` searches 60 random plans.

**Brushes** (`app/hullPlanTool.ts`, geometry in `app/hullBrush.ts`, the plan logic in `sim/yard/brush.ts`). A brush produces a tile list; `brushPlan(sim, ship,
'add'|'erase', tiles)` and `cutPlan(sim, ship, line)` return the new outline, the footprint, the tiles removed and the new violations, and the tool sends `hull.plan`
on release (no confirm). Rectangle: drag, shown at its real size, red under 3x3 (`minSize`), must touch the ship or the connected plan (`touchesShip`, else
`mustTouch`), preview shows the merged hull ring (amber) and floor (cyan). Erase: outline plus only the planned tiles it removes; real hull is never in the plan, so it
is never touched. Line cut: a straight line snapped to `LINE_SLOPES` (0, 45, 90 degrees; adding 0.5 or 1/3 allows 1:2 or 1:3 staircases, runs of at least 2); planned
tiles cut off from the hull are dropped, the line's tiles become the edge; a line that cuts nothing is a no-op. Mirror reflects every stroke across the ship's long axis.
A stroke that adds a narrow part shows red and does not apply. With no drag the brush shows a 1x1 ghost under the cursor. While the build tools are open a thin
world grid (`render/worldGrid.ts`, Pixi `pixelLine`) is drawn, and with Hull plan open the Build menu folds down to its category row until hovered. A freehand
0/45/90 brush later is one more source of tile lists.

**Debug start:** `?scenario=hullplan` spawns a trading hub (visit cap 100) beside the ship, 100000 credits and 500 metal (`debug.giveItems`), and opens Hull plan.

## Station jobs by station type (issue #178)

Offers (`galaxy/jobOffers.ts`) are still a pure function of (seed, port, window, slot). The port's station type (`Port.station`, from `StructureDef.station`; `stationClass(port)` in `ports.ts`, 'den' for a pirate den) decides the kind:
trade stations post deliveries only, military stations and depots bounties only, research stations **surveys** only, dens the old half-and-half mix. Tuning is in `tuningJobs.ts`.

- **Bounty and survey completion** (`jobs.ts` `tendJobs`): the kill (or entering a survey's node) moves the job from `galaxy.jobs` to `galaxy.claims` and emits `job.completed`. A claim never expires, is not a task (no tracker or HUD entry) and does not
  count against `MAX_JOBS`. Command `jobs.handIn {id}` pays it (normal credit path, standing, stats, `job.handedIn`) at a port of the issuing station class (`StationJob.station`) owned by the issuing faction, at the player's node.
  A survey's target is a node with a feature: a sector body of kind nebula, black hole or blue giant, or an asteroid field (`featureOf`). A scanner module requirement is a later follow-up.
- **Delivery handover** (`galaxy/handover.ts`): arriving with the crate aboard asks for a shuttle, run as a `Deal` with `Deal.handover` set (no goods, no escrow). Preference: (1) the station's own shuttle, only for a trader kind with
  `shuttle: true` (it docks at a working player airlock, crew haul the crate from the deck into its hold, the job is paid when it has it: `job.handedOver` `via: 'shuttle'`); (2) the player's own shuttle, which is the usual case since most stations have none
  (it docks at the airlock, crew load the crate, it hovers beside the station and drops it there, the job is paid on the drop-off with `via: 'own'`, then it flies home and is stowed); (3) by hand at once (`via: 'instant'`) only when neither can run
  (no station ship at the node, no working airlock, no shuttle on either side) or each that could has been called off `MAX_TRIES` times. Crew load through the airlock's unloaders (an ordinary floor-to-vehicle haul) and the hold is sealed `outbound`.
  Combat holds both back alike (a run out is called off, a crate in the hold goes back on deck, the job's clock runs, it is retried when calm); a run that cannot dock or load is retried after `HANDOVER_RETRY_SEC`. A live handover blocks jumping like any live deal.
- Debug: `?scenario=handover|bounty|survey` (handover shows the own-shuttle path: the spawned trade station has no shuttle) (`debug.jobScenario`, `galaxy/jobsDebug.ts`).
- Save v65: `GalaxyState.claims`, `StationJob.station/feature/collected/handoverTries`, `Deal.handover`.

## Prisoner holding (stasis), `src/sim/stasis/` (#116)

Design: DESIGN.md "Prisoners and prizes". Slice 1 is sim, content and app only; the wheel and slab art is wired by the render side.

- **State.** A full slab is the frozen prisoner's own crew entity: `StasisC { reserve, at: 'wheel' | 'carried' | 'floor', carrier, x, y, rot }`,
  with Position, Path, carry and job removed (out of the world, like crew aboard a vehicle; `isIncapacitated` covers it, so needs and mood stop).
  A wheel module (`ModuleDef.stasisWheel`) carries `StasisWheelC.slots`: `SLOT_NONE` (0), `SLOT_EMPTY` (-1, an empty slab) or the prisoner id. The
  wheel is the one record of which slot a slab is in. An empty slab out of a wheel is the item `item.stasis_slab`.
- **Owning reads** (`stasis/query.ts`; render and UI read only these): `wheelSlots(sim, wheel)` (slot 0 at the hatch corner, then
  counter-clockwise seen from above in the module's unrotated frame), `slabPlace(sim, prisoner)` (wheel and slot, carrier, or the two floor tiles
  and `rot`), `slabInfo(sim, prisoner)` (reserve 0..1), `isFrozen`, `slabHeld` (in a powered wheel), `slabDraining` (out of a powered wheel and not
  on a cart), `cartsFor`, `wheelTakes`, `wheelHolding` (the `drawsWhen: 'holding'` rule).
- **Writes** (`stasis/freeze.ts`): `takeEmptySlab`, `sealPrisoner`, `liftSlab`, `dropSlab` (`place.ts` finds two free floor tiles), `stowSlab`
  (lowest free slot, else the lowest empty one, whose slab is set out at the hatch), `initWheel`/`releaseWheel` (from `spawnModule`/`removeModule`),
  `thawPrisoner`.
- **The job** (`stasis/jobs.ts`): one `stasis` job per prisoner or floor slab, category hauling, phases fetch (an empty slab from a wheel slot,
  storage or a floor stack), seal (`SEAL_WORK`, beside the prisoner), pickup (a floor slab) and stow (beside the wheel's hatch). `stasisRoom` (wheel
  slots not holding a full slab, minus slabs on carts and stasis jobs that will make or move one) gates posting. A seal job is posted only when
  a wheel that can take the slab and an empty-slab source are both reachable on foot from the prisoner (`pickWheel`, `slabSources`), and
  `takeSlabFor` is the one way a crew member comes to hold an empty slab: one already in hand is used, never a second taken. Crew take jobs on the ship they stand
  on; a prize's prisoners reach a wheel on another ship by shuttle (below). `isCarrying` counts a cart, so its carrier is not
  preempted or sent to fight.
- **Stow work.** The stow phase takes `STOW_WORK` (`tuning.ts`, from `STOW_SECONDS` = 7.9 s at game speed 1 and work speed 1) at the hatch: `job.progress`
  rises while the crew member stands there, and the slab goes in the wheel only at the end. `stowProgress(world, wheel)` and `stowingNow` are the reads
  render uses: `render/stasisLoad.ts` plays the 63-tick loading animation (`stasisload.<patch>.r<rot>` patches over the wheel, `stasisArt.loadingAt`)
  over that progress, only when the slab goes to slot 0 (`stowSlotIn`), and `crewView` hides the crew member's own cart while it plays (the patches draw it).
- **The system** (`stasisSystem`, after power and autojobs): a cart whose carrier no longer holds the slab's job is set down on the floor (the job
  turns into a pickup); reserves drain one tick a tick while `slabDraining` and refill `REFILL_PER_TICK` in a powered wheel; at 0 the prisoner thaws
  (no PrisonerC or SurrenderedC, drafted where the slab was, hostile). The "Stasis failing" alert is derived from state (`app/stasisAlert.ts`).
- **Slabs by shuttle** (`stasis/rack.ts`, `stasis/shuttle.ts`, #116): `StasisC.at` 'vehicle' (`carrier` = the shuttle) and `SlabRackC { empty }`
  on the shuttle; `RACK_SLOTS` (4) for empty and full together. `siteShuttle(prize)` is the shuttle of the prize's away site (any owner) when it is
  the player's; `rackTile` is where slabs change hands (boarding tile when stowed or docked; hovering, the staging zone's first tile). The job gains a
  rack source (fetch) and a 'ship' phase (cart to `rackTile`, `rackSlab`); `slabDestination` (a wheel, else the rack while the shuttle is there)
  replaces `pickWheel` in posting and after a seal, and counts `rackRoom` (places not holding a full slab: empty slabs make way, one is set out at the rack tile when the rack is full); `stasisRoom` adds `shuttleRoom` (rack room, capped by `homeRoom`, the one answer to whether a shuttle can take a prize's slabs home, also used by `sealRefusal` and the pick of the shuttle to send). `tendShuttles`
  (from the stasis system): a slab whose shuttle is gone is lost (`stasis.lost`, the crew entity removed); at home the rack's full slabs are set
  down by the bay (`stasis.unloaded`, then ordinary pickups), the rack is stocked one empty slab every `RACK_LOAD_SEC` during 'board' from the
  home ship's sources (no crew, like `unloadStep`) and spare empties spill as items; each PLAN_INTERVAL a prize with shuttle work (`shuttleWork`:
  marked prisoners and loose slabs no wheel there takes), no site and a way aboard (`wayAboard`: a working airlock, or floor reachable from outside)
  gets one (`openSite(..., 'stasis', shuttle)`, `demand: { hauling }`). The stasis system is the one owner of 'stasis' sites on any ship: it closes one
  with no work left (done, no longer a prize, no way aboard), and salvage leaves such a site alone and opens its own once it is gone. Away reads: `board` waits while `stocking`, `tripDue` adds `slabTripDue`. `sealRefusal` refuses on a prize only for no player
  shuttle ('noShuttle') or no wheel room on a shuttle's home ship ('noWheel'); `sealWait` is the waiting state the panels show (`noWay` for a prize with no way aboard). Release of a frozen
  prisoner goes through `openSlab` (shared with `thawPrisoner`; refused 'inTransit' on a cart or in a rack), and `Prisoner.from` holds the faction
  for the standing. Debug: `?scenario=prisoners&taken&seal`. Save v121.
- **Prisoner deals at stations** (`capture/offers.ts`, `capture/delivery.ts`, #116): `prisonerOffer(sim, station, prisoner)` is the one answer to
  what a station offers and whether it can be accepted now (reasons include 'busy' and 'noWay' from `slabRoute`, galaxy/handover.ts, and 'underWay'
  with the run); `stationWants` (the Prisoners service's visibility) asks it. 'prisoner.handOver' opens a delivery handover run
  (`startSlabRun`: `Deal.handover.prisoner` holds the agreed terms, `job` is absent), stepped by `stepHandover` like a crate's, with the slab as the
  goods: `slabLoaded` posts a stasis job with `deliver` (the shuttle; phase 'unstow' turns the ring (`turnsToUnload`) and takes a full slab out of a wheel over `UNSTOW_WORK`, onto the cart at `UNSTOW_LIFT` (`unstowSlab`; `stowStage` reports it with `out`, render plays the load's hatch frames backwards, `unloadPlan`); `slabDestination`
  sends it to that rack), `slabBack` on a call-off, `slabDelivered` pays when the slab reaches the station (the station's shuttle flies home first,
  phase 'out'). A shuttle with `outbound` set keeps its rack (`tendRacks` skips it). Cancel goes through 'trade.cancel' (`cancelSlabRun`). Save v122.
- Frozen prisoners lift with their ship on a jump (`sector/members.ts` reads `slabPlace`); empty slabs in wheel slots are a held-items place
  (`items/held.ts`, 'slotted'). Debug: `?scenario=stasis[&unpowered]`, `debug.imprison`. Save v118.
- **Hover cart rest** (`cartRest`, `cart.ts`): when a carrier (an empty slab as `CarryingC`, or a full slab's `StasisC.carrier`) stops, the
  system parks their cart once (`CartRestC`): two free floor tiles (walkable, not a door, not under a floor slab or another cart) straight out
  from them, the near one beside them, on the side most toward the job's target and never on it, else any side; none when boxed in. Kept
  while they stand, cleared when they walk or stop carting. Render reads `cartRest` (null while walking) and draws a walking cart itself.

## Windows, `src/sim/windows.ts` (#516)

A window is a per-tile code in the u8 grid field `window` of a `Struct.Wall` tile (0 = none), not a struct kind: the tile is a wall in every system (air, heat, hp and breach, line of sight, light, rooms, pathing). No system reads the field except the build and deconstruct jobs and the renderer.

- **Encoding:** bit 7 = axis (0 along x, 1 along y), bits 4-6 = the window's size (2..4), bits 0-3 = the tile's index along the run from the lower coordinate. Never 0. Piece (`windowPiece`): size 2 = l, r; 3 = l, m, r; 4 = l, m, m, r. Helpers: `windowCode`, `decodeWindow`, `windowAt`, `windowRun`.
- **Placement** (`windowRunError`, the one validity answer; the Window tool previews with it): 2, 3 or 4 tiles in a straight run, every tile a plain `Struct.Wall` (hull or partition) with no window and no pending job, and a straight piece: wall (or door) at both ends along the axis, none across it (no corner, T junction or thick block).
- **Command:** `job.window { ship, x, y, axis, size }` (x, y = the run's lower-coordinate end) posts one build job per tile (`Job.window` = the tile's code; `struct` stays Wall; cost key `window`, 2 metal + 1 polymer a tile, hauled like other build materials). Finishing writes the field. `job.deconstruct` on a window tile posts a deconstruct job with `Job.window = 0`: it clears the field (the wall stays) and refunds half the `window` cost, rounded down (1 metal a tile).
- **Struct changes:** `writeStruct` and `damageStruct` (breach) clear the tile's code; the rest of the window keeps its codes (its end pieces stay l / r).
- **Render:** with the walls up, `wallPieces` puts `tile.wall.full.m10.win.<l|m|r>` (`m5` along y) first in the chain of a straight partition or far hull tile (the far hull keeps its `tile.hull.cap` over it); the near hull stays the ghost; cutaway stays plain. Roofed, `exteriorIds` draws `<tile.hull.ext.o1.m10 | o2.m5>.w1|w2|w3` (w1 the lower-coordinate end, w3 the higher) on a window tile of a straight near run, else the usual design. A missing id falls back to the plain piece. `gridView` keys its chunks on the `window` revision.
- **UI:** the Window card in the Structure tab (size 2 / 3 / 4), `app/windowTool.ts` (run under the cursor, centred or slid along the wall; red with the reason when invalid).
