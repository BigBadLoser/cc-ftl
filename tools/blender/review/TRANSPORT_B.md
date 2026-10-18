# Transport B5 — swept-wing shuttle review

Concept B remains a separate craft from the rejected original v4 model. Revision
5 keeps the large 7.20-unit wing span and 2.70-unit fore-aft wing envelope, with
swept leading edges, narrower tips, thicker roots and thinner outer panels.
Wing plan area is 10.3982, versus B4's 11.4692: taper changes the outline while
retaining the broad overall footprint. The roots now join directly into sloped
engine shoulders; the tall rectangular storage platforms are removed.

Longitudinal hinge beams roll the outer wings 180 degrees flat over the aft
roof. Two substantial knuckles and locking blocks mark each fold axis. The
outer panels lift onto thickness-clearance seats, and underside paint becomes
the visible livery when folded. Deployment takes place with the bay roof open /
after launch. Static folded/deployed review poses are provided here.

## Access, cockpit and stern

The former rectangular crew door is replaced by a circular pressure hatch with
a 1.60-unit opening diameter, a bevelled flange, recessed opaque leaf, eight
locking dogs, a three-spoke handwheel and lower hazard arcs. It is ahead of the
wings: the leaf starts .38 forward of their foremost point, and the outer rim
starts .26 forward of it. A reshaped forebody accommodates the round pressure
opening. The canopy extends down the nose to u=2.43 and z=1.58, versus B4's
front z=1.92, with a continuous dark windscreen and thin flush frame/mullion.

The central rear face now leans 16 degrees from vertical. Its loading hatch is
a bottom-hinged ramp with a framed aperture, hinge knuckles, reinforcing edges,
traction ribs and threshold markings. Review views show it shut and lowered.
An opaque dark cap masks the cabin in the lowered view; no interior is modeled
or visible. Cooling grilles and reinforced nozzle collars remain at either side.
The lowered ramp extends beyond the stowed envelope, requiring loading access
outside the parked footprint; it is not shown deployed inside the pit placeholder.

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
| Circular crew hatch opening diameter | 1.6000 |
| Wing clearance aft of circular leaf | 0.3800 |

Height and pit depth remain unchanged from B4. The longer nose and swept-back
wings now use 4.93 of the 5-unit bay depth, with .02 clearance at the rear and
.05 at the nose in the centred placeholder. Most of the craft stays below deck.
The bay session owns its final depth, loading access and structure; the review
room remains a scale placeholder.

Parked: legs down, outer wings folded, nozzles dark. Flight: legs concealed,
wings deployed, nozzle glow active. Docked: legs concealed, wings folded,
nozzles dark. Remaining rotations and docking views await art approval.

## Builders and livery

The requested entry point is `transport_shuttle(heading, state, dz=0,
wing_fold=None, ramp_open=0)` in `tools/blender/sprites/shuttle_craft.py`.
Supporting geometry is in `tools/blender/lib/transport_forms.py`,
`transport_details.py`, `transport_wings.py`, `transport_hatch.py` and
`transport_ramp.py`. Original v4 source, `shuttle()` and reviews are unchanged.

Primary paint is on both wing panels; secondary paint follows the engine
fairings and forebody. Native files preserve exact `#ff0000` / `#00ff00` keys.
Review boards and beauty use muted blue `#527593` / ochre `#c7a15e`. Only nozzle
interiors populate the glow channel. Export-key ink is camera-visible only in
the review shader, preventing red/green light spill onto nearby hull surfaces.

## Review artifacts

Current files: `artifacts/shuttle-sweepback-r5/`. B4 remains under
`artifacts/shuttle-sweepback-r4/` for the before/after comparison.

- `transport-B-parked-1x.png`, `-3x.png`: r0 in the 4x5 placeholder room/pit,
  with a 1.5-unit crew member on deck.
- `transport-B-flight-1x.png`, `-3x.png`: d0, d2 and rear d5 flight views.
- `transport-B-ramp-1x.png`, `-3x.png`: rear three-quarter closed/lowered ramp.
- `transport-B-silhouettes-1x.png`, `-3x.png`: folded/deployed forms and crew.
- `transport-B-planform-1x.png`, `-3x.png`: top views with the 4x5 bay outline.
- `transport-B-before-after-1x.png`, `-3x.png`: B4 and B5, same heading/scale.
- `transport-B-export-keys-1x.png`, `-3x.png`: raw export-key colours.
- `transport-B-beauty.png`, `transport-B-preview.blend`: low-sample beauty
  and editable review scene.
- `design.json`, `pixel-checks.json`: envelope, hatch/wing clearance, lowered
  ramp ground check, nozzle-only glow, key colours, alpha and exact 3x checks.

```sh
blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/transport_preview.py -- --out "$PWD/artifacts/shuttle-sweepback-r5"
python3 tools/blender/review/transport_preview.py --out "$PWD/artifacts/shuttle-sweepback-r5" --compose
```

One Blender process at a time, two threads, four sprite samples and eight
beauty samples, Blender 4.3.2. `--validate-only` runs the geometry checks without
rendering. This is preview art only: no full sprite build, production atlas,
`src/` wiring or gameplay changes. Await user sign-off before full renders.
