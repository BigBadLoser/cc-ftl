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

**Multi-grid.**
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
- **Derelict dressing (`derelict`, `sprites/derelict.py` and `derelict_walls.py`, not wired yet):** drawn
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
  livery shader (`src/render/livery.ts`); a ship's scheme is picked from its faction and name.
- **Camera:** orthographic, yaw 45 degrees, 30 degree elevation. One 1x1 tile renders as an exact
  64x32 diamond.
- **Look:** flat colour bands (about 1.0 / 0.75 / 0.5 for top, left and right faces), muted palette
  with shade ramps, a dark 1 px outline taken from the neighbouring colour, binary alpha, and neon
  only in the glow pass.
- **Crew:** about 60 px tall at 1x, 8 directions (no mirroring, since characters are asymmetric),
  clips at fixed frame counts (idle 4, walk 8, work 6, and more as needed).
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
