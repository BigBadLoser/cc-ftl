# Transport B6 — shaped nose, angled wing mounts and aft-leaning ramp

Concept B remains separate from the rejected original v4 craft. Revision 6
keeps the approved wing shape: 7.20-unit span, 2.70-unit fore-aft envelope and
10.3982 square units of plan area. The nose, wing supports, crew hatch hardware
and stern receive the current review changes.

## Shape and access

The front windscreen narrows from .80 to .64 at its tip, with lower intermediate
stations and a smoother slope into the chin. The front hull narrows from 1.50
to 1.20, with a narrower crown bevel and thinner chin. The extended opaque
glazing remains; its front top is 1.54 above the landing datum.

Each wing has a raised structural mount with a flat seat at z=2.30, a sloping
front face and tapered sides. The front starts at u=.34 at its base (z=1.66)
and recedes to u=-.14 at the seat. Chamfered corners, an aft-raked rear edge
and angled nacelle nose caps carry the hull's lines through the raised step.
The wing hinge locations, moving panels and folded envelope are unchanged.

The 1.60-diameter crew pressure hatch keeps its circular flange, locking dogs
and handwheel. It adds an opaque inspection porthole above the wheel and a
compact pressure-equalisation control/valve with a short connection into the
ring. These additions do not emit light or reveal the cabin.

The stern slope is corrected: **the top projects aft, farther from the nose;
the lower ramp hinge is tucked forward underneath**. It leans 16 degrees from
vertical. The bottom-hinged ramp follows that face when closed. The lower keel
also tucks forward to clear the ramp. Review views show the ramp closed and
lowered, with traction ribs and reinforced edges. An opaque dark cap masks the
cabin when lowered; no interior is modeled or visible. The lowered ramp extends
beyond the stowed footprint and is shown separately from the placeholder pit.

## Measured envelope

| Quantity | World units / tiles |
| --- | --- |
| Parked width, including hinge knuckles | 3.8249 |
| Parked length | 4.9300 |
| Height from landing feet, including stacked paint | 2.6400 |
| Flight wing span | 7.2000 |
| Fore-aft wing envelope | 2.7000 |
| Placeholder pit depth below deck | 1.7000 |
| Highest point above deck | 0.9400 |
| Clearance to roof top at 2.05 | 1.1100 |
| Crew hatch opening diameter | 1.6000 |
| Wing clearance aft of circular leaf | 0.3800 |

All envelope and pit numbers remain unchanged from B5. Inside the centred 4x5
placeholder the rear clearance is .02, nose clearance .05 and side clearance
about .0875. Most of the craft stays below deck. The bay session owns its final
pit, loading access and structure; the review room remains a scale placeholder.

The outer wings roll 180 degrees over the aft roof on longitudinal hinge beams,
with knuckles and locking blocks. They lift onto thickness-clearance seats;
underside paint becomes visible when folded. Deployment takes place with the
bay roof open / after launch. This review contains static folded/deployed poses.

Parked: legs down, wings folded, dark nozzles. Flight: legs concealed, wings
deployed, nozzle glow active. Docked: legs concealed, wings folded, nozzles
dark. Remaining rotations and docking views await art approval.

## Builders and livery

Entry: `transport_shuttle(heading, state, dz=0, wing_fold=None, ramp_open=0)`
in `tools/blender/sprites/shuttle_craft.py`. Supporting geometry is under
`tools/blender/lib/`: `transport_forms.py`, `transport_details.py`,
`transport_wings.py`, `transport_mounts.py`, `transport_hatch.py` and
`transport_ramp.py`. Original v4 source and `shuttle()` remain unchanged.

Primary paint is on both wing panels; secondary follows the fairings and
forebody. Native files preserve exact `#ff0000` / `#00ff00` keys. Review boards
and beauty use muted blue `#527593` / ochre `#c7a15e`. Only nozzle interiors
populate glow. Export-key ink is camera-visible only in the review shader,
preventing red/green illumination of nearby hull surfaces.

## Review artifacts

Current files: `artifacts/shuttle-sweepback-r6/`. B5 remains in
`artifacts/shuttle-sweepback-r5/` for the before/after comparison.

- `transport-B-beauty.png`, `transport-B-preview.blend`: low-sample beauty
  and editable scene, showing the nose, airlock and angled wing mounts.
- `transport-B-parked-1x.png`, `-3x.png`: r0 in the 4x5 placeholder room/pit,
  with a 1.5-unit crew member on deck.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2 and rear d5 flight views.
- `transport-B-ramp-1x.png`, `-3x.png`: rear three-quarter closed/lowered ramp.
- `transport-B-silhouettes-1x.png`, `-3x.png`: folded/deployed forms and crew.
- `transport-B-planform-1x.png`, `-3x.png`: top views and 4x5 bay outline.
- `transport-B-before-after-1x.png`, `-3x.png`: B5/B6 at the same heading/scale.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw export-key colours.
- `design.json`, `pixel-checks.json`: envelope, actual closed-ramp slope,
  mount front rake/taper, lowered-ramp ground check, hatch clearance,
  nozzle-only glow, exact key colours, alpha and exact 3x checks.

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r6"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r6" --compose
```

One Blender process at a time, two threads, four sprite samples and eight
beauty samples, Blender 4.3.2. `--validate-only` runs the geometry checks from
`tools/blender/review/transport_geometry.py` without rendering. Preview art
only: no full sprite build, atlas, `src/` wiring or gameplay changes. Await user
sign-off before full renders.
