# Blender asset pipeline

## Sprite pipeline (current): `npm run sprites`

`sprites/build_sprites.py` renders pre-baked isometric pixel sprites into `public/assets/<scale>x/sprites/*.png` and merges them
into `public/assets/<scale>x/manifest.json` (`--scale 1|2` or `ART_SCALE`, default 2) in the shape of `src/render/assets/manifest.ts` (the contract). The art is split into
families (`sprites/families.py`): `crew`, `env`, `walls`, `consoles`, `weapons`, `roof`, `sol`. Each renders into its own
sheets (`pack.py`: pages of at most 2048 px) and replaces only its own sheets and ids in the manifest, so
`npm run sprites -- public/assets/2x walls` rebuilds one family and the committed manifest is the cache (`all` = every
family). `sol` runs Sol's renderers in `experiments/` (final quality, one Blender job at a time) and packs their output
(`sol_pack.py`). The manifest also records the art heights (`heights`: wall 1.85, roof top 2.05, px per tile of height).
The older GLB pipeline below (`build.py`, `crew/`, `lib/`) is kept as source for the CC0 base import but no longer feeds the game.

- Camera: ortho, yaw 45, elevation 30, tile 64x32; SS 4 supersample, mode-downsample, palette quantization, binary alpha.
- Modules: `core.py` scene/mesh builder/render, `post.py` numpy (palette, team keys, outlines, PNG), `props.py`
  environment models, `env_build.py` atlas + static entries, `human_base.py`/`human_gear.py` crew items,
  `human_render.py` layer rendering, `human_items.py` the crew item registry, `crew_spec.py` frame size/clips/order,
  `crew_clips.py` per-clip pose code, `crew_build.py`/`crew_cache.py`/`crew_digest.py` the incremental crew build and its
  render cache, `crew_pack.py` per-clip sheets + layer entries, `compose.py` shared compositing,
  `contact_sheet.py` verification image (room + junction test).
- Verify: `blender -b --factory-startup --python tools/blender/sprites/contact_sheet.py -- [assets] [outdir]`.

### Speed: render cache and `--preview`
Every rendered family (not `sol`, `robots`, `aliens`, which run their own renderers) is cached in `.cache/sprites/<family>`
(`sprite_cache.py`, `geom_digest.py`; `$SPRITE_CACHE` moves it). A sprite's key hashes the render code (`core`, `post`,
`env_build`, `scale`), the palette files, tile size, Blender version, SS and samples, the scene state (world, sun, camera) and
the built geometry (vertices, faces, colour attributes, object flags). Editing one builder re-renders only the sprites whose
meshes changed. Callable jobs (consoles, bays, shuttle, airlock) render themselves, so they are keyed by their module and
everything it imports. Options: `--plan` (hit/miss report, renders nothing), `--force`, `--no-cache`.
`--preview` renders at SS 2 and 1 sample (grainy, about 4x faster), cached apart under `preview/`; with `--only` it needs a
scratch outdir. Do not lower the FINAL settings: 1 sample leaves visible grain (the ambient term is noisy at 1 spp).

### Crew layers
One sheet per item AND clip: `crew.human.<slot>[.<item>].<clip>`, for example `crew.human.torso.tee.walk` (+ `.glow` twin
when that clip has glow pixels). Rows = sim facing d (0 = grid +x, counter-clockwise in grid
space, 2 = grid +y), i.e. d=0 SE, 1 S, 2 SW, 3 W, 4 NW, 5 N, 6 NE, 7 E on screen. Blender azimuth theta = 90 - 45*d
(character faces -Y at 0, grid y = -Blender y). Columns = that clip's frames: idle 4, walk 8, work 6, sleep 3, sit_idle 4,
sit_work 6, eva_float 4. The manifest layer `crew.human.torso.tee` lists its clips, each with its `sheet`
(`clips.walk = {sheet, start: 0, frames, fps, loop}`). An item only has the clips it needs: no `sit_*` for `gear.back`
(rig/pack would sit inside the chair), `eva_float` only for the body and the suit. The runtime falls back to idle for a
clip a layer lacks, and hides the layer for `sit_idle` (`resolveClip` in `src/render/loadout.ts`).
All layers share ONE fixed frame (`crew_spec.py`: 128x120, feet anchor (64, 94); the largest current gear needs 76 above,
15 below, 52 to each side), so a new item never changes another item's sheets. Sleep frames are centred on the anchor
and lifted 0.22 tile for a bed.
Stack order (`order`): body 0, eyes 10, legs 20, torso 30, gear.belt 40, arm.R 50, arm.L 51, hair 60,
implant.temple 65, gear.head 70, gear.back 80.

#### Incremental builds and the render cache
`npm run sprites -- -- public/assets/2x crew` renders only what the cache lacks (`<repo>/.cache/sprites/crew`, gitignored,
`$SPRITE_CACHE` to move it), then packs. Options after `crew`:
`--item S[,S]` (substring of the layer id, e.g. `torso.tee`), `--clip C[,C]` (e.g. `walk`), `--force` (ignore the cache for the
selected entries), `--plan` (print the hit/miss report and render nothing). With `--item`/`--clip` only those sheets are
rebuilt and merged into the manifest; without, every human layer is rebuilt from the cache (stale sheet files removed).
The build prints cache hits and misses per sheet and in total. One cache entry = one raw render keyed by item, clip,
direction, frame plus a hash of: the item's geometry digest (`crew_digest.py`: vertices, colour/glow attributes,
weights, parenting, flags), the geometry digests of its holdout items (the default items of lower slots), the clip
(name, frame count; for `sit_*` and `eva_float` also the files that pose them), and the global inputs: the rig digest,
the base GLB, Blender version, `core.py`, `post.py`, `human_render.py`, the palette files and the frame constants. A clip's
key covers only its own table row and the source of its own pose functions (`crew_clips.py`) plus the files they lean on.

When a full re-render is unavoidable: a rig or base change (GLB, bones, base clips), anything in `core.py`/`post.py`/
`human_render.py` that touches pixels (render settings, palette, finishing, saturation, holdout rules), the frame
constants, or Blender. Changing a DEFAULT item (e.g. cargo pants) re-renders every layer above it, because those were
rendered with it as a holdout; that is inherent and the cache tracks it, so it costs exactly the layers above.

Cheap changes: a new item = write its builder (`human_gear.py` etc.) and list it in `human_items.build_items` (that file
is not hashed; geometry digests decide): only the new item renders (~250 frames, about a minute) and nothing else
changes. A new clip = add a row to `crew_spec.CLIPS` and a `Pose` entry to `crew_clips.POSES` (`items=` limits which items
get it); every item renders that clip once, existing clips stay cached. Tweaking one item's geometry re-renders that item
plus the layers it holds out. Do NOT put clip-specific pose code in `human_render.py`: it is hashed for every clip.

Sampling noise: Cycles hashes its per-pixel sample jitter from the pixel's position in the render canvas, and a few shade
bands and edge pixels flip with it. Moving the canvas (changing the frame constants) or even the scene contents re-rolls
about 15% of the opaque pixels by one band. It is why the cache, not a re-render, is the source of truth: the same inputs
always give the same cached pixels, but a re-render of one entry in another process can differ at a few pixels.

Holdout: when a layer is rendered, the default items of all LOWER slots are Cycles holdout objects, so the layer is cut
wherever a lower layer is nearer; one fixed order is then correct in all directions. There is NO per-layer outline:
the renderer draws ONE 1 px outline (plus a thin cool rim on the left edge) around the stacked layers in its composite
filter (`createCrewFilter` in `src/render/assets/palette.ts`).

Crew look (locked-in defaults after the A1 readability pass): base = `source/base_cc0.glb` (variant D: stylised
proportions, upright idle, simplified head; regenerate with the `base_import.py` defaults), head enlarged ONCE
(`stylize.HEAD_K` 1.2; no head scale anywhere else), 4 shade bands (`post.BAND`), smooth shading and no secondary tone
patches (shirt hem, pocket, sole), +30% clothing saturation (`human_render.SAT`; the runtime boosts the cloth colour too),
simplified face (small dark eyes, thin lighter brow with a skin gap, no mouth) with a skin highlight on the head,
gunmetal cyber arm the size of a flesh arm with one cyan strip and a wrist ring, goggles as two lenses on a strap.
`crew_check.py` composites the shipped sheets like the runtime and writes the 4x verification sheet.

Palette swap: `team.*` materials render as pure key albedo. Every key pixel is `s * K` with K the manifest key colour
(`team.skin` #ff00ff, `team.hair` #00ff00, `team.cloth` #ffff00, `team.accent` #00ffff) and s one of five shade steps
0.30, 0.47, 0.64, 0.82, 1.00 (step 0 darkest; crew uses steps 0-3, step 4 only for the skin highlight). Runtime ramp: target = base colour * (0.42, 0.62, 0.82, 1.0,
1.22)[step] with cooler shadows (see `compose.shade`). Fixed-colour parts use plain palette colours (no key).

### Environment
Atlas `sprites/env.png` (+ `env.glow.png`); anchors = floor-diamond centre of the front-most footprint tile.
`walls.py` builds walls, hull, ghosts, doors and floors; `props.py` the modules, props and fx.
- Walls: one low bevelled block per 4-neighbour mask (bit 1 N = -y, 2 E = +x, 4 S = +y, 8 W = -x): connected sides are
  cut flush, open sides slope, the flat top has a dark channel along connections (isolated: a pit). Ids
  `tile.wall.m<0-15>`, `tile.hull.m<0-15>` (darker; `tile.hull.haz.<s|e>.<0-3>` are hazard foot-strip overlays for
  exterior slopes), straight variants `.m5.v1/.v2`, `.m10.v1/.v2`, ghosts `tile.hull.ghost.m<0-15>` (near-black, ~55%
  alpha, light edge). Doors `tile.door.x|y` (+ `.open`), tall frame; doors count as wall neighbours for masks.
- Floors `tile.floor.a..h`, seamless plated deck variants.
- Economy (`logistics.py`, `items.py`): `module.fabricator` (2x1; `.active` = crafting glow and sparks; `.r1/.r2/.r3` are the
  rotations, front = access side) and `module.storage.empty|partial|full` (`module.storage` = partial). Items: floor stacks
  `item.<id>.s|m|l` (renderer picks by count / stack size) and carried `item.<id>.held`, for scrap, metal, electronics, polymer,
  ice. Placements are fixed tables (no random). Preview a subset: `env_build.build(out, only=[substrings])`.

---

## GLB pipeline (legacy)

Crew art is generated by script (Blender 4.2 LTS, headless) into committed `.glb` files. The game only loads
what `public/assets/manifest.json` lists.

```
npm run assets           # setup.sh (installs Blender if missing) + build.py -> public/assets/**.glb + manifest.json
npm run assets:preview   # preview.py: engineer renders (Cycles CPU) in the scratchpad assets-preview/ dir
```

EEVEE and Workbench need a GL context (libEGL), which the container lacks, so previews use Cycles CPU, 24 samples.
The preview assembles the engineer in memory from the same builders the export uses.

## Layout
- `palette.json` (repo root): the only colour list. `{hex, emissive?: strength}`.
- `lib/palette.py` loader, `lib/kit.py` style kit (`Builder`: faceted `prism`/`ball`, chamfered `box`, bevelled
  `plate` for machines), `lib/vcolor.py` (base + grime noise + floor gradient, deterministic), `lib/materials.py`,
  `lib/rig.py` (armature, sockets, keyframing), `lib/skinning.py` (weights), `lib/export.py` (glTF).
- `crew/`: `body.py` (human base), item modules (`arms`, `clothing`, `gear`, `hair_eyes`), `clips.py`, `human.py`
  (build driver), `bodytype.py`.

## Conventions
- Units: 1 = 1 tile, Y up, front = +Z, origin at the feet. Character L = +X. ~6 heads, ~1.55 tiles tall.
- Bones: `root hips spine head arm.L/R forearm.L/R hand.L/R leg.L/R shin.L/R foot.L/R`. All rest orientations are
  identity (translation-only rest pose), so `rotation.x` on a bone is plain Euler about world axes.
  Note three.js strips `.` from node names (`arm.L` -> `armL`).
- Sockets: empties `socket.back`, `socket.head`, `socket.hand.L/R`, children of their bones, in body.glb.
- Materials (one shared per role): `base` (vertex colours), `emissive.<palette name>`, `team.<role>`.
- **Skin and hair tint: `team.skin`, `team.hair` (also `team.cloth`, `team.accent`) materials.** Vertex colours on
  these only carry grey shading; `baseColorFactor` is the tint (defaults from the palette). The runtime clones the
  material per crew member and sets `.color`. Fixed-colour parts use `base`.
- Two kinds of part:
  - **Skinned** (body, flesh arms, shirts, pants): mesh nodes `skin@<item>.<material>`, vertex groups = bone names,
    all in the same armature rest pose as body.glb. Slot files carry the armature too; the runtime rebinds the
    meshes to the body's skeleton by joint name. Weights are procedural (`lib/skinning.py`), position-based, so
    clothing gets the same weights as the body under it (stand-in for a Data Transfer modifier).
  - **Rigid** (hard items: cyber arm, goggles, jack, rigs, plates, hair, eyes): mesh nodes
    `<bone or socket>@<item>.<material>`; the runtime re-parents each node under the named bone/socket node.
    Node transforms are kept as exported (they include a constant 90 degree X rotation that Blender's Z-up to
    Y-up conversion bakes in; vertex data is compensated, so `bone.add(node)` is correct).
- Manifest: `{version, assets: [{id, file, kind: crew.body|crew.slot, slot, bone|socket, targets, skinned, tint,
  emissive, clips, tris, bytes}]}`. Eyes: `cyber` = organic left + cyber right.
- Clips (24 fps, loop, extra closing key): `idle walk work sleep`, all in body.glb.

## Body types (not built yet)
Builders read `crew/bodytype.py:current` for widths and emit parts in a fixed order, so a variant build has identical
topology. A later pass builds SLIM/BROAD/ATHLETIC, diffs against AVERAGE and writes shape keys on the body and on
each skinned clothing layer.

## Adding a slot item
1. In a `crew/*.py` module add `@slot_item("<slot>", "<name>", skinned=False)` over `def build(b)`; use
   `b.prism/ball/box/plate(target, size..., color, pos, rot)` with bone-local lab coordinates (x right, y up, front +z).
   Colours are palette names, or `skin()/hair()/cloth()/accent()` for tinted parts. Use `sides=("L","R")` for
   paired items (`build(b, s, side)`).
2. Soft items: `skinned=True`, targets are bones. Hard items: leave rigid; target a bone or `socket.*`.
3. `npm run assets`, then add it to `ENGINEER` in `preview.py` to check it. Commit the `.glb` and manifest.

## Experiment: restyled CC0 base character (`crew/base_import.py`)
Standalone, not part of `build.py`. Takes Quaternius' CC0 "Universal Base Characters" male plus the CC0
"Universal Animation Library" (see `THIRD_PARTY.md`; downloaded from itch.io, not stored in the repo) and writes
`tools/blender/source/base_cc0.glb`:
```
blender -b --factory-startup --python tools/blender/crew/base_import.py -- \
  --base <Superhero_Male_FullBody.gltf> --anims <UAL1_Standard.glb> --out tools/blender/source/base_cc0.glb
```
- Restyle: head scaled up and body widened (`HEAD_SCALE`, `WIDTH`), uniform scale to `HEIGHT` = 1.7, symmetric collapse
  decimation to ~`TRIS` triangles (welded first), flat shading, per-face grey vertex colours. Textures are dropped.
  Briefs are found from the dark texels of the base texture, then cut with clean hem/waist planes (bisect) into their
  own `team.cloth` mesh. Parts: `skin@body.team.skin`, `skin@briefs.team.cloth`, `skin@brows.team.hair`, `skin@eyes.base`.
- Rig: the source skeleton has the same 65 bones as the library, so clips are retargeted by simply assigning the
  actions (rotations only; location only on root/pelvis, scaled). Renamed to the standard names (`pelvis`->`hips`,
  `spine_01`->`spine`, `upperarm`->`arm`, `lowerarm`->`forearm`, `thigh`->`leg`, `calf`->`shin`, `Head`->`head`,
  `.L/.R` suffixes); extras kept (`spine_02/03`, `neck_01`, `clavicle.*`, fingers, `toe.*`). Unlike our own armature the
  bones have real orientations (not identity rests), so rotation-only code written for the lab rig does not transfer.
- Clips: `idle`=Idle_Loop, `walk`=Walk_Loop, `work`=Interact, `sit`=Sitting_Idle_Loop, `sleep`=last (lying) pose of
  Death01 held. The glb default `team.cloth` tint is the jacket colour; recolour it dark (briefs) at runtime.
- Sockets: `socket.back/head/hand.L/hand.R` are empties parented to bones.

### Base mesh (D) and options
`base_import.py` defaults produce the shipped base: original smooth mesh (welded, `--decimate` for the old faceted look),
`--stylize d` (`none`, `c` or `d`; `crew/stylize.py` bakes proportions into mesh and rest bones: head x1.2, broader
shoulders, shorter legs, thicker limbs, chunkier hands/boots; d adds a rounder skull, defined jaw and flatter face),
`--upright` (idle with upright head/neck/spine and arms at the sides; `--no-upright` to keep the source idle). The sprite
pipeline follows the styled base (`human_base.LEVEL`: height thresholds via `stylize.zmap`, rigid gear carried through the
same warp by `human_base.warp_gear`; eyes keep their size).
