# Transport B2 — sweepback utility shuttle review

The separate concept B has a lower integrated cockpit, fuller passenger/cargo
cabin, broad engine shoulder fairings and rear storage cradles for its wings.
The movable foils taper from a thicker root and sweep rearward 75° for storage.
Recessed bearings attach directly to the fairings; cradle floors and stops are
closed solids joined to the engine housings. The pressure door is ahead of the
folded wings, with a 1.60-unit clear-height leaf, a docking land and hazard sill.
The original v4 geometry, `shuttle()` entry point and review scripts are intact.

The current builder is `transport_shuttle(heading, state, dz=0, wing_fold=None)`
in `tools/blender/sprites/shuttle_craft.py`. Closed-solid helpers are in
`tools/blender/lib/transport_forms.py`. No interior is modeled or visible.

## Measured envelope

| Quantity | World units / tiles |
| --- | --- |
| Parked width, including folded wings and cradles | 3.3950 |
| Parked length | 4.4000 |
| Height from landing feet | 2.4000 |
| Flight wing span | 5.6000 |
| Placeholder pit depth below deck | 1.5000 |
| Highest point above deck | 0.9000 |
| Clearance to roof top at 2.05 | 1.1500 |
| Boarding opening height | 1.6000 |
| Folded moving-wing clearance ahead of boarding leaf | 0.1436 |

The canopy half-height is reduced from .54 to .40, about 26%. Its windscreen
slopes into the forebody. Overall height falls from 2.70 to 2.40. The placeholder
pit is consequently 1.50 deep, with most of the craft below deck. The bay
session owns its final depth, access and structure; the review room is not bay
module art.

Parked has legs down and dark nozzles. Flight has legs fully concealed and
wings deployed. Only nozzle interiors emit light. `docked` gives folded wings,
retracted legs and dark nozzles. Docking views and remaining rotations await
art approval.

## Livery

Primary paint is on the moving wings; secondary paint follows a coherent
beltline over the engine fairings, forebody and boarding leaf. Both are unlit
and preserve exact `#ff0000` / `#00ff00` in native sprite files. A muted blue
`#527593` / ochre `#c7a15e` faction palette is applied only to review boards
and the beauty scene. The raw-key board provides the export reference. Paint
does not emit glow.

## Preview files

Current files are under `artifacts/shuttle-sweepback-r2/`. The first concept B
images remain under `artifacts/shuttle-sweepback/` for the comparison board.

- `transport-B-silhouettes-1x.png`, `-3x.png`: matching-heading folded/deployed
  views, crew scale and flat silhouette comparison.
- `transport-B-before-after-1x.png`, `-3x.png`: previous and revised concepts
  at the same pixel metric, direction and review livery.
- `transport-B-parked-1x.png`, `-3x.png`: r0 in the placeholder 4×5 pit and room.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2 and d5 flight views.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw primary/secondary key colours.
- `transport-B-beauty.png`, `transport-B-preview.blend`: low-sample beauty
  and editable review scene with faction-coloured paint.
- `design.json`, `pixel-checks.json`: dimensions, folded-wing/hatch clearance,
  nozzle-only emission, exact export keys, binary alpha and exact 3× checks.

Render these review views only, one Blender process at a time:

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r2"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r2" --compose
```

Four samples for sprite previews, eight for the beauty, Blender 4.3.2. No full
sprite build, production atlas rebuild, `src/` wiring or gameplay changes are
part of this review. Await user sign-off before final-quality renders.
