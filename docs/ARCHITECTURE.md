# Architecture

The previous attempt (`bigbadloser/space-web-game`, **reference only, nothing is copied**) bloated
because systems called each other directly, game state lived in Svelte stores, things were built twice,
and polish came before gameplay. These rules exist to prevent that.

## Stack

- TypeScript (strict), Vite.
- **Three.js** for the game view.
- **Svelte 5** for the UI.
- **Vitest** for tests.
- ESLint with import-boundary rules.
- No ECS library, no schema library.

## Layout and dependency direction

```
src/
  sim/       pure game logic: ECS, grids, systems, commands, RNG, save format
  content/   game data as typed TS objects (weapons, species, modules, recipes, events…)
  render/    Three.js: scene, voxel kit, meshing, models, crew generator, overlays, effects
  ui/        Svelte components
  app/       wiring: boot, game loop, input, save/load, sim <-> render/ui bridge
```

- `sim` imports nothing from the other folders, and nothing from three, svelte or the DOM.
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
- It keeps its own caches (meshes, instances) and updates them from revision diffs.
- It never writes to the sim.

**Assets come from the pipeline (see Asset pipeline).** The renderer only loads `.glb` files
listed in `public/assets/manifest.json`. It never generates geometry for game content. The only
exceptions are debug and overlay visuals: selection frames, overlays, blueprints.

**Crew.**
- Assembled at runtime from glTF parts: a species body (skeleton plus base meshes) plus slot items
  attached to named bones.
- Which parts to use comes from sim components (species, role gear, implants, injuries, appearance
  seed).
- Animation clips are played with `AnimationMixer`.

**Visuals.**
- Lighting is driven by the sim's light and power fields; neon emissives follow powered state.
- Field overlays and the tile inspector read grid arrays directly.

**Quality tiers.**
- **High:** bloom and shadows. **Low:** neither.
- Chunked, frustum-culled meshes.

## Asset pipeline

Asset *creation* is decoupled from asset *rendering*. The contract between them is glTF files plus
naming conventions.

```
tools/blender/
  setup.sh      installs a pinned headless Blender (the container is ephemeral)
  lib/          shared Python: palette, style kit (faceted prisms, bevelled plating, grime vertex
                colours), rig and attachment helpers, export
  crew/         species body plans, slot items, animation clips
  tiles/        floor, wall, hull, door variants (16 voxels per tile scale)
  build.py      builds everything into public/assets/**.glb plus manifest.json
  preview.py    renders turntable PNGs for review
palette.json    the single palette, read by Blender scripts and the game
```

- **Run with `npm run assets`** (Blender headless). Generated `.glb` files and the manifest are
  **committed**, because Cloudflare's build doesn't run Blender.
- **Style:** chunky faceted (crew-lab style 2). Mechanical parts may use bevelled plating (style 3's
  idea) through a separate kit helper.
- **Conventions:**
  - Units are 1 world unit = 1 tile, Y up, origin at the footprint's floor centre.
  - Bones use fixed names (`root`, `hips`, `spine`, `head`, `arm.L/R`, `forearm.L/R`, `hand.L/R`,
    `leg.L/R`, `shin.L/R`, `foot.L/R`).
  - Attachment points are empties named `socket.<name>`.
  - Material names carry meaning: `emissive.*` glows, `team.*` gets a role or faction tint.
- **Crew parts are rigid meshes parented to bones**, not skinned. That keeps mix-and-match trivial and
  the faceted look crisp. Slime may later use shape keys.
- **Every asset has a manifest entry** with its id, file, kind, sockets, clips and footprint.
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
| M0 | **Skeleton** | Vite, TS, Svelte and Three are set up, with lint boundaries, Vitest, the ECS, the tick loop, the command queue, the seeded RNG and a save round-trip test. An empty scene renders. |
| M1 | **Grid & view** | A hard-coded test ship renders in voxels (16 per tile) with greedy meshing and instancing, an isometric camera, cutaway walls, pan and zoom, the tile inspector and a debug overlay. |
| M2 | **Crew & jobs** | Crew pathfind (doors included), take jobs with reservations, follow role priorities and the grid, can be drafted and have minimal needs. Placeholder low-poly crew. |
| A1 | **Asset pipeline: crew** | Blender setup, palette, style kit, the human body with slots (hair, eyes, arms, implants, role gear) and idle/walk/work/sleep clips, preview renders, runtime loader and crew assembler replacing the runtime-built crew. |
| A2 | **Asset pipeline: tiles** | Floor, wall, hull and door from the pipeline replace the runtime voxel kit, and the voxel kit is removed from `src/render`. |
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
