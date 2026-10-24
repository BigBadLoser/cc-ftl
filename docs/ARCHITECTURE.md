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

- `tools/shipgen` is a dev-only viewer for generated ship layouts (PNG contact sheets, ASCII, live page); nothing in
  `src/` imports it.
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
- Every layer is rendered in the same fixed frame and anchor (`tools/blender/sprites/crew_spec.py`), and has one sheet
  per clip (8 directions x that clip's frames), so the layers always line up and a new item or clip never
  touches existing sheets. A layer lacking a clip falls back to idle, or is hidden for the seated clips
  (`resolveClip` in `src/render/loadout.ts`).
- **Trimmed sheets** (`tools/blender/sprites/crew_trim.py`, run by `crew_pack.py`): a clip uses a small part of the frame, so
  each clip sheet is cropped to the union of its opaque pixels (image and glow, all directions and frames). The manifest
  clip records the cell size `cw`/`ch` and its offset `ox`/`oy` in the layer frame; the renderer cuts `cw x ch` cells and
  draws at `ox - anchor.x, oy - anchor.y` (`cellOf` in `assets/manifest.ts`). That is the whole contract: the layer's
  `frameW`/`frameH`/`anchor` and the muzzle offsets are unchanged, so no layer re-renders. At 2x it takes the human set from
  12.3 GiB decoded to 0.93 GiB. `python3 -m sprites.crew_trim [assets dir]` (from `tools/blender`) trims an existing output
  in place (idempotent); the review tools that stack crew cells re-pad with `crew_trim.full_cell`.
- Layers are rendered in Blender with the rest of the character as a **holdout**, so the hidden parts
  are already cut out. Layers then stack in a fixed order in every direction.
- Which layers to use comes from sim components (species, role gear, implants, injuries, appearance
  seed).
- Skin, hair and cloth colours use **palette swap**. `team.*` materials render as reserved key colours,
  which a shader remaps per crew member.
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

- **Fast tier** (`npm run check:fast`, before every commit): lint, typecheck, then `vitest run --changed`, which runs only the
  test files that import an uncommitted file, directly or transitively. A render or UI change runs its own tests in seconds.
  A `src/sim` change still selects most content tests, because they build a full game through `newGame` and so depend on every
  system. That is correct, not noise.
- **Slow tier** (`*.slow.test.ts`): soak tests over many seeds or long runs. The fast tier skips them; `npm run check` and CI
  always run them. Today: the shipgen seed and depth sweeps, the balance fights (`ships/balance`) and the end-to-end trade
  runs (`content/trade`, `ships/trade`). Name a test `.slow.test.ts` only when it is a soak or sweep whose failures a normal test would also hint
  at, never to hide a flaky test.
- **Full** (`npm run check`, before a PR is called finished, and in CI on every push): everything.
- Vitest runs files in parallel, so one huge file sets the wall time. Split sweeps across files rather than growing one.
- Test files never import other test files: an imported `*.test.ts` runs its tests again in the importer.

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

- **Loading and memory (`src/render/assets`, `artStream.ts`):** sheets are loaded on demand, never all at start (the 2x art is
  1452 sheets, ~13 GiB if decoded at once, which crashed headless Chromium; phones need a few hundred MiB).
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
    blank. Crew sheets are evicted by idle time (`CREW_IDLE_MS`) when the `crew` pool is over `CREW_BUDGET` (256 MiB
    decoded; a typical crew needs ~50 MiB trimmed). Lookups happen every frame, so nothing holds a crew texture for long.
  - Static art is different: built sprites (gridView, roofs, modules) keep their textures. `atlas.generation` counts env/core
    sheets arriving or leaving; `createArtStream` (`artStream.ts`) rebuilds the ship scenes when it changes (immediately once
    nothing is loading, else at most once a second) and keeps a scene hidden while the sheets of its first build load (at
    most 3 s). When the `env` pool is over `ENV_BUDGET` (384 MiB) it runs a mark and sweep every 8 s (backing off when
    everything is in use): rebuild the scenes (marks the sheets they use), then evict the env sheets nothing used since.
  - Evicted sheets are destroyed one frame later (`atlas.tick()` after drawing), and are restored without a reload if asked
    for again in that frame. Sub-textures and baked halos of an evicted sheet are destroyed with it.
  - Each sheet is uploaded to the GPU as soon as it loads and its decoded ImageBitmap closed, so it is not held twice. After
    a lost WebGL context (`webglcontextlost`) drawing pauses until every loaded sheet has been decoded and uploaded again.
  - Debug: `?hook` gives `__cc.art()` (resident decoded bytes per pool, requests, pending, rebuilds, biggest sheets);
    `?crewmb=N` and `?envmb=N` override the budgets in MiB.
  - Not done: GPU texture compression (KTX2/Basis), and splitting the big static env sheets (vehicle_bay, weapons, containers)
    by family, which would shave the ~245 MiB the starting ship's env sheets take.
- **Two art sets (`public/assets/1x/`, `public/assets/2x/`):** each has its own `manifest.json` and `sprites/`. Ids are the same
  in both; the 1x set may lack ids the 2x set has (never downsample 2x art to fill a gap: render it).
  - 1x is 64x32 pixel art that the game draws at half resolution, so each art pixel is a hard 2x2 block. The game's geometry
    (`iso.ts` `TILE_W`/`TILE_H`, `Z_PX`, every `ART_SCALE` literal) stays 128x64 in both modes.
  - `src/render/assets/compose.ts` turns the chosen set into the one manifest the renderer sees, in world px: a 1x set's frames,
    anchors, clip cells (`cw`/`ch`/`ox`/`oy`), muzzles and `heights.zPx` are multiplied by 2 and its sheets get texture
    `resolution` 0.5 (loaded nearest, never smoothed). So nothing downstream knows the set. Exceptions work in art px and
    convert through `texture.source.resolution`: alpha picking (`partPick.ts`, `alphaMask.ts`) and CSS item icons
    (`itemIcons.ts`). The crew filter's zoom is camera scale times the layer's `px` (2 for 1x; `palette.ts` `artZoom`).
  - Per-id fallback: in 1x mode an id the 1x manifest lacks loads from the 2x set at native scale (sheet names prefixed `2x:`).
    One console line reports how many; `__cc.art().fallbacks` (with `?hook`) lists them.
  - Choice: `?art=1x|2x` (remembered), else the remembered value in localStorage `cc.artScale`, else 1x. The debug panel has a
    switch. Switching reloads the page (`artSet.ts` `setArtScale`): sheet stores, built sprites and filters all hold one set's
    textures. Pool budgets are a quarter at 1x (`budgetsFor`).
  - Tests: `sheets.contract.test.ts` (per-set manifests, same ids), `compose.test.ts` (scaling, fallback, set choice, budgets),
    `partPick.test.ts` (1x picking), `palette.test.ts` (crew filter at 1x).
- **Render scale (pipeline contract with the cloud renderer):**
- `tools/blender/sprites/scale.py` reads `ART_SCALE` (`1` = 64x32, `2` = 128x64, default 2). `build_sprites.py ... --scale 1|2`
  sets the same variable (give it after the `--` that ends Blender's own arguments).
- Output goes to `public/assets/<ART_SCALE>x/`; `scale.assets_dir()` returns that path (cloud tooling should import it).
  `build_sprites.py` refuses an outdir whose `manifest.json` has the other tile size.
- The manifest `tile` is `{w: 64*ART_SCALE, h: 32*ART_SCALE}`; `heights.zPx` scales the same way.
- Cache keys include the scale: env families hash `TILE_W/TILE_H`, crew hashes `FRAME_W/FRAME_H` (both derive from
  `ART_SCALE`), and the sol/damage_sol scratch dir defaults to `sol-pack-<scale>x` (cloud sets `SOL_DIR` with its own scale
  signature). `--cache-only` works at both scales (it is a crew flag and does not look at the scale).
- **Rendering the missing 1x art:**
   (from the repo root, on branch `art/dual-scale`)

  Direct, one Blender process (add `-t N` for threads; the render caches under `.cache/sprites/` are keyed by scale):

  ```bash
  export ART_SCALE=1
  BL="$HOME/tools/blender-4.2.9-linux-x64/blender -b -t 4 --factory-startup --python-exit-code 1 --python tools/blender/sprites/build_sprites.py --"
  # the missing non-crew families (merged into public/assets/1x/manifest.json; other families are kept)
  $BL public/assets/1x battery,clutter,containers,corpse,cryo,damage,damage_sol,decay,fx_mining,hazards,hydroponics,medbay,mining_pod,ops_consoles,pod_bay,rock,rockwall,storage_set,wallprops,workbench --scale 1
  # plus the crew (incremental: re-run after an interruption and finished frames are skipped; --plan reports hits/misses)
  $BL public/assets/1x crew --scale 1
  # parallel crew workers: one clip each, cache only (no packing), then pack once
  $BL /tmp/crew-scratch crew --clip walk --cache-only --scale 1     # repeat per clip in crew_spec.CLIPS
  $BL public/assets/1x crew --scale 1
  python3 tools/blender/sprites/crew_check.py public/assets/1x      # sanity composite (optional)
  ```

  Through the cloud orchestrator (needs the matching change in `blender-cloud-render` that sets `OUT` to
  `public/assets/<scale>x`; `ART_SCALE` is already exported to every Blender process by `cloud_render.py run --scale 1`):

  ```bash
  python3 tools/cloud_render.py run --workers 4 --threads 2 --scale 1
  ```

  Then fetch `public/assets/1x/` (`remote.sh ... fetch`), commit the sheets, JSON and manifest, and check with
  `npm test -- src/render/assets` (manifest contract tests run on both sets) and `?art=1x&hook`.
- **Run with `npm run sprites`** (Blender headless; `-- ... --scale 1|2` or `ART_SCALE`, default 2, writes `public/assets/<scale>x/`). Generated sheets, JSON and the manifest are
  **committed**, because Cloudflare's build doesn't run Blender.
- **Families:** the art is split into families that each render into their own sheets and are merged
  into the manifest (their old sheets and ids are replaced, everything else is kept), so one family can
  be rebuilt alone: `npm run sprites -- public/assets walls,consoles`. Families: `crew`, `robots` (robot
  crew, see below), `aliens`, `robot_bay`, `env` (props,
  economy modules, items, the particle sprites), `walls` (floors, walls, hull, doors), `consoles`, `weapons` (turrets and
  bays), `roof` (plating, edges, livery masks), `struct` (structural beams), `fx` (combat fx v2, see
  below), `structure` (faction tile looks, see below), `galley`
  (the food pack, see below), `derelict` and `eggsac` (derelict dressing, see below) and `sol` (the engine, AI core and shield packs, rendered by their own scripts in
  `tools/blender/experiments/` and packed by `sprites/sol_pack.py`).
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
  livery shader (`src/render/livery.ts`); a ship's scheme is picked from its faction and name.
- **Camera:** orthographic, yaw 45 degrees, 30 degree elevation. One 1x1 tile renders as an exact
  64x32 diamond.
- **Look:** flat colour bands (about 1.0 / 0.75 / 0.5 for top, left and right faces), muted palette
  with shade ramps, a dark 1 px outline taken from the neighbouring colour, binary alpha, and neon
  only in the glow pass.
- **Crew:** about 60 px tall at 1x, 8 directions (no mirroring, since characters are asymmetric),
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
- **Aliens** (`sprites/alien.py`, `alien_render.py`, family `aliens`; wired on branch `aliens`): the derelict infestation, built
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
    - `ion_disabled` 4 (loop, drawn at roof height over a module ion has disabled), `shield_hit` 6 (at the point a shot
      meets the bubble), `shield_edge` 4 (loop: a rim piece to lay round the bubble's ellipse, turned to its tangent,
      replacing the drawn ellipse).
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

## UI

- Svelte components read **snapshots** published by `app` after each tick, or on demand for
  inspectors. They never hold references into sim internals.
- Every action dispatches a command.
- UI-only state (open drawers, selected tab) lives in `ui/` and never touches the sim.

## UI kit, `src/ui/kit/`

Small in-house controls for panels, built on [Bits UI](https://bits-ui.com) (headless, Svelte 5: it supplies keyboard, focus and
ARIA behaviour and no styling). The game keeps its own look: every kit component is styled here with the tokens in
`src/ui/theme.css` (sharp dark panels, the global `button.on` state, 40px touch targets, `--focus` ring), not by a styled library.

- Components: `Select`, `NumberStepper`, `Segmented`, `Chips`, `Tooltip`, `Dialog`, `Slider`, exported from `src/ui/kit/index.ts`.
  Props are plain values plus an `onChange` callback (controlled); options are `KitOption` (`value`, `label`, `sub`, `disabled`, `testId`).
- **Rule: panels import from `ui/kit` only, never `bits-ui`.** ESLint (`no-restricted-imports`) allows `bits-ui` only under
  `src/ui/kit`, so the library can be swapped by editing the kit alone. Panels still never mutate the sim; a kit control only reports a
  value and the panel dispatches the command.
- Adding one: create `src/ui/kit/<Name>.svelte` wrapping the Bits primitive (or plain Svelte if there is no fit), style it with theme tokens
  (add a token to `theme.css` rather than a literal), keep it working at 390px wide with a visible focus ring, put pure logic in a
  `<name>.ts` with a `*.test.ts` beside it, and export it from `index.ts`.
- Portalled parts (Select list, Tooltip, Dialog) render under `body`, so their styles are `:global` and namespaced `kit-*`.

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
- `triggers[]`: `transit` (weight; the only drawn pool: drawn at a hop of a hyperspace trip, see "Story events in transit" below; nothing is drawn
  while the ship idles in a node), `flag` (`flag`, `atLeast`, `delaySec`: queued when the flag first reaches the level), `chain` (only reached by a
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

**Delivery (who flies, decided and documented).** `planCourier` picks:
1. Goods the **player hands over** always go on the **player's shuttle** (it flies itself, no pilot or crew needed: `Vehicle.autopilot` lifts the pilot rules for the run only; it needs an empty hold and a free working
   airlock on the player's ship).
2. Goods **from the trader** come on the **trader's own shuttle** if its kind has `shuttle: true` (a real `VehicleC` spawned at its ship,
   no crew, `home: 0`, despawned when it is back); otherwise the **player's shuttle goes over** to fetch them.
3. Stations are ships (an immobile `ShipC`, see "Stations" below). Station kinds have no shuttle, so the player's shuttle flies every
   station run, and it **docks** (`trade/stationDock.ts`) instead of hovering: `out` -> `dockStation` (dock at a free working station
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
`TradeList.svelte` (ships in range, Hail) and `TradeWindow.svelte` (two columns, quantities, totals, barter box, offer/accept; a bottom
sheet with You/Them tabs on phones), a Hail button in `CombatPanel`, a credits chip in `StatsChips`, trade status in `ShuttlePanel`, trade
alerts in `alerts.ts`.

**Adding a trader:** add a `TraderDef` to `trade.traders` in `src/content/trade.ts` with a `match` (a `faction` and `role` to catch a
generated ship kind, or a `side`); the content test checks that its stock items exist and are priced. **Adding a price:** set `price` on
the `ItemDef` (the content test fails for an unpriced item); tilt it per trader with `tagMods` or per faction with `sell`/`buy`.
**A new faction:** add a `TradeFactionDef` keyed by its faction id. When the real faction system arrives, replace `tradeFactionOf`,
`profileFor` and the `relation + reputation` rule in `trade/traders.ts`; everything else reads those.

## Asteroids (slices 1-3 on branch `asteroids`), `src/sim/asteroids/`, `mining/`, `rock/`, `outposts/`

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

Sim only so far (branch `galaxy`): no UI, no snapshot, no tools. The starmap view, its zoom levels and the dev tools live on the
unmerged `starmap-macro-wip` (PR #16) and are described under "Zoom levels" as the target.

**Terms (user decisions).**
- **Node:** one playable location (one sector grid; older text says "sector" for it).
- **Sector:** a group of nodes (a blob of 6 to 12) around a **central body**.
- **Cluster:** a named group of sectors with one owner (2026-10-22: "cluster", not "region", because "region" is the sector-grid ship
  region of `sim/regions.ts`). Code, ids (`g.<rx>.<ry>`), tuning (`CLUSTER_*`) and strings say cluster.
- **Galaxy:** all clusters. Nodes inside a sector are joined by **routes**, sectors by **hyperlanes**, clusters by **gates** (a hyperlane
  that crosses a cluster border) and, across voids, **rift lanes**.

**Model** (`types.ts`). Generated data is immutable and a pure function of (seed, galaxy content, chunk): `ChunkData { sectors, nodes, edges }`.
- `SectorData`: site, radius, padded hull, name, faction, danger, its `cluster` / `clusterName` / `clusterType`, `hub`, layout style and
  central `body`.
- `NodeData`: position, danger, territory faction, `structures: {def, owner}[]` descriptors, `resources`, `contacts` present at generation.
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
   space), asteroid fields and old derelicts by per-node chance, contacts at `CONTACT_PER_DANGER x danger`; the start node has a trade station.
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

**Encounters and event grids** (`encounterOdds.ts`, `respond.ts`, `eventGrid.ts`). `galaxy.respond { encounter, choice }` is the one answer (`respond`; the stub
`galaxy.dismissEncounter` is gone). Interdiction: `evade` (roll `unit(seed, encounter id, salt)` against `evadeOdds`: mainly the pilot, `(0.32 + 0.57 x pilot) x (0.6 + 0.4 x engine) - 0.06 x fleet strength`, clamped to [0.05, 0.9], from `Combat.pilot` / `Combat.evasion` read from
the packet; formula and examples in `tuning.ts`; failure fights), `bribe` (`bribeCost`: 12 x strength x (1 + 0.4 x danger) x a standing factor, at least 10 credits; refused as
`cantAfford`; starts the fleet's cooldown) or `fight`. Fleet strength is the sum over its ships of 1 + 0.5 x depth. Distress: `respond` (an event grid with the damaged ships as
neutrals; leaving it earns reputation and the fleet moves on) or `ignore`. Hail and scan: `acknowledge`; a non-hostile crossing only makes one with chance `PASSING_ENCOUNTER_CHANCE` (`passingMeets`). The interdiction is answered in `ui/InterdictModal.svelte` (a modal over the map); the other kinds stay in the drawer. `incomingFleets(sim)` (`incoming.ts`) is the pure query behind the arrival-warning alerts (`alerts.syncIncoming`). Success lets the held trip go on (`resumeAfterHop`).
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

**Factions and standings** (`standing.ts`, `src/content/galaxy.ts`). There is one faction table: the galaxy faction defs. Each names the
generator styles of its ships, combat side, territory, stations, traffic, `baseStanding`, `relations` and a **reputation key** (`reputation`),
one of trade's keys: `traders`, `corp`, `navy`, `pirates`, `drones` (the three corporations share `corp`). Reputation stays in `sim.story.reputation`,
the only store; trade's `reputationWith` and `hailVerdict` are the source of truth for prices and hailing and the galaxy only reads the same
numbers: `standing = baseStanding + reputation[own key] + STANDING_SPILLOVER (0.25) x sum(relation x reputation[their key])`, tiers hostile below
`HOSTILE_BELOW` (-2), friendly from `FRIENDLY_AT` (3), `alwaysHostile` overrides. `story.context.faction` is the territory owner's reputation key
(so event `factions: ['corp']` matches any corporation's space).

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

**Debug commands:** `debug.galaxyReveal {radius}`, `debug.galaxyTeleport {node}`, `debug.chargeFtl`.

**Tests:** `galaxy/generator.test.ts` (determinism, order independence, seams, costs, start), `generator.slow.test.ts` (7x7 spacing and hull overlap, 9x9
connectivity), `route.test.ts`, `content/galaxy.test.ts` (content, standings, travel, arrivals, save, generator version, deploying).
**`newGame` cost with the galaxy: about 350 to 450 ms** (measured 2026-10-22 at `FRONTIER_RING` 2: 25 chunks; at 1 (now): 9 chunks, 270 to 450 ms), mostly generation.

**Tuning** (`galaxy/tuning.ts`): denser galaxy: `SITE_SPACING`, `SITE_CELL`; bigger sectors: `SECTOR_RADIUS`; busier sectors: `NODES_PER_SECTOR`, `NODE_SPACING`;
more loops: `ROUTE_EXTRA`, `LOOP_CHANCE`; cluster size and spacing: `CLUSTER_SPACING`, `CLUSTER_REACH`, `MIN_CLUSTER_SECTORS`; how closed the borders are:
`GATE_*`, `NO_GATE`; faster danger ramp: `DANGER_STEP`; bigger faction blobs: `TERRITORY_CELL`, `TERRITORY_SCALE`; jump prices: `*_UNITS_PER_FUEL`,
`ROUTE_CHARGE`; pressure while staying: `ARRIVAL_*`.

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
| `render/gridView.ts` (231) | Rebuilds a whole grid's tile sprites on any `struct` revision (5b: per chunk) | M–L |
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

- **Packets** (built in 9a, `sim/sector/packet.ts`). `ShipPacket` is the single format for a ship in transit:
  `{ ship, w, h, tiles: Record<field, number[]> (local, row-major), entities: { id, c }[] (local coordinates), template? }`.
  - `packetFromTemplate(template)` covers templates and shipgen.
  - `liftShip(sim, ship)` makes a packet from a live region.
  - `stampShip(sim, template | packet, { x, y, faction?, state? }) → shipId` writes the tiles (`set`, owner = ship id) and creates
    (template) or restores (lifted packet, `World.restore`) the entities, translated by `at`.
  - `spawnShip` is `stampShip(template)` plus combat, boarding and the crew roll.
  - `liftShip(sim, ship, { withDocked })`: `withDocked` is `false` (default: non-player vehicles docked at its airlocks are cut
    loose and undock where they are), `true`, or the list of those vehicle ids to take (the jump confirm's choice). The player's own
    stowed and docked vehicles always come; clamped containers are modules on its tiles and come too.
- **Entity ids survive.** World ids are never reused, so lifted entities keep their ids and references between them (vehicle
  home, job target, suit airlock) stay valid. References that leave (a weapon target on a ship left behind) dangle harmlessly,
  because `world.get` returns undefined and is checked today. The jump also clears them explicitly (`sector/refs.ts`: ship and
  weapon targets, attack orders, job and bed reservations, assignments), on both sides of the cut. A stranded shuttle keeps its
  `homeShip`, which is valid again once the player returns. Packets and archives therefore need no id remapping.
- **Translation table** (`sim/sector/translate.ts`): one entry per component, the coordinate shift or `null` (Position, Path,
  Module, Job, ItemStack, Drafted, Body, EvaFloat, Ship, Projectile, Eat, Fighter goal, EggSac, Nest, Alien home, Marker). A test
  fails when a declared component (`componentNames()`) has no entry.
- **Deploy modal** (sim side built in 9a; the modal is 9b). On arrival the player's packet waits (`sector.state = 'deploying'`,
  `sector.packet`; the sim is paused by the modal). The UI
  shows ShipC bboxes and the chosen spot; the command `sector.deploy { x, y }` checks the gap rule and stamps. The debug spawns
  (`debug.spawnEnemy`, `debug.spawnGenerated`) use the same check.
- **Jumping.** `galaxy.jump { ship, route, withDocked? }` (it replaced `sector.jump`; edge, FTL charge and fuel paid, refused while deploying or while a trade deal
  is live; hails and offers are dropped; `jumpWarnings(sim, ship)` lists crew and shuttles away and hostile docked vehicles for
  the confirm):
  1. Collect: the player region's tiles (owner = ship), every entity on them, crew aboard vehicles whose `dock` is one of its
     airlocks or whose `home` bay is stowed in it, and those vehicles.
  2. Lift into a packet; release the chunks that are now empty.
  3. Freeze the rest of the sector into a `SectorArchive`.
  4. Restore the next node's archive if it has one (else it is empty) and enter the deploy modal. At `sector.deploy`, a node entered for the first time
     gets its generated contacts as ships (`galaxy/deploy.ts`).
- **Left behind.**
  - Prizes, wrecks, derelicts, enemies, and **own crew or shuttles not aboard or docked** stay in the archive:
    `{ nodeId, tick, chunks, world subset }`, frozen and not simulated.
  - Returning to the galaxy node restores the archive.
  - Retention (user decision, 2026-10-21): **keep every archive**; no pruning rule for now. Shots in flight are dropped when a
    sector is archived.
  - Jumping with own crew or vehicles away is allowed after the player confirms; they stay in the archive (user, 2026-10-21).
- **Save format.** `sector: { node, state, packet?, width, height, inCombat, lost?, grid: SectorGridData }` and
  `archives: SectorArchive[]` (save v25); `grids[]` is gone. **No migrations (user decision, 2026-10-19):** this is a prototype, so each step that changes the save format just
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
| 9 | Packets: `liftShip`, `stampShip`, translation table, `SectorArchive`; `sector.deploy` and the deploy modal; jump with docked vehicles | n/a | L (M6 work; **9a** sim done on `sector-9`, save v25; **9b** UI: jump confirm, deploy modal, starmap hook) |
| 10 | Performance: settled-region sleep, reduced cadence for wrecks, a bench test with a 10-ship sector | n/a | M |

**Progress.** Step 1 done (branch `sector-1`, new code only): `GridLike` in `grid.ts` (`Grid` implements it);
`SectorGrid` (`sectorGrid.ts`) and `GridWindow` (`gridWindow.ts`) with tests; `SHIP_FIELDS.ship` and `SHIP_EMPTY` in
`structure.ts`. Chunk revisions persist after a chunk is released, so a window's revision sum never goes backwards.
`SectorGrid.raw()` throws (use `chunkData`/`load`); `GridWindow.chunkRevision` sums the sector chunks under a local chunk.
Step 2 done (branch `sector-2`): `sim.sector.grid` is the one `SectorGrid`; `sim.grids` is a `GridMap` (`gridMap.ts`) of
`GridWindow`s. `GridMap.stamp(id, dense, x, y)` copies a dense grid in (spawnShip stamps at the ShipC position, overlap is
refused); `sim.grids.set(id, dense)` stamps at the next free spot on row y = 0, so fixtures that build a grid and set it keep
working. As a type `Grid` now means `GridLike` (the dense class is `DenseGrid`, `Grid` stays its value alias), so render and
app compile unchanged. Save v13: `sector.grid` (chunks) plus `grids: {id, x, y, w, h}[]`; `migrate` refuses any other
version. Chunks are not released yet (occupancy off): a chunk with no structure left can still hold module or item ids,
and nothing lifts ships until step 9. `content/ships/sectorEquiv.test.ts` pins state hashes recorded on the pre-refactor
code (combat run, fire plus breach run) and checks a save round trip midway gives the identical state.
Step 3 done (branch `sector-2`): `GridLike.load(field, rect?)` (dense grid, sector and window; a window rect may reach past
the window). `regions(sim)` (`regions.ts`) lists the grids in ascending id, the fixed order every field system loops in.
`atmosphere`, `temperature`, `smoke`, `fire`, `rooms`, `lighting`, `doors`, `alerts`, `autojobs`, `modules` (life support),
`roomTiles` and `hullSum` read through `load()`/`get()` and write with `set()`; none of them calls `raw()`. `fieldFrame(grid)`
(`diffusion.ts`) caches the struct snapshot and the **active tile list** (non-Space tiles plus their 4-adjacent Space) on the
struct revision; diffusion links and the delta pass run over it in ascending order, so results are bit-identical to the full
sweep (`diffusion.test.ts` checks this against a copy of the old sweep). Flat passes that must see every tile (zeroing gas
on Space, write-back, fire and door scans) still read the whole loaded rectangle: a vacuum tile costs one array read there,
never a link. `hullSum` is cached on the hp and struct revisions. Still on `raw()`: `crew/pathfind.ts`, `eva/route.ts` and
the renderer (step 5b / 7).
Step 4 done (branch `sector-2`): `spawnShip` writes the new ShipC id into the `ship` layer of every non-Space tile it
stamped (`stampOwner`). `writeStruct` and `damageStruct` call `syncOwner`: a tile turned to Space loses its owner, a new
structure tile with none takes its first owned 4-neighbour's (E, W, S, N), so build jobs extend their ship. In `regions.ts`:
`shipAt(sim, x, y)` (sector tiles), `shipFrame(ship)` (bbox plus `REGION_PAD` = 2), `regions(sim)` now gives each grid's
ship id, sector bbox and padded frame, and `placementGapError(sim, bbox)` ('overlap' / 'tooClose' under `MIN_SHIP_GAP` = 12
between padded frames). `debug.spawnEnemy` rejects with that reason and `spawnShip` throws on it, so `newGame` and every
spawn obey the rule. The frame is derived, not stored on ShipC (the pad is a constant), so components and saves are
unchanged. Field systems still run over the exact bbox: widening them to the padded frame changes results (vacuum tiles
join the sweep) and belongs with step 6. Fixture grids set straight into `sim.grids` have no ShipC and owner 0.
Step 6 fixture prep (branch `sector-8`): the multi-ship fixtures that build their own grids (`eva.test.ts`,
`shuttleEva.test.ts`) stamp each grid at its ShipC position with `sim.grids.stamp`; the content fixtures (vehicles, capture,
combat, sector) already go through `spawnShip`. `windowShipMismatches(sim)` (`regions.ts`) lists every ship whose window
origin or size disagrees with its ShipC; those fixtures and the `sectorEquiv` combat run assert it is empty. A temporary
check in `Sim.step` over the whole suite found only the two EVA fixtures. The portals fixtures keep the row-0 auto placement:
they have no ShipC, so nothing can disagree, and they go in step 7. No recorded hash changed.
Step 8 done (branch `sector-8`):
- `BodyC { x, y, heading, alt }` (`sim/body.ts`) holds vehicle position, heading and altitude. `VehicleC` lost `x`, `y`,
  `heading` and `homeGrid`; it has `homeShip` (the ShipC entity id), `dest: { type: 'hover', ship }` and `hover` (ship id).
- `vehicle.hover { vehicle, ship }` takes a ship id. The UI's hover targets carry both the grid (key and test id) and the ship.
- The vehicle system pins a stowed body to `bayCenter` at `ALT.stowed` and a docked one to `dockPoint` at `ALT.docked` every
  tick. Undock frees the body where it is. Flying bodies sit at `ALT.cruise`, above `ALT.roof`.
- Altitude switches with the state and does not ramp. The lift out of the bay and the dock slide are render timing, and a sim
  ramp would move the layer switch off the art's frames.
- `spawnVehicle` runs before its ship's ShipC exists (template modules spawn first). `spawnShip` then fills in `homeShip`.
- `EvaFloatC.sx/sy` is the hatch point in sector tiles. `eva.out` and `eva.board` compute the drift in sector space from the
  body, and the crew's `Position` stays on the hull tile with no grid change. `crewView` converts the hatch point to the
  grid's frame (a render-side offset until step 6).
- Render: `shuttleView` reads `BodyC`. Its host gets a `ShuttleRef { state, dock, homeGrid }`, so `scene.ts` is unchanged.
  The layer is now chosen by altitude: an airborne body (`isAirborne`) goes in the air layer (the sector layer, above every
  ship), and a low one in its dock airlock's ship layer by depth. Undocking keeps the ship layer through the retract and slide.
  TODO (step 5): a low body that is not docked still falls back to the air layer, because the host knows only dock slots.
  The pixel lift still comes from `CRUISE_Z`, `DOCK_Z` and `PIT_Z`, not from `alt`.
- `dockSequence.ts` and `vehicleBayArt.ts` read no positions (timing, and the bay's stowed state), so they needed no change.
- `gridId` fields kept for unflipped code:
  - `VehicleView.homeGrid` / `hoveringGrid` (`shuttleSnapshot` keys on the player grid).
  - `ShuttleRef.homeGrid` (`scene.ts` keeps one scene per grid).
  - `DockPoint.gridId`, and `boardingTile` / `cargoTile` results (crew `Position` is still grid-local).
  - Every vehicle event (`vehicle.launched/docked/undocked`, `crew.disembarked`).
  - `UiShuttles.targets[].gridId`.
- Save v14. `sectorEquiv` folds `BodyC` back into the old `vehicle` shape before hashing, and both pre-refactor hashes still
  match, so sim behaviour is unchanged.
Step 5a, 5c, 5d, the §5 visibility rule and the step 8 depth TODO done (branch `sector-5`; 5b still to do):
- **One world stack** (`render/worldLayers.ts`): `createWorldStack()` holds shared layers (under, floor, decal, a depth
  layer, fx, fxAdd, halo, ui, marks); `stack.region(halos)` gives each ShipScene a `Layers` whose containers sit inside them
  at the region's sector offset (`setOrigin(ax, ay, depth)`). The depth layer is a Pixi `RenderLayer` sorted by
  `zIndex + depth base of the child's parent` (a stable sort, ties keep add order), so the sorted sprites of every region and
  of the sector-frame `low` container (low bodies) interleave. Views are unchanged: they still write region-local positions
  and depth keys.
- **Sector frame.** The art origin is sector tile (0, 0). `render/sectorPos.ts` (`regionOrigin`, `sectorPos`, `sectorArt`)
  adds the ShipC origin until step 6, when it becomes the identity. Camera framing, focus, `fightFx`, `crewMarks`,
  `sectorFx` and shuttles use it; the "camera ship's frame" (`ref`) is gone from the fx hosts.
- **Pass B** (`render/combatPass.ts`): a second `createCamera` (new `setExactScale` for the quarter steps under 1), centred
  and fitted on the target region, renders the stage into a `RenderTexture` the size of `CombatViewRect` (the texture is the
  scissor: a GL scissor would also clip filter passes). The main pass draws that texture in place. `place(cam, target)`
  positions the stack per pass, culls regions by their padded art box, and shows target marks only in pass B and UI layers
  only in pass A. `miniScene` is deleted; the panel now shows the region's real livery, cutaway mode and the projectiles and
  shuttles over it.
- **Picking** (`scenePick.ts`): one sector tile under the point, answered by the region that owns it (regions never share
  tiles); crew by the feet nearest the viewer across regions; the panel through camera B. Renderer API unchanged.
- **Visibility** (`render/regionRules.ts`): `wantsRoof` (hostile, not a wreck, no player crew on the grid) and
  `crewHidden(grid, roofed, x, y)`: crew are drawn unless on a Floor, Door or module tile of a roofed region. Status marks
  follow the same rule.
- **Vehicle depth** (`shuttleView.ts`): airborne bodies in the air layer; low bodies (docked, undocking, lifting out of the
  bay until cruise, settling in) in the shared world layer. Docked keeps today's centre depth: with a front-corner key a body
  along a far (west, north) hull passes the hull walls in front of it. In a pit the key is the footprint's front-most point
  (`frontDepth`, half extents 2.4 x 1.0) + 0.5. The pixel lift still comes from `CRUISE_Z` / `DOCK_Z` / `PIT_Z`: `alt` switches
  with the state and does not ramp.
- Culling is per camera at region level (cheap). Per-chunk culling is not built (see 5b).

Step 5b done (branch `sector-5b`): chunk tile views.
- `render/regionTiles.ts`: `regionTiles(grid)` reads a region's tiles straight from the `SectorGrid` chunks (`chunkData`,
  `chunkRevision`) under its window rectangle, in local coordinates (`kindAt`, `get`, a row-major `scan` over allocated
  chunks, `chunks(pad)`, `chunkRect`, `rev(field, chunk, ring)` = sum of chunk revisions over the (2 ring + 1)² block;
  chunk revisions only grow, so the sum is a change detector), and `key(field, chunk, margin)`: the chunk's own revision
  plus a hash of the `margin`-tile strip around it, so an edit deep inside a chunk rebuilds that chunk alone and one near
  an edge also rebuilds the neighbours it reaches. A plain dense grid (fixtures) is wrapped at (0, 0). `createChunkViews`
  keeps one view per sector chunk, rebuilding a chunk only when its key changes. Each view first gates on the region's
  window revisions, so a frame with no change does no per-chunk work.
- Per-chunk views: `gridView` (floors, walls, hull, doors, beams, ghost verts; key = cutaway mode, ghosts, beam look,
  `struct` with a 2-tile margin, and the engine / airlock hull tiles within 2 tiles; one chunk ring past the region for
  the ghost verts at its -x / -y edges; doors per chunk on `door`, tints per chunk on `light` (1-tile margin), `o2`, `hp`),
  `roofView` (plating; key = `struct` with a 2-tile margin, the chunk's `module`, and its share of the region-wide livery
  plan, which is recomputed on the region's struct revision; fire tint per chunk) and `damageView` (one crack `Graphics`
  per chunk, `struct` with a 1-tile margin).
  Each chunk's floor plates live in their own container in the floor layer, so plate order is stable across rebuilds;
  walls, roofs and the rest stay direct children of the region's sorted container (they sort against crew and other
  regions in the depth layer). `ghostVertsIn` gives a chunk its exact share of the ghost verts.
- No more `raw()` in the per-tile layers: `overlay`, `fxView` (flames) and `fx/atmosphere` scan chunks; `itemView` and
  `turretView` read light with `get`. Still on `raw('light')` (point reads, left to avoid clashing with the halo work):
  `moduleView` and the crew light host in `shipScene`; `app/moduleSnapshot` reads `room` / `o2` by `raw`.
- Not built: per-chunk culling (regions are culled per camera; chunk floor containers would allow it for the floor, but
  sorted sprites cannot sit in chunk containers without leaving the shared depth layer).
- Measured (headless Chromium, swiftshader; JS time of the frame after a one-tile struct write, median): starter 11.4–12 ms
  on main, 5.8–6.4 ms on 5b; with 4x CPU throttle at phone size 49–52 ms vs 23–25 ms. Steady frames unchanged (2.1–2.3 vs
  2.3–2.4 ms desktop, 8.8–10 vs 9.2–10.1 ms phone). What remains of a rebuild is mostly Pixi (render-layer detach on
  destroy, the depth sort, collecting renderables).
- Fixed on the way: a roof rebuild no longer deletes the roof parts (on main, any struct change on a ship removed its
  AI-core / shield-generator roof part until a power state changed).

Step 6 done (branch `sector-6`): the coordinate flip.
- Every component position is a sector tile: `Position` (and `toX/toY`), `Path` steps, `ModuleC`, `JobC`, `ItemStackC`, job
  and drafted targets, and the events that carry tiles (`fire.started`, `projectile.hit/miss`). `spawnTemplateModules`
  translates the ship-local template by the grid's top-left, so spawning stamps sector coordinates.
- Windows are the identity: `GridWindow.get/set(x, y)` read sector tile (x, y); the window keeps only its rectangle as
  bounds (`inBounds`, the edge checks of `isEvaWalkable`, `bordersSpace`, `network`), so behaviour at a ship's edge is
  unchanged. `sim.grids.get(id)` still works for any id. `GridLike` gained `x0, y0` (the bounds' top-left; 0 for a dense
  grid). Decided here rather than the plan's "whole sector" window: an unbounded window would change edge behaviour.
- `load()` defaults to the window rectangle and returns it row-major from (x0, y0); field systems keep their index math and
  add (x0, y0) where they turn an index into a tile (`writeBack`, fire, rooms, lighting, doors, alerts, autojobs, life
  support). `roomTiles` indices count from (x0, y0). A* runs on window indices, so tie-breaking is unchanged.
- Geometry sums are gone: `moduleCenter`, `dockPoint`, `bayCenter`, impacts, `tileFrame` / `tileCentre`, the crew floor scan
  and `nearestExterior`. Lint (`no-restricted-syntax` in `src/sim`, outside `gridWindow`, `gridMap` and shipgen) rejects
  `ship.x + m.x`-style sums and `ox` / `oy` sums. Bbox centres (`ship.x + ship.width / 2`) are sector sums and stay.
- Render: `sectorPos` is deleted (sector tiles are plain `iso(x, y)`); `fightFx`, `crewMarks`, `sectorFx`, focus,
  `screenOf` and tile picking work in sector tiles. One offset stays on purpose: a region's tile art (floors, walls, roof
  livery and plan, chunk views) is built in ship-local tiles, because floor variants and the livery gradient depend on the
  tile position and must not change when step 9 restamps a ship elsewhere. The region's containers sit at its top-left
  (`regionOrigin(grid)`), and entity views (crew, modules, items, jobs, turrets, target marks, particles, markers)
  subtract it when they place sprites. Depth keys are therefore unchanged.
- The inspector readouts show ship-local tiles (`UiInspect.local`); commands take sector tiles.
- 5b leftovers: `moduleView` light, the crew light reader in `shipScene` and `app/moduleSnapshot` (room, o2) use `get`.
  `raw()` is left only in `crew/pathfind.ts` and `eva/route.ts` (window-indexed, step 7).
- Save v15 (same shape, new meaning). `sectorEquiv` maps positions back to grid-local tiles before hashing (ShipC was
  sector already); both pre-refactor hashes still match. Tests: single-ship fixtures sit at (0, 0) (`fight`, `eva`);
  newGame tests add `PLAYER_START`; `portals` adds its grids' row-0 offsets; window, map, region and chunk tests use
  sector tiles.
- `gridId` stays as a dead tag (step 7).

### Step 7 split (planned 2026-10-20)

Step 7 is split into four slices. Each keeps `npm run check` green, changes no behaviour (the `sectorEquiv` and state
hashes must still match) and bumps `SAVE_VERSION` only if the save shape changes.

| Slice | Content | Why this order |
|---|---|---|
| **7a** (done on `sector-7a`, save v16) | `ItemStack.gridId` removed (membership from the `ship` layer through `gridIdAt`, falling back to the window rectangle for ship-less fixture grids); the last two `raw()` users (`crew/pathfind.ts`, `eva/route.ts`) read `load()` instead. Local-tile readouts for module, job and airlock labels | Items need no per-ship bounds and no portal; `raw()` goes first so 7d can delete it |
| **7b** (done: `sector-7b`, save v17: Module, Job, Drafted; **7b2** on `sector-7b2`, save v18: `Position.gridId`) | `ModuleC.gridId`, `JobC.gridId` (+ `Drafted.target/planned.gridId`), `Position.gridId`: the "which ship is this entity on" answers become `shipAt` / `gridIdAt` at the entity's tile. Largest slice; split by component if it passes about 600 lines | Position is read by nearly every system, so it goes after the small components have set the pattern |
| **7c** (done on `sector-7c`, save v19) | Ship-keyed ids: `Target.gridId`, `Projectile.fromGridId`, `CoreLink.gridId`, `Ship.gridId` -> the `ShipC` entity id; commands, events and UI snapshots switch from grid ids to ship ids (`gridId` fields in `commands.ts`, `events.ts`, `ui/api.ts`, `app/*Snapshot`) | One mechanical rename across the API surface, after the components no longer need the grid id |
| **7d** (done on `sector-7d`, save v20) | Deleted `sim.grids`, `GridMap`, `GridWindow` (+ `raw`), the cross-grid portals (`portals/graph`, `route`, `pathCache`, `systems/portals`, the `portal.*` commands and events) and `Path.then`; `SuitC` moved to `eva/components.ts`, `AirlockC` and the airlock geometry to `modules/airlock.ts`. `Ship.gridId` is gone: a ship is its `ShipC` entity id everywhere. Per-ship bounds (EVA ring, `bordersSpace`, `networkOf`, power out-of-bounds, A*) are the `ShipC` rectangle (`shipRect`, `shipFrame`, `inShip`) through `ShipGrid`. Lint guard against `.gridId` and `.grids` in `src/sim` | Last, because the window rectangle is what kept edge behaviour identical until then |

**7b notes.** `gridIdOf(sim, at)` (`sim/regions.ts`) is `gridIdAt` at `at.x, at.y` (0 for none). `gridIdAt` now has three steps: the
`ship` owner layer; else the lowest-id grid whose rectangle holds the tile (Space inside a bbox, ship-less fixture grids); else the
grid whose padded frame (EVA ring) holds it. The ring step keeps jobs on a downed EVA crew member (rescue) and drafted targets
in the ring on the grid they had before. Frames never overlap, so the answer is unique. Drafted targets: `gridId` was set only
for cross-grid orders; it is now `gridIdAt(target) || pos.gridId` (open Space stays on the crew member's own grid). The render
side asks the grid object (`grid.inBounds(m.x, m.y)`; `onShip(ship, at)` in `render/regionRules.ts`) because it holds no `sim`.
`sectorEquiv.test.ts` re-adds `gridId` to module rows (after `def`) in `legacyWorld`, as it does for vehicles. Job/module `gridId` parameters of helpers (`stackAt`, `makeHaul`, ...) stay until 7d.

**7b2 notes (save v18).** `Position` is `{ x, y, toX, toY, progress, facing }` (sector tiles). "Which ship is this crew member on" is
`gridIdOf(sim, pos)`, so an EVA crew member in the ring and a downed one outside the hull resolve by the ring rule of `gridIdAt`;
crossing a portal just moves the tile. Crew aboard a shuttle already had **no `Position`** (`boardCrew` removes it, with `Path`,
job and drafted state) and carry `AboardC { vehicle }`, which with the vehicle's `pilot` / `passengers` is the aboard link; nothing
new was added. Their location is the vehicle's `BodyC`; `unboardCrew` adds a tile `Position` at the bay or airlock. Render has no
`Sim`, so `gridIdAtTile(world, x, y)` (`render/regionRules.ts`) is the twin of `gridIdAt` over the `ShipC` rectangles and padded
frames. Commands, events and snapshots keep their `gridId` fields (filled from the lookups) until 7c. `sectorEquiv.test.ts`
re-adds `gridId` as the first key of `position` rows in `legacyWorld`; both hashes are unchanged.

**7c notes (save v19).** `Target.ship`, `Projectile.fromShip` and `CoreLink.ship` hold `ShipC` entity ids. Commands and events name a
ship by `ship` (`gridId` is gone from `commands.ts` and `events.ts` except `portal.link`, whose endpoints are grids until 7d).
`Ship.gridId` stays as the ship-to-window link; handlers turn `cmd.ship` into a grid with `gridOfShip(sim, ship)` and emitters turn a
grid into a ship with `shipOfGrid(sim, gridId)` or, from a tile, `shipIdOf(sim, at)` (same rule as `gridIdOf`, so EVA ring cases
agree). Helpers that take a `gridId` (`stackAt`, `randomModule`, `targetableShip`, ...) are unchanged and go in 7d. The UI is keyed by
ship id everywhere (`selectShip`, `UiCrew.ship`, `node-{ship}`); a station, which has no `ShipC`, uses its trader entity id from the
same id space. The tile inspector still prints "grid N" through a readout-only `UiInspect.grid`. Render keeps its grid-keyed
interfaces and the app layer converts. `sectorEquiv.test.ts` maps `ship` back to `gridId` / `fromGridId` in `legacyWorld`. Tests that
queue a command naming a ship that a queued spawn command creates must step first (the id does not exist at enqueue time).

**7d notes (save v20).** Step 7 is done.
- **Ids.** There are no grid ids. `Ship` has no `gridId`; every former grid-id parameter (`stackAt`, `findPath`, `placementError`, `shieldCapacity`, ...) takes the ship id (the `ShipC` entity). `shipIdAt(sim, x, y)` is the old `gridIdAt`: owner layer, else the lowest-id ship whose rectangle holds the tile, else the lowest-id ship whose padded frame (the EVA ring) does, else 0; `shipIdOf(sim, at)` reads a thing's tile. The renderer twin is `shipIdAtTile(world, x, y)`. `shipIds(sim)` lists ships in creation order; `homeShip(sim)` is the lowest-id player-faction ship (the starting ship; it replaces the `GRID = 1` / `PLAYER = 1` constants of the app layer and the `refId = 1` of the renderer).
- **Bounds.** The bound of a ship is its `ShipC` rectangle (`shipRect(ship)`, padded by `REGION_PAD` for `shipFrame`). `inShip(sim, ship, x, y)` and `inRect(rect, x, y)` are the point tests. The code that used to ask the window (`grid.inBounds`, `x0 / y0 / width / height`, `load()` over the window rectangle, `revision()` over its chunks) now asks a **`ShipGrid`** (`sim/shipGrid.ts`): a bounded view of `sim.sector.grid` for one ship, derived from the `ShipC` rectangle by `shipGrid(sim, ship)` (or `shipGridOf(sector, world, ship)` in the renderer, which has no `Sim`). It is not registered, not saved and has no id of its own (`id` is the ship id), it has no `raw()`, and the same object comes back while the rectangle is unchanged, so the `WeakMap` caches (`hullSum`, `fieldFrame`, `roomTiles`, `regionTiles`) still key on it. Edge behaviour is therefore the old windows' behaviour exactly; `regions.test.ts` pins it (`inShip`, `shipIdAt` ring rule, `isEvaWalkable`, `bordersSpace`, `networkOf`, out-of-rectangle `get` throws). `regions(sim)` returns `{ ship, grid: ShipGrid, bbox, frame }` per `ShipC`, ascending id.
- **Ship-less fixtures.** A fixture grid now needs a `ShipC`: `stampShip(sim, template, { faction, x, y, state? })` stamps the template into the sector, places its modules and creates the `ShipC` (no `CombatC`, crew or event); `spawnShip` is `stampShip` plus combat, boarding, crew and the event. Fixtures stamp a prize (`state: 'prize'`, skipped by every ship system) at the origin as their first entity, so its ship id is 1. `spawnModule(sim, def, x, y, rot)` no longer takes a grid (it writes the sector grid); `spawnTemplateModules(sim, ship, template)` reads the ship's origin from its `ShipC`, `placeTemplateModules(sim, template, ox, oy)` is the form `stampShip` uses before the `ShipC` exists (entity ids stay in the old order: modules, then the ship).
- **Portals.** Nothing in the sim ever created a portal (only the `portal.link` command did), so crew paths were always single-ship. Removed with `Path.then`, `CrossingC`, `PortalC`, the `portal.link` / `portal.unlink` commands and the `crew.crossed` / `portal.*` events. A drafted order whose target is on another ship or unreachable now lapses straight away (it did through `planRoute` returning null).
- **Save.** `grids` (the window rectangles) and `ShipC.gridId` are gone from the save. Fixed-shape otherwise.
- **Hashes.** Both `sectorEquiv` hashes are unchanged. `legacyWorld` writes `gridId` back (first key of `ship` rows), where a grid id is the ship's 1-based place in ship-id order, and maps `homeGrid`, `gridId` / `fromGridId` keys, positions and the per-grid tile hash through it.
- **Tests that named ships by number.** `newGame` tests used grid ids 1 and 2; they use a local `nth(sim, n)` (the n-th ship in creation order) because the starter's entity id is not 1.

Leftovers that 7a deliberately keeps: every `gridId` parameter of the helpers (`stackAt`, `nearestStorageFor`, `makeHaul`,
...) and `sim.grids.get(...)` lookups; they go with 7b-7d.

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
- Long ranges make shuttle trips slow (now 8 tiles/s, user decision 2026-10-21). Tuning, not architecture.

## Crew AI: one system for every ship (user principle, 2026-10-21)

NPCs use almost exactly the same crew AI as the player's crew. There is no parallel "NPC behaviour" stack:
- Station, enemy and player crew all run through the same needs (`systems/needs.ts`), job generation (the `*Jobs` systems),
  reservation, decide (`pickJob` by role priorities and `WORK_CATEGORIES`), work (`performJob`) and fight (`fight/`) code. Jobs are
  per ship and picked by crew aboard that ship, for every faction.
- The only differences are the **command source** and a **policy layer**. The player issues commands (priorities, drafts, orders);
  an NPC ship has a small per-ship **director**, data and config that sets the same things: it posts jobs and later drafts and
  orders. `systems/stationDirector.ts` is the first one.
- New NPC behaviour is a job kind, a work category or a priority, not bespoke movement code. Patrols are `patrol` jobs; alarm
  response withdraws them and lets the shared fight code hunt (fighter roles engage hostiles on their grid, unarmed civilians flee).
- Remaining player-only spots are listed in docs/STATUS.md (stations, slice 4) and should be made faction-agnostic as they are touched.

## Stations

Generated by `shipgen/stationGen.ts` (kinds and sizes in `content/stations.ts`; see docs/STATUS.md) and stamped by
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
  resupplied off-screen), sleep, work their station's jobs, and idle crew sometimes stroll to a court (`stations/life.ts`, a
  fallback inside decide before `wander`).
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

