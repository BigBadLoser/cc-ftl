# Reactor and life-support replacement studies

Branch `art/core-systems`, based on main `12a91d3f`. User requested drop-in
replacements; the earlier 4x3 reactor study is not used.

## Review stage

Grey primary geometry only. Footprints stay reactor **2x2**, life support **1x2**.
`artifacts/core-systems-v1/` contains one rendered angle per proposal, editable
Blender files, parameters/anchors, and geometry bounds for all four rotations.

- Reactor: enclosed shielded core, broad crown, four load ribs, two integrated
  coolant pods, protected inspection recesses and a service face.
- Life support: one common air-handler hood and lower manifold, two removable
  scrubber cassettes, pressure reservoirs enclosed behind them, actual recessed
  upper inlets with structural vanes and a common front outlet.
- No floor slab. Grid outlines belong only to the review composites.
- Current-vs-blockout composite shows shipped colour sprites next to neutral
  proposals at equal scale. It is a size/silhouette comparison, not a finish match.
- `blockouts-zoom.png` uses 4x native pixels (2x game zoom), nearest neighbour.
- `current-vs-blockout.png` uses 2x native pixels (normal game display).

Source: `sprites/core_systems_blockout.py`; frozen dataclasses expose primary
dimensions. Builders support four rigid rotations with standard front-tile
origins. The script checks all four footprints and keeps geometry below 1.85.

## Reproduce

From repository root, with no other Blender process running:

```sh
SPRITE_PREVIEW=0 SPRITE_SS=4 SPRITE_SAMPLES=4 \
  /workspace/blender-tools/blender-4.2.9-linux-x64/blender -b -t 2 \
  --factory-startup --python-exit-code 1 \
  --python tools/blender/review/core_systems_preview.py -- \
  --out artifacts/core-systems-v1
python3 tools/blender/review/core_systems_preview.py \
  --out artifacts/core-systems-v1 --compose
```

Uses this checkout's unchanged `core.setup_scene`, `env_build.render_sprite`
and `crop_item`: Blender 4.2.9, native 64x32, SS4, four Cycles samples, shared
45-degree camera / 30-degree elevation, shared lighting (sun shadows off),
standard palette quantization, 1px prop outline. Only two colour renders; no
beauty render, full sprite build, runtime code changes or live manifest edits.

## Still to resolve through review

These are new design proposals, not reconstructed from a reference image.
The reactor's crown is intentionally plain pending silhouette review. Life
support's end casing and cartridge proportions need review at native scale.
Operator indicators, final plumbing, maintenance hardware, industrial colours,
powered/unpowered/damage states, final orientation review and sprite export
come after geometry approval. Existing sprite IDs and game definitions remain
unchanged; this branch does not yet contain a finished replacement atlas.

## Mechanical pass, after approval of both blockouts

`artifacts/core-systems-v2/` contains the second grey pass. Its comparison uses
the approved v1 renders as the left-hand reference, aligned at the same tile
origin and display scale. V1 artifacts and the original blockout source are
preserved. Added details live in `sprites/core_systems_detail.py` as a separate
mesh layered over each unmodified approved model.

- Reactor: crown locking dogs and lifting bridge, seated short coolant returns,
  heat-exchanger fins, service sockets and an upper sensor housing.
- Life support: cassette pulls and latch hardware, lower guides, a pressure
  equalisation manifold, a blanked duct flange, divider-mounted status housing
  and a removable end plate with a stand-off lifting handle.
- Comparison priorities: primary silhouettes remain unchanged except the low
  crown lifting bridge; cassette spacing and hood proportions are unchanged;
  all pipe connections seat into the pods/body or a continuous manifold.
- The rendering audit compares every approved mesh's vertices, topology and
  attributes before and after adding detail, for all four rotations. Digests
  and `approvedBaseUnchanged` are recorded in each JSON file.
- Reactor maximum deck-relative top is 1.781, life-support top is 1.500. All
  details remain inside the original footprints. Individual mounting feet
  connect both lower castings to deck height zero. There is no floor slab.
- Small latches and service sockets are deliberately secondary at native size;
  the crown, coolant loop and pull handles do most of the mechanical reading.
  Finish, power indicators and operating/damage states remain pending.

Reproduce by adding `--detailed` to the Blender invocation and using
`--out artifacts/core-systems-v2`; then compose with:

```sh
python3 tools/blender/review/core_systems_preview.py --compose \
  --out artifacts/core-systems-v2 --baseline artifacts/core-systems-v1
```

## Material pass, after approval of mechanical detail

`artifacts/core-systems-v3/` adds material roles and restrained self-lit
inspection/status faces, with colour/glow twins and editable Blender files.
`materials-zoom.png` is the enlarged review; `grey-vs-materials.png` compares
against the approved mechanical pass at normal game display scale.

- Reactor: blue-grey shield shell, lighter crown, graphite supports, muted
  industrial yellow on locks/collars/lifting grip, pale coolant tubes, cyan
  inspection slots and small mint/amber indicators.
- Life support: pale hood/cassette surrounds, teal vent coamings, grey-teal
  cartridge faces, yellow service grips and a small mint divider display.
- The palette uses refinery industrial yellow `#b6a45d`. Material colours pass
  through the unchanged standard game palette quantization and shared lighting.
- Semantic material calls were inserted into the original geometry builders;
  their defaults still produce the approved grey attributes exactly. Vertex
  positions and topology are unchanged. For finished previews the audit also
  independently loads the approved v2 `.blend` meshes and matches their exact
  geometry digest. All four rotation bounds match the approved mechanical pass.
- Unpowered geometry was built and its complete emission attributes checked:
  zero glow. A separate unpowered render is pending state review.
- Glow is limited to designated inspection slots and indicators. There is no
  whole-machine emissive material, bloom, smoke, room or floor in these assets.

Reproduce with `--finished --out artifacts/core-systems-v3` in the Blender
invocation, then:

```sh
python3 tools/blender/review/core_systems_preview.py --compose \
  --out artifacts/core-systems-v3 --baseline artifacts/core-systems-v2
```

This is a one-angle material preview, not the final export. User review of
materials, then four rendered orientations and operating/damage states, remain
before production packing or integration. No runtime definitions or live assets
have been changed.

## Strut and vent corrections requested after material review

`artifacts/core-systems-v4/` addresses the three reported readability issues.
`before-vs-touchups.png` compares against v3 at normal game display scale;
`touchups-zoom.png` enlarges the revised models with nearest-neighbour pixels.
The previous previews remain intact.

1. Reactor supports: width changes from .16 to .1767767 tile units, or .0083883
   per side. At the established orthographic camera this makes the face-on
   support eight native pixels wide, with straight edges aligned to pixel
   boundaries. This removes the alternating partial-coverage edge pixels
   without changing camera, sampling, lighting, post-processing or topology.
2. Roof vents: cyan is assigned to the coamings, inner walls and blades. A
   slightly bluer cyan avoids green/grey palette jumps under the shared light.
   Removed coaming bottom caps that coincided with the pale hood roof; blade
   ends now penetrate the inner walls, and blade tops sit below the rim.
3. Front grille: replaced the narrow applied vent band with a real .17-high,
   .065-deep aperture. Two broad inclined louvres, visible dark gaps and two
   vertical dividers read as three grille sections within the existing hood.

All four physical rotations pass footprint/height checks. The detailed audit
against the approved v2 Blender files permits only the requested edits:

- Reactor: exactly 288 repeated support vertices shift tangentially; all other
  vertices and every polygon index are exact. Separate hardware is unchanged.
- Life support: only faces wholly within the hood/roof region may differ;
  the lower castings, cassettes, reservoirs and separate hardware remain exact.
- Reactor height remains 1.781. Life support is 1.480 high with its blades
  recessed below the existing rim. Footprints remain 2x2 and 1x2.
- Both unpowered emission checks still pass with zero glow.

The named revision parameters live in `sprites/core_systems_touchups.py`.
Historical default parameters still reproduce the earlier geometry. Use the
corrected parameters for subsequent rotation/state previews and final export.
The older `approvedBaseUnchanged` JSON flags describe consistency between the
grey and coloured builders at the same parameters; the new
`targetedGeometryAudit` records the explicit differences from the approved mesh.

Reproduce using `--touchups --out artifacts/core-systems-v4` in the Blender
invocation, then:

```sh
python3 tools/blender/review/core_systems_preview.py --compose \
  --out artifacts/core-systems-v4 --baseline artifacts/core-systems-v3
```

The rendering contract is unchanged. No runtime code or live atlas is modified.

## Grey top-vent cross beams restored

The user approved the corrected reactor and preferred the original grey
cross beams inside the life-support roof vents. V5 restores the `frame`
material on those blades, keeping the cyan coamings/inner walls and the V4
front grille. This is a material-only correction: all four geometry digests,
alpha coverage and glow match V4 exactly. Only roof-vent colour pixels differ.

`artifacts/core-systems-v5/` contains the new life-support render and the
byte-identical approved reactor files copied from V4. The renderer's `--only
life_support` option avoids rendering the approved reactor again. Use the same
V4 commands with that option and the V5 output directory, then compose against
`--baseline artifacts/core-systems-v4`.

## Four orientations and power-state review

After user approval of both V5 models, `artifacts/core-systems-orientations/`
renders the approved models through all four physical rotations, powered and
unpowered: 16 isolated frames plus glow twins. No model source changed.

- `orientations-powered.png`: all four views at normal game display scale.
- `orientations-unpowered.png`: the corresponding unpowered views.
- `power-states.png`: powered/unpowered r0 views side by side.
- `review.json`: dimensions, anchors, footprint, geometry digest and glow counts
  for every frame, plus exact r0 approval-match results.
- `frames/`: native-size individual colour/glow PNGs, ready for inspection.

Geometry digests match the approved V5 record in every rotation. All frames
remain grounded, below wall height, and within the existing 2x2 / 1x2 footprints.
Both r0 colour and glow renders reproduce V5 pixel-for-pixel. Every power-state
pair has identical alpha coverage, frame dimensions and anchor; all unpowered
glow images are zero. The life-support front display is occluded in r2/r3, so
those views have no visible glow even when powered. This is expected visibility,
not a view-specific model change.

One Blender process, two threads, the unchanged SS4/four-sample project settings:

```sh
SPRITE_PREVIEW=0 SPRITE_SS=4 SPRITE_SAMPLES=4 \
  /workspace/blender-tools/blender-4.2.9-linux-x64/blender -b -t 2 \
  --factory-startup --python-exit-code 1 \
  --python tools/blender/review/core_systems_orientations.py -- \
  --out artifacts/core-systems-orientations
python3 tools/blender/review/core_systems_orientations.py --compose \
  --out artifacts/core-systems-orientations
```

These are review frames; damage variants, production atlas packing and runtime
integration remain separate work. No live sprite build or runtime edits occur.

## Damage preview after orientation/power-state approval

`artifacts/core-systems-damage/damage-review.png` compares the signed-off healthy
r0 models with damaged, damaged-flicker and destroyed variants. Six native
colour/glow pairs and their bounds/anchors live alongside it. This is a quick
one-angle damage review before export, with the same native 64x32 / SS4 /
four-sample Blender 4.2.9 settings.

`sprites/core_systems_damage.py` applies the existing shared module damage
recipe to freshly built approved geometry: dents, scorch, a breached/bent panel,
partially failed lights and a collapsed charred wreck. It omits floating spark
chips and scattered floor debris. Healthy model sources and approved renders
are unchanged. The flicker frame repeats the exact damage with lights off.

The shared recipe initially pushed bent hardware and the narrow life-support
wreck outside their footprint. This adapter keeps them on their original tiles:

- Reduce dent depth continuously if the original end hardware would cross a
  tile boundary; this preserves each deformation's shape instead of clipping
  vertices against a boundary plane.
- Translate added loose panels inward while retaining their geometry.
- Apply a continuous inward collapse to the wreck's upper assembly, leaving
  its deck-level feet fixed. The life-support upper factor is about .805;
  the reactor needs only a .995 factor. Recorded in the review JSON.

Every r0 damage frame is grounded, below wall height and within its original
footprint. Damaged-flicker and destroyed glow are zero. For subsequent rotation
exports, damage is generated in canonical r0 and the entire assembly rotates
rigidly, keeping hit locations on the same physical parts.

```sh
SPRITE_PREVIEW=0 SPRITE_SS=4 SPRITE_SAMPLES=4 \
  /workspace/blender-tools/blender-4.2.9-linux-x64/blender -b -t 2 \
  --factory-startup --python-exit-code 1 \
  --python tools/blender/review/core_systems_damage_preview.py -- \
  --out artifacts/core-systems-damage
python3 tools/blender/review/core_systems_damage_preview.py --compose \
  --out artifacts/core-systems-damage
```

Damage appearance awaits review. Final damage rotations, fixed frame-set
packing, manifest aliases and the production handoff remain after approval.
