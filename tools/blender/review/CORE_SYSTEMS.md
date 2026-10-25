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
