# Reactor — reference-led 4x3 concept, v1

A horizontal armoured pressure vessel based on the user's visual reference:
four curved shell bays, five pressure hoops, sealed circular end caps, two
small yellow operating windows, three coolant cabinets and a local controller.
Blue-grey jacket, dark recesses and restrained metal trim. No floor slab.

- Model: `sprites/reactor_vessel.py`, `reactor_vessel(rot=0, active=True)`.
- Footprint: **4 x 3** at r0, long axis grid +x; quarter turns are supported by
  the builder. Origin is the footprint centre at deck height, not yet converted
  to the game's front-tile anchor.
- Actual r0 bounds: **3.948 x 2.779 x 1.770** units. Feet at zero; top below 1.85.
- Active windows glow yellow. Inactive builder changes them to dull brass;
  only r0 active is rendered for this first review.
- Native art uses the current `sprites/scale.py`: **128 x 64** tile diamonds.
- Preview: one standalone isometric colour/glow pair, SS 2, four samples,
  two Blender threads. One process at a time. No scene dressing or beauty render.
- Artifacts: `artifacts/reactor-v1/`, native sprite, exact 3x nearest-neighbour
  board, measured dimensions and editable `.blend`.
- Preview only. Original `props.reactor`, content footprint/power, manifest,
  production atlases and all `src/` remain unchanged.

```sh
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/reactor_preview.py -- --out "$PWD/artifacts/reactor-v1"
python3 tools/blender/review/reactor_preview.py --out "$PWD/artifacts/reactor-v1" --compose
```
