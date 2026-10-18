# Transport B12 — nose walls flare outward: top wider than base

Concept B remains separate from the rejected original v4 shuttle. The nose wall
lean is reversed from B11: both sides now flare outward by 6 degrees as they
rise, making the top wider than the base. The circular hatch rolls with the wall.
The existing plan-view taper, mirrored fairings, canopy, wings and rear ramp
remain. The one-sided hatch and its interrupted nose stripe are the only
bilateral exceptions.

The mirror audit compares every raw polygon's geometry and paint with its
reflection, without the hatch, in parked, flying, docked and lowered-ramp poses.
The wall check additionally asserts that each measured upper edge lies farther
from the centre than its lower edge. Measured upper/lower widths are recorded
in design.json. A top-view silhouette hides the hatch for visual inspection.

## Wing shape and attitude

The leading edge sweeps rearward about 40 degrees. Broad roots lead into long,
narrower tips, retaining the 7.20-unit span and a 2.75-unit local fore-aft wing
envelope. Wing plan area is 9.1130, compared with B5/B6's 10.3982: the taper
removes area at the tips while preserving the broad overall reach.

The entire wing assembly, including its hinge axis, is pitched -6 degrees:
the leading edge is lower and the trailing edge rises aft, following the hull
line. The wing rest retains B5's shape; both forward fairing ends stop at station 0.22
to keep the hatch clear. A narrower paint break
at the fold joins the visual shape into one swept wing per side.

The outer panels still roll 180 degrees over the aft roof, with thickness
clearance and underside paint visible when stowed. Deployment happens with
the bay roof open / after launch. Static folded/deployed review poses only.

## Cockpit, hatch and ramp

The full nose walls retain B9's 6.84-degree taper in top view, starting at longitudinal
station 0.50 with a half-width of 1.05. Half-width is 0.93 at station 1.50 and
0.84 at station 2.25, before meeting the existing 0.60-wide tip. These widths
are measured at the hatch-centre height. Both wall edges follow the taper.
Each wall now flares outward 6 degrees about
the hatch-centre height of 1.30, leaving a narrower lower cheek and
broader upper shoulder. The lean blends into the aft cabin between stations
-0.55 and 0.50. The circular hatch uses rigid yaw and roll to seat flush on the
wall, retaining its true 1.60 diameter and opaque leaf. The forebody livery
follows the same leaning surface.

The windshield and small forward corner chamfers retain B8's geometry. The long
canopy taper and thin central mullion remain; no cabin interior is visible.

The 1.60-diameter crew pressure hatch keeps its flange, locking dogs and small
manual handwheel. Its six radial ribs now project only 0.015 units rather than
0.037, and use medium grey instead of bright hull paint. They read as leaf
reinforcement without dominating the circular opening. The removed porthole
and external control box stay removed.

The stern remains corrected: its upper edge projects aft, farther from the nose,
with the lower ramp hinge tucked forward underneath. It leans 16 degrees from
vertical. Review views show the bottom-hinged loading ramp closed and lowered,
with traction ribs and reinforced edges. The lowered view retains an opaque
dark cap; no interior is visible. Loading requires space beyond the stowed
footprint and is reviewed separately from the placeholder pit.

## Measured envelope

| Quantity | World units / tiles |
| --- | --- |
| Parked width, including hinge knuckles | 3.8249 |
| Parked length | 4.8999 |
| Height from feet, including tilted folded wings | 2.7643 |
| Flight wing span | 7.2000 |
| Local fore-aft wing envelope | 2.7500 |
| Placeholder pit depth below deck | 1.8000 |
| Highest point above deck | 0.9643 |
| Clearance to roof top at 2.05 | 1.0857 |
| Crew hatch opening diameter | 1.6000 |
| Nose wall taper in plan | 6.84 degrees |
| Nose wall outward flare | 6.00 degrees |
| Wing clearance aft of circular leaf | 0.3108 |

The wing attitude raises stored height from B6's 2.64 to 2.7643. The placeholder
pit consequently increases from 1.70 to 1.80. Most of the shuttle stays below
deck, and the stowed craft fits the centred 4x5 pit. The bay session owns its
final depth, access and structure; this room remains a scale placeholder.

Parked: legs down, wings folded, dark nozzles. Flight: legs concealed, wings
deployed, nozzle glow active. Docked: legs concealed, wings folded, nozzles
dark. Other rotations and docking views await art approval.

## Builders and livery

Entry: `transport_shuttle(heading, state, dz=0, wing_fold=None, ramp_open=0)`
in `tools/blender/sprites/shuttle_craft.py`. Supporting geometry is under
`tools/blender/lib/`: `transport_forms.py`, `transport_details.py`,
`transport_wings.py`, `transport_hatch.py` and
`transport_ramp.py`. Original v4 source and `shuttle()` remain unchanged.

Primary paint occupies the wing panels; secondary follows the fairings and
starboard forebody. Native files retain exact `#ff0000` / `#00ff00` keys.
Review boards and beauty use muted blue `#527593` / ochre `#c7a15e`. Only nozzle
interiors populate glow. Export-key ink is camera-visible only in the review
shader, preventing red/green illumination of nearby hull surfaces.

## Review artifacts

Current files: `artifacts/shuttle-sweepback-r12/`. B11 remains under
`artifacts/shuttle-sweepback-r11/` for the before/after comparison.

- `transport-B-beauty.png`, `transport-B-preview.blend`: low-sample beauty
  and editable scene, showing tapered/outward-flared nose walls, the aligned hatch and swept wings.
- `transport-B-wing-attitude-1x.png`, `-3x.png`: top and side views showing
  rearward sweep and the wing plane's six-degree aft rake.
- `transport-B-parked-1x.png`, `-3x.png`: r0 in the 4x5 placeholder room/pit,
  with a 1.5-unit crew member on deck.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2 and rear d5 flight views.
- `transport-B-ramp-1x.png`, `-3x.png`: rear three-quarter closed/lowered ramp.
- `transport-B-silhouettes-1x.png`, `-3x.png`: folded/deployed forms and crew.
- `transport-B-planform-1x.png`, `-3x.png`: top views with a 4x5 bay outline.
- `transport-B-before-after-1x.png`, `-3x.png`: B11/B12 at the same heading/scale.
- `transport-B-nose-plan-1x.png`, `-3x.png`: B11/B12 in top view, showing the
  taper along the full wall and the aligned circular hatch.
- `transport-B-symmetry-1x.png`, `-3x.png`: top view beside the audit silhouette
  with the hatch hidden and centre line marked.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw export-key colours.
- `design.json`, `pixel-checks.json`: envelope, actual mesh wing pitch/sweep,
  measured nose wall lean, corrected rear slope, lowered-ramp ground check,
  hatch clearance, nozzle-only
  glow, bilateral polygon/paint symmetry, export keys, alpha and exact nearest-neighbour 3x checks.

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r12"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r12" --compose
```

One Blender process at a time, two threads, four sprite samples and eight
beauty samples, Blender 4.3.2. `--validate-only` runs the geometry checks in
`tools/blender/review/transport_geometry.py` without rendering. Preview art only:
no full sprite build, atlas, `src/` wiring or gameplay changes. Await user sign-off
before full renders.
