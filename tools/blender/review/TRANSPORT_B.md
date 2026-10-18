# Transport B13 — earlier upper width, narrower base, outward flare

Concept B remains separate from the rejected original v4 shuttle. The upper wall
edges return to their B11 widths. The lower walls move inward beneath them,
keeping B12's 6-degree outward flare. At mid-nose, the upper wall is 1.6662 units
wide and the lower wall is 1.2828. Geometry checks assert that the upper edges
match B11 and are wider than the base. Existing plan taper and symmetry remain.

The round hatch is rigidly fitted to the narrower side wall. A short mounting
sleeve joins its flat flange to the hull profile; no interior is visible.
The canopy, wings, mirrored fairings and rear ramp retain their geometry.

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

The full nose walls retain their plan taper. Outward flare is anchored to B11's
upper wall edge at every loft station, instead of widening the upper body around
the hatch-centre height. This keeps the earlier slim upper outline and narrows
the base. The lean blends into the aft cabin between stations -0.55 and 0.50.
The forebody livery follows the same surface. The hatch retains its true circular
1.60 diameter; its flat flange has a hull-conforming mounting sleeve.

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

Current files: `artifacts/shuttle-sweepback-r13/`. B12 remains under
`artifacts/shuttle-sweepback-r12/` for the before/after comparison.

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
- `transport-B-before-after-1x.png`, `-3x.png`: B12/B13 at the same heading/scale.
- `transport-B-nose-plan-1x.png`, `-3x.png`: B12/B13 in top view, showing the
  taper along the full wall and the aligned circular hatch.
- `transport-B-symmetry-1x.png`, `-3x.png`: top view beside the audit silhouette
  with the hatch hidden and centre line marked.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw export-key colours.
- `design.json`, `pixel-checks.json`: envelope, actual mesh wing pitch/sweep,
  measured nose wall lean, corrected rear slope, lowered-ramp ground check,
  hatch clearance, nozzle-only
  glow, bilateral polygon/paint symmetry, export keys, alpha and exact nearest-neighbour 3x checks.

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r13"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r13" --compose
```

One Blender process at a time, two threads, four sprite samples and eight
beauty samples, Blender 4.3.2. `--validate-only` runs the geometry checks in
`tools/blender/review/transport_geometry.py` without rendering. Preview art only:
no full sprite build, atlas, `src/` wiring or gameplay changes. Await user sign-off
before full renders.
