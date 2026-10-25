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
