# Transport B4 — broad folding-wing shuttle review

The separate concept B retains its low cockpit, passenger/cargo cabin and neutral
light-grey hull. Revision 4 gives it broad swept wings that cover 2.70 units of
the ship's 4.40-unit length. Deployed span is 7.20, with 11.4692 square units of
wing plan area; B2 had 5.60 span and 1.9493 area. Both fore-aft depth and span
now contribute to the flight silhouette.

The inner wings blend into the engine shoulders. Longitudinal hinge beams roll
the outer wings 180 degrees flat over the aft roof, onto raised seats that
accommodate panel thickness. Knuckles mark the fold axis. Underside paint
becomes the visible livery when folded. Deployment takes place with the bay
roof open / after launch; the intermediate raised-wing pose is not a parked
roof-clearance pose. This pass provides static folded/deployed review poses.

The 1.60-unit pressure door has moved half a unit forward, ahead of the wings,
and is recessed into a flat port hull section. The folded moving panels end
.47 behind the door leaf. The rear face now has a framed cargo/service hatch,
reinforcing ribs, a latch, a hinge beam, threshold markings, cooling grilles
and larger nozzle collars. No interior is modeled or visible.

The original v4 geometry, `shuttle()` entry point and review scripts are intact.
The current builder is `transport_shuttle(heading, state, dz=0, wing_fold=None)`
in `tools/blender/sprites/shuttle_craft.py`. Supporting geometry is in
`tools/blender/lib/transport_forms.py`, `transport_details.py` and
`transport_wings.py`.

## Measured envelope

| Quantity | World units / tiles |
| --- | --- |
| Parked width, including wings and hinge knuckles | 3.8249 |
| Parked length | 4.4000 |
| Height from landing feet, including stacked wing paint | 2.6400 |
| Flight wing span | 7.2000 |
| Fore-aft wing chord | 2.7000 |
| Placeholder pit depth below deck | 1.7000 |
| Highest point above deck | 0.9400 |
| Clearance to roof top at 2.05 | 1.1100 |
| Boarding opening height | 1.6000 |
| Folded moving-wing clearance ahead of boarding leaf | 0.4700 |

Height increases from B2's 2.40 to 2.64 with the stacked wing panels. The
placeholder pit increases from 1.50 to 1.70. Most of the craft remains below
deck; parked width leaves about .0875 per side inside a 4x5 pit. The bay
session owns its final depth, access and structure; the review room is a
scale placeholder, not bay module art.

Parked has legs down and dark nozzles. Flight has legs fully concealed and
wings deployed. Only nozzle interiors emit light. `docked` gives folded wings,
retracted legs and dark nozzles. Docking views and remaining rotations await
art approval.

## Livery

Primary paint is on both wing panels; secondary paint follows the engine
fairings, forebody and boarding leaf. Native sprite files preserve exact
`#ff0000` / `#00ff00` keys. Review boards and the beauty use muted blue
`#527593` / ochre `#c7a15e` instead. Paint has no glow. The review disables
Cycles mesh-light sampling on the colour-pass material so flat export-key
paint cannot spill red/green light onto the stacked folded panels. Nozzle
emission remains in the glow pass.

## Preview files

Current files are under `artifacts/shuttle-sweepback-r4/`. The B2 images remain
under `artifacts/shuttle-sweepback-r2/` for the before/after board. Earlier B3
previews remain under `artifacts/shuttle-sweepback-r3/`.

- `transport-B-planform-1x.png`, `-3x.png`: top views of folded/deployed wings,
  with a 4x5 bay outline and the actual fore-aft wing shape.
- `transport-B-silhouettes-1x.png`, `-3x.png`: matching-heading folded/deployed
  views, crew scale and flat silhouette comparison.
- `transport-B-before-after-1x.png`, `-3x.png`: B2 and B4 at the same pixel
  metric, direction and review livery.
- `transport-B-parked-1x.png`, `-3x.png`: r0 in the placeholder pit and room.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2 and rear d5 flight views.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw red/green export keys.
- `transport-B-beauty.png`, `transport-B-preview.blend`: low-sample beauty
  and editable review scene.
- `design.json`, `pixel-checks.json`: envelope, wing area, hatch clearance,
  nozzle-only glow, exact export keys, binary alpha and exact 3x checks.

Render only these review views, one Blender process at a time:

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r4"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r4" --compose
```

Four samples for sprites, eight for the beauty, Blender 4.3.2. No full sprite
build, production atlas rebuild, `src/` wiring or gameplay changes. Await user
sign-off before final-quality renders.
