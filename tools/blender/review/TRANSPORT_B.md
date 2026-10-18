# Transport B — sweepback utility shuttle, first preview

A fresh craft design, kept as a separate variant alongside the earlier shuttle.
The original v4 geometry, `shuttle()` entry point and review scripts are intact.

The new builder is `transport_shuttle(heading, state, dz=0, wing_fold=None)` in
`tools/blender/sprites/shuttle_craft.py`. Closed-solid helpers live in
`tools/blender/lib/transport_forms.py`; they contain no v4 geometry. The new craft
has a blunt wedge body, raised cockpit bridge, a port-side pressure hatch,
compact aft engines and large wings on visible swivel bearings. The wings
sweep rearward 75° in the horizontal plane for storage and docking, keeping the
parked height constant. No interior is modeled or visible.

## Measured envelope

| Quantity | World units / tiles |
| --- | --- |
| Parked width, including folded wings | 3.3919 |
| Parked length | 4.4000 |
| Height from landing feet | 2.7000 |
| Flight wing span | 5.6000 |
| Placeholder pit depth below deck | 1.7000 |
| Highest point above deck | 1.0000 |
| Clearance to roof top at 2.05 | 1.0500 |

The pit floor is at −1.70 and the vehicle is translated down by that amount.
The pad and room are review placeholders; the bay session owns the final pit.
The parked craft has legs down and dark nozzles. Flight has legs up and wings
deployed. Only nozzle interiors emit light. The builder also accepts `docked`
for folded wings, retracted legs and dark nozzles; docking pose art is deferred
until preview approval.

Primary and secondary paint are flat, unlit `mkP`/`mkS` panels, using exact
`#ff0000` and `#00ff00`. The grey hull is lit normally. Pixel checks verify both
keys survive export exactly, all native colour alpha is binary, and 3× boards
are exact nearest-neighbour copies.

## Preview only

Outputs in `artifacts/shuttle-sweepback/`:

- `transport-B-parked-1x.png`, `-3x.png`: r0 parked in a placeholder 4×5 pit,
  surrounded by a room, with a shipped crew sprite at deck level for scale.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2, d5 flight views.
- `transport-B-beauty.png`, `transport-B-preview.blend`: one low-sample beauty
  and its editable scene.
- `folded-r0.png`: unobstructed folded silhouette, to inspect the wing mechanism.
- `design.json`, `pixel-checks.json`: measured geometry and export checks.

Render these review views only, one Blender process at a time:

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 \
  --python tools/blender/review/transport_preview.py -- \
  --out "$PWD/artifacts/shuttle-sweepback"
python3 tools/blender/review/transport_preview.py \
  --out "$PWD/artifacts/shuttle-sweepback" --compose
```

Four samples for sprite previews, eight for the beauty, using Blender 4.3.2.
No full sprite build, atlas rebuild, `src/` wiring or gameplay changes are part
of this preview. Await user sign-off and suggested changes before producing
the remaining rotations, docking views or final-quality sprites.
