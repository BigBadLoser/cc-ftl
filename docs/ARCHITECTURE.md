# Architecture

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

- `sim` imports nothing from the other folders, and nothing from pixi.js, svelte or the DOM.
- `content` imports only types from `sim`. The sim receives content as a registry at boot, so tests can
  inject tiny fixtures.
- `render` and `ui` read sim state and never mutate it.
- `app` is the only place that knows about everything.
- Enforced by ESLint `no-restricted-imports`; a violation fails the build.

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

Every ship, station, derelict and wreck is a `Grid` with:
- dimensions
- a world placement
- per-tile arrays:
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

**Multi-grid** (being replaced by one grid per sector; see "Sector grid (planned)" below).
- Positions are `(gridId, x, y)`.
- Docked or boarded grids connect through airlock and teleporter links in a **portal graph**, and
  pathfinding spans grids through it.
- This one mechanism covers boarding, away teams, derelicts, captured ships and future fleets.

**Galaxy.**
- Chunked and seeded, generated on demand.
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
- Tiles are 2:1 isometric, **64x32 px** at 1x.
- Nearest-neighbour scaling, integer zoom steps only, and the camera snapped to whole pixels.
- Each art pixel maps to a whole number of device pixels.

**Assets come from the pipeline (see Asset pipeline).** The renderer only draws sprite sheets listed
in `public/assets/manifest.json`. Final game content is never drawn procedurally. The exceptions are
debug and overlay visuals (selection frames, overlays, blueprints) and temporary placeholders while art
is pending. Each placeholder is replaced by pipeline art once that art exists.

**Depth sorting.** Draw order is by isometric depth (tile `x + y`, then height). Multi-tile objects
anchor at their front-most footprint tile. Crew sort by their interpolated sub-tile position.

**Crew.**
- Composited at runtime from **sprite layers**: a species body plus slot layers (hair, eyes, arms,
  implants, clothing, gear).
- Every layer has the same frame layout (8 directions x clip frames) and the same anchor, so the layers
  always line up.
- Layers are rendered in Blender with the rest of the character as a **holdout**, so the hidden parts
  are already cut out. Layers then stack in a fixed order in every direction.
- Which layers to use comes from sim components (species, role gear, implants, injuries, appearance
  seed).
- Skin, hair and cloth colours use **palette swap**. `team.*` materials render as reserved key colours,
  which a shader remaps per crew member.

**Lighting.**
- Base sprites are lit in Blender with a fixed key light. A separate **glow sheet** (the emission pass)
  is drawn with additive blending.
- At runtime the sim's power and light fields tint the environment, and glow layers dim or switch off
  when unpowered. Red emergency glow pulses when power is out.
- Normal-map sheets for dynamic lighting are an option for later.

**Effects.** Fire flames are looping sprite frames plus glow. Smoke, embers, venting air and ice, module sparks and welding sparks are particles (`src/render/fx`): a small pooled system on Pixi `ParticleContainer`s with emitters as data, whole-pixel positions, integer scale and a hard cap. Particle art comes from the pipeline (`fx.*` in the env atlas). Renderer-only.

**Visuals.** Field overlays and the tile inspector read grid arrays directly.

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

- **Run with `npm run sprites`** (Blender headless). Generated sheets, JSON and the manifest are
  **committed**, because Cloudflare's build doesn't run Blender.
- **Families:** the art is split into families that each render into their own sheets and are merged
  into the manifest (their old sheets and ids are replaced, everything else is kept), so one family can
  be rebuilt alone: `npm run sprites -- public/assets walls,consoles`. Families: `crew`, `robots` (robot
  crew, see below), `robot_bay`, `env` (props,
  economy modules, items, fx), `walls` (floors, walls, hull, doors), `consoles`, `weapons` (turrets and
  bays), `roof` (plating, edges, livery masks) and `sol` (the engine, AI core and shield packs, rendered by
  their own scripts in `tools/blender/experiments/` and packed by `sprites/sol_pack.py`).
- **Heights:** walls 1.85 tiles, roof top 2.05 (`walls.HF`, `walls.hull_top()`). The manifest carries
  them (`heights`) and `src/render/heights.ts` mirrors them (a test checks the two agree). Roof-mounted
  art (turrets, dishes, the AI mast) is modelled on the roof plane and anchored at floor level, so the
  renderer never lifts real art; `ROOF_H` only lifts stand-ins, markers and projectile launch points.
- **Roof plating:** the module rule (4x4-tile armour modules, layout and colour by hash, patch and inset
  plates) and the livery plan live in Python (`roof_layout.py`, `roof_variants.py`, `roof_livery.py`)
  and are mirrored in `src/render/roofArt.ts`. Livery masks are key-coloured overlays recoloured by the
  livery shader (`src/render/livery.ts`); a ship's scheme is picked from its faction and name.
- **Camera:** orthographic, yaw 45 degrees, 30 degree elevation. One 1x1 tile renders as an exact
  64x32 diamond.
- **Look:** flat colour bands (about 1.0 / 0.75 / 0.5 for top, left and right faces), muted palette
  with shade ramps, a dark 1 px outline taken from the neighbouring colour, binary alpha, and neon
  only in the glow pass.
- **Crew:** about 60 px tall at 1x, 8 directions (no mirroring, since characters are asymmetric),
  clips at fixed frame counts (idle 4, walk 8, work 6, and more as needed).
- **EVA spacesuit** (`sprites/human_suit.py`): human layers in the existing slots, not wired yet.
  - Layers:
    - `torso.eva`, `legs.eva`, `arm.L.eva`, `arm.R.eva`;
    - `arm.L.eva_cyber`: the engineer's suited cyber arm, with the sleeve to a sealed elbow ring;
    - `gear.head.eva_helmet` and `gear.back.eva_pack`.
  - A white hard shell, with the faction colour (`team.cloth`) on its panels and bands.
  - While the helmet is worn, the runtime should skip the `hair` and `eyes` slots. The pack is hidden when
    seated, like the engineer rig.
  - Suit layers cut only against the body and each other, so they never cut ordinary clothing.
  - New clip `eva_float` (4 frames) in every human sheet: drifting, tilted, legs trailing, with the pack's
    thrust puffs on the glow sheet. Map an EVA state to it in `clipFor`; walking in a suit uses `walk`.
- **Robot crew** (`sprites/robots.py`, `robot_kit.py`, `robot_render.py`): rigid parts on a joint rig, not skinned.
  - One body layer per type, in the crew layer format: `crew.robot.body.worker`, `crew.robot.body.repair` (hover
    drone) and `crew.robot_heavy.body.security`.
  - Clips are idle 4, walk 8, work 6, charge 4 (head sunk into its socket, charge cells filling) and wreck 1
    (split at the waist).
  - `team.cloth` is the faction shell and `team.accent` the seam; the eye and charge cells glow.
  - Look previews: `ROBOT_QUICK`, `ROBOT_REST` and `ROBOT_ANIM` builds, composited by `review/robots_preview.py`.
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

## UI

- Svelte components read **snapshots** published by `app` after each tick, or on demand for
  inspectors. They never hold references into sim internals.
- Every action dispatches a command.
- UI-only state (open drawers, selected tab) lives in `ui/` and never touches the sim.

## Saves

- A save is the serialized sim: ECS component stores, grid arrays (base64 typed arrays), RNG state,
  galaxy seed, explored chunks, flags and a **format version**.
- Migrations are written per version bump.
- Content stays out of saves except as IDs.

## Quality rules

- Sim systems get unit tests, plus **scenario tests**, for example "a 1-tile breach vents a 4×4 room
  below 5% O2 within N ticks".
- Soft limit of about 400 lines per file. Splitting is preferred to growing.
- No test or demo code in `src/`. Spikes live in `spikes/` and never get imported.
- **Polish follows gameplay:** no VFX or juice work on a system until its loop is playable.
- One way to do each thing: one pathfinder, one event channel, one ECS.

## Milestones

Each milestone ends with something playable or watchable in the browser.

| # | Milestone | Done when |
|---|-----------|-----------|
| M0 | **Skeleton** | Vite, TS, Svelte and a renderer are set up, with lint boundaries, Vitest, the ECS, the tick loop, the command queue, the seeded RNG and a save round-trip test. An empty scene renders. |
| M1 | **Grid & view** | A hard-coded test ship renders (originally voxels in Three.js; replaced in R1), an isometric camera, cutaway walls, pan and zoom, the tile inspector and a debug overlay. |
| M2 | **Crew & jobs** | Crew pathfind (doors included), take jobs with reservations, follow role priorities and the grid, can be drafted and have minimal needs. Placeholder low-poly crew. |
| R1 | **Pixel renderer** | `src/render` is rebuilt on PixiJS with the sprite pipeline: tiles, walls with cutaway, doors, crew layers with 8-direction clips, depth sorting, glow, pixel-perfect zoom, selection, blueprints and overlays. Three.js and the voxel kit are removed. Gameplay is unchanged. |
| A1 | **Readability session** (timeboxed art) | The pipeline renders a variant sheet (proportions, silhouette, outline, shading bands, rim light, colour contrast, face simplification, crew height) at real game zoom. The user picks the winners, which become pipeline defaults, and crew sprites are regenerated. |
| M3 | **Ship systems** | Power network, atmosphere, breaches, fire, smoke and lighting fields with overlays. Modules come from content, there is build mode with construction jobs, and the light economy works (items, storage, hauling). |
| M4 | **Combat** | An enemy ship grid, weapons (charge and volley), shields, evasion, module targeting, tile effects, enemy AI doctrine, readability feedback, and destroy, flee and wreck endings. |
| M5 | **Boarding & derelicts** | Portal graph across grids, airlocks and teleporters, EVA, crew-vs-crew combat, capture, and exploring wrecks. |
| M6 | **Galaxy & events** | Chunked endless starmap, danger tiers, jumps, the event system (requirements, effects, flags, odds), stores and trade, and basic factions. |
| M7 | **Depth pass** | Species, implants, more weapons and modules, recipes, and hardened saves. |
| M8 | **Character art** | More species (rock, robot, slime), more slot items, and portraits. |
| Later | | Full production chains, mood and relationships drama, recoverable failure, fleets. |

## Working with Claude

- Implementation uses Sonnet and Haiku subagents for well-scoped tasks: one system, one generator, one
  set of tests. Each gets a precise brief.
- The main session handles design, integration and review.
- Throwaway visual tests are published as private claude.ai pages so the user can check them on any
  device.
- Spikes so far: voxel deck (environment, lighting, power-off) and crew lineup (style B chosen).

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
- `triggers[]`: `arrival` (weight; drawn by `story.arrive`), `periodic` (weight; drawn every `periodicSec` outside combat while no
  decision is open), `flag` (`flag`, `atLeast`, `delaySec`: queued when the flag first reaches the level), `chain` (only reached by a
  `chain` effect or debug fire).
- Pool filters: `danger {min,max}`, `factions[]` (null = open space), `eligible: Requirement[]`, `once`, `cooldownSec`. A draw sums
  the weights of a def's triggers of that kind and picks by weight with the story Rng.
- `choices[]` (`ChoiceDef`): `id`, `label`, `hint`, `requires: Requirement[]`, `cost: ItemQty[]` (required and spent), then either
  `outcome` or `check` + `success`/`failure`. An `Outcome` is `{ text?, effects? }`.
- `Requirement`: `species`, `implant`, `skill`, `module`, `item` (kept), `reputation` (min/max), `flag` (min/max; default "is set";
  `max: 0` = "not set"), `crew`. Unmet choices show greyed with the reason (`describeRequirement`).
- `SkillCheck {skill, difficulty, base=0.5, perLevel=0.1}`: odds = clamp(base + perLevel * (level - difficulty), 5%, 95%), the best
  crew member (highest `stat`, ties lowest id) rolls; the odds label ("Repair skill 6 (Mara): 70%") is shown on the choice.
- `EventEffect`: `items` (+/-, to/from player storage), `crewDamage`, `crewHeal`, `skillXp` (100 xp = 1 level via a stat modifier
  source), `reputation`, `flag` (`set`/`add`/`clear`), `chain` (`delaySec`), `physical`. Crew effects take `who`: `random`
  (default), `all`, `actor` (the skill-check roller).
- `physical` outcomes (`derelict`, `boarders`, `fire`, `combat`) are only **recorded** in `story.physical` (capped log). The sector
  layer will add a system that consumes and removes those entries; nothing else needs to change.

**Commands** (`story.*`): `choose {choice}`, `fire {event}` (debug, ignores triggers and eligibility), `setContext {danger?, faction?,
periodicSec?}` (periodic draws are off until `periodicSec > 0`; `main.ts` turns them on), `arrive`, `openNotice`, `dismissNotice`,
`setFlag` (debug). **Events** (output only): `story.started {event, mode, notice}`, `story.resolved {event, choice, success}`,
`story.effect {event, effect, text}`. `?hook` exposes `__cc.fireEvent(id)`, `setFlag`, `setContext`, `story()`.

**Pipeline:** `storySystem` runs last: lapses notices, the periodic draw, starts due queued events. Everything else happens in
command handlers. **UI:** `app/storySnapshot.ts` builds `UiStory`; the bridge pauses the game while a decision is open (and
answering it, `chooseStory`, restores the speed); `ui/StoryModal.svelte` is a centred card on desktop and a bottom sheet at <= 600px;
notices arrive through `alerts.ts` (`UiAlert.notice`).

**Adding an event:** add an entry to `src/content/events.ts` (the content test checks that chains, leads, items, species, modules
and flag triggers resolve and that every choice runs). For an arc, have one event set a flag and the next list a `flag` trigger
(with `eligible` on the flag) or be reached by `chain`. Add a new effect or requirement kind in `defs.ts`, then `effects.ts` /
`requirements.ts` (both switches are exhaustive).

## Sector grid (planned)

Decision (user, 2026-10-19): **a sector is one large grid with everything placed on it.** It replaces the many-grids model
above ("Multi-grid", one `Grid` per ship, cross-grid portals, per-grid scenes). Nothing here is built yet. This section is the
migration plan; the user's answers are in `docs/STATUS.md` ("Sector grid decision").

### Target model in one paragraph

`sim.sector.grid` is a chunked, sparse `SectorGrid` in **sector-tile coordinates**. A ship, station, derelict or wreck is a
**region** of it: the tiles whose `ship` layer holds its `ShipC` entity id, inside the bounding box stored on `ShipC`.
Every entity position (crew, modules, items, jobs, vehicles, projectiles) is a sector coordinate; `gridId` disappears.
Field systems (rooms, air, fire, heat, smoke, light, power) iterate **per region frame**, never the whole sector.
Vehicles are free bodies with continuous position and heading that attach to an airlock or bay. One render scene draws the
sector; the combat panel is a second camera on it. Templates and the generator keep ship-local coordinates and are
**stamped** at a sector offset; jumping **lifts** the player's region (plus docked vehicles) and stamps it into the next sector.

### 1. Inventory: what assumes many grids

Size = lines likely touched: S < 30, M 30–150, L > 150. About 780 `gridId` / `sim.grids` references in `src/` (non-test)
and about 270 in 30 test files.

**Sim core**

| Where | Many-grid assumption | Size |
|---|---|---|
| `sim/grid.ts` | Dense `Grid` with one array per field, `raw()` exposes it whole | L (new `SectorGrid`, `GridWindow`) |
| `sim/sim.ts` | `grids: Map<number, Grid>` | S |
| `sim/structure.ts` | `SHIP_FIELDS` has no empty defaults and no `ship` layer; `isEvaWalkable` stops at the grid edge | S |
| `sim/diffusion.ts`, `systems/atmosphere.ts`, `temperature.ts`, `smoke.ts`, `fire.ts`, `lighting.ts`, `doors.ts`, `rooms.ts`, `alerts.ts`, `autojobs.ts` | `for (const grid of sim.grids.values())` plus `raw()` over the whole grid | M (about 12 systems) |
| `sim/roomIndex.ts`, `systems/rooms.ts` | `WeakMap<Grid, …>` caches, room ids unique per grid (u16) | S |
| `sim/ship.ts` | `gridFromTemplate` makes a new `Grid`; `spawnTemplateModules(gridId)` | M |
| `sim/combat/ships.ts` | `shipEntityOf(gridId)` scan, `nextGridId`, `spawnShip`, `spawnCrew` floor scan, shield helpers by grid | M |
| `sim/combat/components.ts` | `Ship.gridId`, `Target.gridId`, `Projectile.fromGridId`, `Sector {width, height}` | M |
| `sim/save.ts`, `sim/newGame.ts` | `grids: GridData[]`, player is grid 1 | M |
| `sim/commands.ts` (23), `sim/events.ts` (36) | `gridId` / `shipGridId` / `targetGridId` fields | M, mechanical |
| `sim/crew/*` (components `Position`, `Job`, `Drafted`; `pathfind.ts`, `handlers.ts`, `helpers.ts`, `jobWork.ts`, `spawn.ts`, `beds.ts`) | Position is `(gridId, x, y)`; A* runs on one grid's `raw()` | L in aggregate |
| `sim/modules/*`, `sim/items/*` (stacks, stock, haul, craft, plan, handlers), `sim/robots/*` (`RobotC.gridId`, bay, core, jobs), `sim/fight/*` (fighter, equip, los, relations) | `gridId` on components, same-grid checks | L in aggregate, mechanical |
| Per-entity grid lookups: `systems/movement.ts`, `decide.ts`, `drafted.ts`, `crewCombat.ts`, `suits.ts`, `vitals.ts`, `power.ts`, `modules.ts`, `fabricators.ts`, `itemFire.ts`, `airlock.ts`, `shipState.ts` (`hullSum` every tick) | `sim.grids.get(x.gridId)` | S each |

**Portals, vehicles, docking, EVA, capture**

| Where | Assumption | Size |
|---|---|---|
| `sim/portals/graph.ts`, `route.ts`, `pathCache.ts`, `handlers.ts`, `systems/portals.ts`, `Path.then` | Cross-grid links and multi-leg journeys | M, mostly deleted (~400 lines) |
| `sim/portals/components.ts`, `portals/airlock.ts` | Home of `SuitC`, `AirlockC`, `airlockTiles`, `airlockWorking` (kept, moved to `eva/` and `modules/airlock.ts`) | S |
| `sim/vehicles/components.ts` | `homeGrid`, `dest {hover, gridId}`, `hover: gridId` | S |
| `sim/vehicles/geometry.ts` | `dockPoint`, `bayCenter`, `hoverPoint` add `ship.x + local` | S |
| `sim/vehicles/lifecycle.ts`, `handlers.ts`, `queries.ts`, `cargo.ts`, `systems/vehicles.ts`, `systems/cargoJobs.ts` | Disembark onto `{gridId, x, y}`, cargo tile by grid | M |
| `sim/eva/route.ts`, `shuttle.ts`, `handlers.ts`, `errands.ts`, `suit.ts`, `systems/evaFloat.ts` | Float lands on "the hovered grid"; suit errands require the same grid | M |
| `sim/capture/control.ts`, `prize.ts`, `handlers.ts`, `systems/capture.ts` | Bridge holders found by `Position.gridId === ship.gridId` | S–M |

**Combat**

| Where | Assumption | Size |
|---|---|---|
| `combat/targets.ts`, `combat/handlers.ts` (`setTarget`, `spawnEnemy` overlap, `scuttle`), `combat/operators.ts`, `combat/wreck.ts`, `combat/hull.ts` (`raw`) | Target and ship by grid id | M |
| `combat/geometry.ts`, `systems/firing.ts`, `systems/impacts.ts`, `systems/pointDefence.ts` | Convert local to sector with `ship.x + m.x`, impacts subtract it back | S (projectiles already fly in sector tiles by real distance) |
| `combat/effects.ts` (5 `sim.grids`), `systems/enemyAi.ts`, `boardingAi.ts`, `targeting.ts`, `shields.ts`, `helm.ts`, `weaponCharge.ts`, `turrets.ts` | Per-grid lookups | S–M |
| `combat/handlers.ts` `debug.spawnEnemy`, shipgen `debug.spawnGenerated` (branch) | Sector bounds `200 x 120`, bbox overlap test, top-left placement | S |
| Shipgen (`origin/shipgen`, `src/sim/shipgen/*`) | Emits a `ShipTemplate` (ASCII rows plus modules) in local coordinates: **unaffected**; only its spawn command changes | S |

**Render, app, UI**

| Where | Assumption | Size |
|---|---|---|
| `render/scene.ts` (484) | `scenes: Map<gridId, ShipScene>`, `refId` camera ship, `miniScene` (second sprite set for the combat panel), `frame(grid)`, `frameShips(gridIds)` | L |
| `render/shipScene.ts` (151) | One layer stack per ship: cross-ship depth sorting impossible | M |
| `render/gridView.ts` (231) | Rebuilds a whole grid's tile sprites on any `struct` revision | M–L |
| `render/scenePick.ts` (59) | Front-to-back loop over scenes with per-ship offsets | S (shrinks) |
| `render/camera.ts` | One camera | S |
| `render/sectorFx.ts`, `fightFx.ts`, `crewMarks.ts`, `targetMarks.ts`, `shuttleView.ts` (dock vs sector layer), `airlockArt.ts`, `vehicleBayArt.ts` | Draw in "the camera ship's frame" with per-ship offsets | M |
| `render/overlay.ts`, `damageView.ts`, `fx/atmosphere.ts`, `fxView.ts`, `roofView.ts`, `roofPlating.ts`, `itemView.ts`, `moduleView.ts`, `turretView.ts`, `crewView.ts`, `jobView.ts` | `raw()` of a whole grid, filter entities by `gridId` | M in aggregate |
| `app/controller.ts`, `bridge.ts`, `input.ts`, `main.ts`, `debugHook.ts` (`screenOf(gridId, …)`), snapshots (`crewSnapshot` 21 refs, `combatSnapshot`, `shuttleSnapshot`, `moduleSnapshot`, `prizeSnapshot`, `alerts.ts`) | "Current grid", `setGrids`/`setGrid`, gridId in snapshots | M |
| `ui/api.ts` (snapshot types), `CombatPanel`, `CombatPlayer`, `CrewBar`, `PrizePanel`, `ShuttlePanel`, `TileInspector`, `ModuleInspector`, `DebugPanel` | gridId in props and commands | S–M |

### 2. Data model

**Storage: `SectorGrid` (`sim/sectorGrid.ts`, new).**
- Chunks of `CHUNK_SIZE` = 16 (the existing revision chunk). A chunk holds every field for its 256 tiles as its own small typed
  arrays, plus one revision counter per field and a count of non-Space tiles.
- Directory: `Map<number, Chunk>` keyed by `(cy + 32768) * 65536 + (cx + 32768)`, so coordinates may be negative and a sector
  can reach ±500k tiles with no fixed size. Empty space has no chunk at all.
- Each field gets an **empty value** in the spec (`struct` Space, `o2`/`co2` 0, `temp` SPACE_TEMP, others 0).
  `get` on a missing chunk returns it. `set` of the empty value on a missing chunk is a no-op; any other `set` allocates the
  chunk filled with empty values. A chunk whose non-Space count drops to 0 after a lift is released.
- Memory: 13 fields plus `ship` come to about 32 B a tile, so 8 KB a chunk. A 30x20 ship touches 6–9 chunks (about 70 KB).
  A busy sector (10 ships of 60x40) is about 150 chunks, or 1.2 MB. Empty space costs nothing.
- Deterministic order: `chunks()` iterates sorted by key. Serialization writes chunks sorted, so a load gives the same order.

**Grid API mapping.** An `interface GridLike` is extracted from today's `Grid` and both implement it:

| Today (`Grid`) | `SectorGrid` | `GridWindow` (adapter, a rectangle of the sector in local coordinates) |
|---|---|---|
| `get/set(field, x, y)` | Sector coordinates; chunk lookup plus `y%16*16 + x%16` | Adds `(ox, oy)` and forwards |
| `inBounds` | Always true for integers (unbounded) | Inside the rectangle |
| `width/height` | Extent of the allocated chunks (informational) | Rectangle size |
| `revision(field)` | Sector-wide counter | Sum of the overlapped chunks' revisions |
| `chunkRevision(field, cx, cy)` | Per chunk, 0 if missing | Not used |
| `raw(field)` | **Removed.** Replaced by `chunkData(field, cx, cy)` (render, overlays) and `load(field, rect) → Float64Array` scratch (systems) | Temporary: a dense copy cached on the window revision, so unported callers keep working. Deleted in step 7 |
| `serialize()` | `{ spec, chunks: [{ cx, cy, fields: base64 }] }` | n/a |

**Ownership layer.** New field `ship: 'u32'` holds the `ShipC` entity id of each non-Space tile (0 = none). It is written by
stamping, by build jobs (a new tile takes the owner of its neighbours) and cleared by lifting. `shipAt(sim, x, y)` reads it.
Space tiles keep owner 0; the EVA ring and hover space belong to the region whose padded frame contains them.

**`ShipC` references its region.**
- `gridId` is dropped: the ShipC **entity id is the ship id** (entities are referenced by id).
- `x, y, width, height` stay, meaning the region's bounding box in sector tiles (already the case).
- New: `frame` pad (`REGION_PAD` = 2 tiles beyond the bbox: the EVA ring plus one tile of vacuum for venting).
  The padded frame is what field systems, pathfinding and rendering iterate.
- Unchanged: `gen` (shipgen origin), state, faction, `hullMax`, integrity, and livery from faction and name.
- Placement rule: padded frames of two ships never overlap and keep at least `MIN_SHIP_GAP` (about 12 tiles). Ships are never
  close (user rule), so a frame never holds another ship's tiles.

**Rooms and air skip vacuum cheaply.**
- Empty chunks are never stored or visited. Field systems loop `for (const ship of regions(sim))` over padded frames only, so
  the cost per tick is today's cost (the sum of ship areas), whatever the sector size.
- Per region, an **active tile list** (non-Space tiles plus their Space neighbours), rebuilt when the frame's `struct` revision
  changes, drives diffusion, fire and temperature, so sparse shipgen truss ships with a lot of daylight inside their bbox pay
  only for real tiles.
- Room ids stay unique **per ship** (u16 field, labelled by the rooms system per region). `roomTiles(sim, ship)` caches by
  `(ship, struct revision)`.
- Settled regions sleep: when a region's largest gas or heat change in a tick falls under epsilon, and its struct, door and
  module-output revisions are unchanged, atmosphere and temperature skip it until one of them changes. Wrecks, prizes and
  derelicts mostly sleep.

**Coordinates.**
- Runtime: sector tiles everywhere (`Position {x, y, toX, toY, progress, facing}` with no `gridId`; the same for `ModuleC`,
  `Job`, `ItemStack`, `RobotC.home` (now a ship id) and `Drafted.target`).
- Templates (`ShipTemplate.rows/modules`) and shipgen output stay **ship-local** (top-left 0, 0). Stamping translates them once.
- Nothing keeps local coordinates at runtime: crew walk off one ship and float onto another, so a mixed system would breed bugs.
  Ship-local views exist only as helpers (`toLocal(ship, x, y)`) for UI readouts and tests.

### 3. Vehicles as free entities

- **Position and heading.** New `BodyC { x, y, heading, alt }`: continuous sector tiles, radians, and altitude in tiles
  (0 on the deck, `ROOF_H` and above in flight). It is shared by shuttles now and pods, cargo carriers, drones and debris later.
  `VehicleC` keeps the state machine (`stowed | flying | docked`), `homeShip` (replaces `homeGrid`), `home` bay,
  `dock` airlock, pilot, passengers, cargo, suits and `hover: ship id`.
- **Flight.** Straight line at `speed × (1 + SKILL_STEP × piloting)`, as now. `alt` rises out of the bay (bay art timing),
  holds at cruise and drops for docking. Vehicles never collide with tiles; they fly over space.
- **Attach and detach.**
  - Docked means `dock = airlock module`; the body is pinned each tick to `dockPoint(airlock)` (pure geometry in sector
    coordinates now, no `ship.x +` sums). Undock frees the body at the dock point.
  - Stowed means `home` bay; the body is pinned to `bayCenter`, `alt` 0. Launch, return and assign keep today's commands.
- **Hover.** `vehicle.hover { vehicle, ship }`: hold `hoverGap` tiles off the region bbox (`hoverPoint` unchanged in meaning).
  `eva.out` puts suited crew on the nearest EVA-walkable sector tile within `floatRange`; they drift there under `EvaFloatC`.
  The drift is a straight interpolation in sector space, with no grid change.
- **Crew aboard.** Unchanged: `AboardC { vehicle }`, no `Position`, hidden, listed in pilot and passengers. Disembark gives them
  a sector `Position` at the boarding tile.
- **Rendering and depth.**
  - Bodies with `alt` above `ROOF_H` draw in an **air layer** above every tile and roof, sorted by `x + y`.
  - Bodies at hull height or lower (docked, hovering low, lifting from the bay) sort in the shared world layer by the depth of
    their front-most footprint point, plus 0.5 like the engine bell. This is today's docked rule, generalised.
  - `shuttleView`, `dockSequence` and `vehicleBayArt` keep their art and timing; only the parent layer and offsets change.

### 4. Placement and jumping

- **Packets.** `ShipPacket` is the single format for a ship in transit:
  `{ w, h, tiles: local dense field arrays, entities: WorldData subset in local coordinates, shipId }`.
  - `packetFromTemplate(template)` covers templates and shipgen.
  - `liftShip(sim, ship)` makes a packet from a live region.
  - `stampShip(sim, packet, at) → shipId` writes the tiles (`set`, owner = ship id) and creates or restores the entities,
    translated by `at`.
  - `spawnShip` becomes `stampShip(packetFromTemplate(t))` plus the crew roll.
- **Entity ids survive.** World ids are never reused, so lifted entities keep their ids and references between them (vehicle
  home, job target, suit airlock) stay valid. References that leave (a weapon target on a ship left behind) dangle harmlessly,
  because `world.get` returns undefined and is checked today. The jump also clears them explicitly.
- **Translation table** (`sim/sector/translate.ts`): one entry per component that holds coordinates (`PositionC`, `PathC`,
  `ModuleC`, `JobC`, `ItemStackC`, `DraftedC`, `BodyC`, `EvaFloatC`, `WeaponC` volley points). A test fails when a registered
  component has `x`/`y` keys but no entry.
- **Deploy modal.** On arrival the player's packet waits (`sector.state = 'deploying'`, the sim is paused by the modal). The UI
  shows ShipC bboxes and the chosen spot; the command `sector.deploy { x, y }` checks the gap rule and stamps. The debug spawns
  (`debug.spawnEnemy`, `debug.spawnGenerated`) use the same check.
- **Jumping.** `combat.flee` / `ship.jump` (FTL charged):
  1. Collect: the player region's tiles (owner = ship), every entity on them, crew aboard vehicles whose `dock` is one of its
     airlocks or whose `home` bay is stowed in it, and those vehicles.
  2. Lift into a packet; release the chunks that are now empty.
  3. Freeze the rest of the sector into a `SectorArchive`.
  4. Generate or restore the next sector and enter the deploy modal.
- **Left behind.**
  - Prizes, wrecks, derelicts, enemies, and **own crew or shuttles not aboard or docked** stay in the archive:
    `{ nodeId, tick, chunks, world subset }`, frozen and not simulated.
  - Returning to the galaxy node restores the archive.
  - Retention: keep archives that hold anything player-owned (prizes, stranded crew); drop the rest and regenerate them from
    the seed if revisited.
  - Jumping with own crew or vehicles away asks for confirmation (open question 2).
- **Save format.** `sector: { id, state, inCombat, lost?, grid: SectorGridData }` and `archives: SectorArchive[]`; `grids[]` is
  gone. **No migrations (user decision, 2026-10-19):** this is a prototype, so each step that changes the save format just
  bumps `SAVE_VERSION` and old saves are discarded.

### 5. Combat on one map

- **Projectiles.** Already sector-space with `dt = speed / distance`, so travel time is real distance. They launch from
  `turretPosition` (sector coordinates now) toward the aim point. `impacts` resolves the tile at the landing point:
  - The owner of that tile takes the hit: its shields, its integrity.
  - Space means a miss.
  - Today the target grid is assumed (open question 5).
- **Targets.** `Target { ship, moduleId, vehicle? }` replaces `gridId`. The commands `combat.setTarget { ship, weapon, target }`,
  `combat.setHold { ship }`, `combat.fireVolley { ship }`, `combat.flee { ship }` and `ship.scuttle { ship }` follow.
- **AI and spawning.** `enemyAi` and `boardingAi` pick ships by faction from `ShipC`. Spawns place packets with the gap rule.
- **Combat panel as a second camera.**
  - `createCamera` is instanced twice. The scene renders the world container twice per frame:
    - pass A is the main camera, full canvas;
    - pass B is the panel camera, centred and fitted on the target region and scissored to `CombatViewRect`.
  - A per-pass flag shows the target marks layer only in pass B. Culling is per camera (step 6).
  - `miniScene` and its duplicate sprites go away. On phones, pass B may refresh at half rate (open question 7).
- **Roofing and visibility.** Rules are per region, read from ShipC and owner:
  - A hostile region is roofed unless player crew stand in its frame (today's `boarded`), or it is a wreck.
  - Crew are drawn unless they stand on an **interior** tile (Floor, Door or module) of a roofed region. So suited crew on a
    hull, floating, or on the EVA ring are always drawn, as are crew of any faction outside a hull.
  - Roof livery, roof parts and cutaway mode stay per region.

### 6. Performance budget (phone target: mid-range Android, 60 fps render, 20 Hz sim)

| Item | Today | Sector grid | Bound |
|---|---|---|---|
| Tiles simulated per tick | Sum of grid areas (starter 30x20, raider 24x16) | Sum of padded frames (about 2,000–20,000 for 3–10 ships) | Frames only; active lists skip vacuum; settled regions sleep; prizes and wrecks run field systems every 4th tick |
| Atmosphere (`GAS_SUBSTEPS` × links) | Whole grid, every tick | Active tiles of awake regions | Under 2 ms per tick at 20k active tiles (to be measured in a bench test) |
| Rooms, `roomTiles`, `hullSum` | Whole grid on revision; `hullSum` every tick | Per frame, on the frame's struct or hp revision | `hullSum` gated on hp revision |
| Pathfinding A* | One grid | Bounded to the start region's padded frame (ships are never close, so there is no walk path between them) | Frame-bounded open set |
| Lighting, power | Per grid | Per region, on power, door and struct revisions | Revision-gated |
| Memory | Dense grids | About 8 KB per touched chunk; 1–2 MB per busy sector; archives base64 in the save | Archive retention rule |
| Render | All ships' sprites, plus a duplicate set for the panel | Chunk containers (16x16) culled per camera; tile views rebuilt per chunk on `chunkRevision` | Under 4,000 drawn sprites at default zoom on a phone; pass B culled to the target frame |
| Save size | Dense base64 per grid | Allocated chunks only | Under 1 MB typical |

### 7. Migration order

**Amended (user, 2026-10-19).** The single shared tile store is confirmed: mining is planned, and building in open space,
welding structures together and ships breaking apart may follow, which all need tiles of different structures on one grid.
Saves are not migrated (see Save format). **Visible work goes first** so the one-map feel lands early:
1. Step 0 (merges, including `shipgen` plus `trusses-int` via `genint`).
2. Then, in parallel: step 1 (`SectorGrid` core, new code only) and the render steps that don't need chunks: 5a (one world
   layer stack with `sectorPos` offsets), 5c (combat panel as camera pass B), 5d (picking in sector tiles), plus step 8
   (`BodyC` vehicles; vehicles already fly in sector space) and the visibility rule (crew outside a hull always drawn).
3. Then steps 2–4, 5b (chunk tile views), 6, 7, 9 and 10 as below.


Each step keeps `npm run check` green and the game playable, and each is its own PR. Steps 1–4 change no behaviour or visuals
and need no screenshots. Steps 5 and 9 are visual and need user screenshot approval.

| # | Step | Adapter that keeps the rest working | Size |
|---|---|---|---|
| 0 | Integrate pending branches (below) into the base | n/a | merge |
| 1 | `GridLike` interface; `SectorGrid` (chunks, empty values, serialize) and `GridWindow`, with unit tests | Systems still get `Grid`-shaped objects | M |
| 2 | Ships are stamped into one `SectorGrid`; `sim.grids` becomes a map of windows (exact template bbox, so local coordinates are unchanged); save v13 stores chunks | `GridWindow.raw()` dense copy | M |
| 3 | Field systems (`atmosphere`, `fire`, `temperature`, `smoke`, `lighting`, `doors`, `rooms`, `alerts`, `autojobs`, `shipState`) loop over regions through `load()` and `set()`, not `raw()`; active lists | Windows | M |
| 4 | `ship` owner layer, `shipAt`, `ShipC` padded frame, `regions(sim)`, gap rule in spawns | n/a | S |
| 5 | Render: one world layer stack; ShipScenes become region decorators adding sprites into shared sorted layers at sector offsets; chunk tile views; picking in sector tiles; the panel as camera pass B (`miniScene` deleted) | A render-side `sectorPos(gridId, x, y)` adds the ship origin until step 6 | L (split 5a layers, 5b chunks, 5c second camera, 5d picking) |
| 6 | **Coordinate flip:** stamping writes sector coordinates into every component, and every window becomes the identity (the whole sector), so `sim.grids.get(anyId)` still works. Test fixtures place their ship at (0, 0), so single-ship tests pass unchanged; multi-ship tests (eva, vehicles, capture, combat, portals) are updated | `gridId` remains as a dead tag | M (about 40 source sites: geometry `ship.x +` sums, spawn, impacts, render `sectorPos`) |
| 7 | Remove `gridId` component by component (Position, Module, Job, Item, Robot, Drafted, Projectile, Target, commands, events, snapshots); delete `sim.grids`, `GridWindow.raw`, cross-grid portals and `Path.then`; move `SuitC` and `AirlockC`; save v14 | none (cleanup) | L, mechanical; several PRs |
| 8 | `BodyC` for vehicles; `homeShip`, `hover: ship`; EVA float in sector space; air layer depth rule | n/a | M |
| 9 | Packets: `liftShip`, `stampShip`, translation table, `SectorArchive`; `sector.deploy` and the deploy modal; jump with docked vehicles | n/a | L (M6 work) |
| 10 | Performance: settled-region sleep, reduced cadence for wrecks, a bench test with a 10-ship sector | n/a | M |

**Progress.** Step 1 done (branch `sector-1`, new code only): `GridLike` in `grid.ts` (`Grid` implements it);
`SectorGrid` (`sectorGrid.ts`) and `GridWindow` (`gridWindow.ts`) with tests; `SHIP_FIELDS.ship` and `SHIP_EMPTY` in
`structure.ts`. Chunk revisions persist after a chunk is released, so a window's revision sum never goes backwards.
`SectorGrid.raw()` throws (use `chunkData`/`load`); `GridWindow.chunkRevision` sums the sector chunks under a local chunk.

**Merges before the refactor (answer to the user's hold).**
- Recommended: **merge `eva` to main once its look is approved, and integrate `shipgen` plus `trusses-int` before step 5.**
  Reasons:
  - `eva` is main plus 60 commits, and the refactor branches from it anyway. While `eva` is held, every refactor step lands
    on a branch that main cannot take without `eva`. Holding therefore recreates the flag day the plan avoids, as one giant
    merge of `eva`, the refactor and shipgen.
  - `shipgen` and `trusses-int` were cut from an old base: they lack the rogue faction and the M5 render (they show as
    deleting `shuttleView`, `airlockArt`, `scenePick` and more against `eva`). Their sim side is self-contained
    (`src/sim/shipgen/*`, `Struct.Beam`, `ShipC.gen`, `debug.spawnGenerated`) and its output (`ShipTemplate`) does not
    change. But their render changes (`gridView.ts`, `tiles.ts`, `scene.ts`, `shipScene.ts`, `roofPlating.ts`, `beamArt.ts`)
    hit exactly the files step 5 rewrites. Merging them after step 5 means redoing beam rendering on a new scene; merging
    them before costs one ordinary conflict pass now.
  - `weapons-int` is art only (sheets and Blender scripts; `main` is its ancestor). Merge it whenever approved. Its only
    conflict risk is `public/assets/manifest.json`, so merge it before anything else rebuilds sprites.
- If the user keeps the hold on `main`: make one long-lived `sector` integration branch = `eva` + `trusses-int` + `shipgen`
  + `weapons-int` at step 0, run the steps on it, and merge everything to main at the end. It is workable, but the final main
  merge is large and nothing reaches the phone build until then.
- Ask agents to stop feature pushes to `eva` once step 1 starts (fixes only), or rebase the refactor weekly.

### 8. Risks (open questions for the user are in `docs/STATUS.md`, "Sector grid decision")

- Step 6 (the coordinate flip) is the one wide change. It is safe only if step 5 has removed every render-side offset and the
  fixtures sit at the origin. Mitigation: a grep lint for `ship.x +` and `.gridId` in `sim/` after step 7.
- `raw()` callers in the renderer assume dense arrays. Chunk views must land (5b) before windows become the identity (6).
- Pixi sorting in one shared layer with many sprites costs more. Mitigation: chunk containers, plus `zIndex` only on dynamic
  objects (crew, bodies). Static tiles keep their insertion order per chunk.
- Determinism: chunk Map order is insertion-dependent, so systems must iterate regions (ShipC query order) or sorted chunks,
  never `Map` order. A test runs the same seed with and without a save round-trip.
- Long ranges make shuttle trips slow (5 tiles/s). Tuning, not architecture.
