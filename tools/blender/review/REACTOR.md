# Reactor — 4x3 reference reconstruction

## Current review: primary geometry study

The initial detailed v1 below is preserved for comparison, but is **not** the
accepted reconstruction. The current work uses `sprites/reactor_blockout.py`
and `reactor_study.py`, following [REFERENCE_WORKFLOW.md](REFERENCE_WORKFLOW.md).
It is a neutral blockout for review, not finished game art.

Reference analysis: four curved jacket bays separated by five transverse hoops;
an arched front cage around a recessed circular plug; three slender service
units with exposed loop pipes; a wider controller displaced outboard near the
rear. The far side, rear closure and hidden pipe routes cannot be determined
from this view. The study assumes an elliptical arch over short vertical sides,
a sealed rear and simple connections behind the cabinets.

Every pass has a raw native-128 render, parameter snapshot, geometry metadata,
side-by-side comparison, annotated comparison and landmark-error report in
`artifacts/reactor-study/`. The supplied reference is preserved unchanged in
`artifacts/reactor-reference/reference.jpg`. No room, crew or beauty render.

| Pass | Comparison findings: three largest discrepancies | Subsequent correction |
| --- | --- | --- |
| A | Casing too tall/broad relative to length; service bank too far rearward/outboard; end plug too large, low and proud. | B lengthens/narrows/lowers the shell, moves and slims the bank, enlarges the controller and recesses the smaller plug. |
| B | Front is a solid annulus rather than a cage; hoops too thin; box pedestals obscure the reference's exposed service loops. | C adds structural cage pockets, thicker hoops and separate pipe loops/round feet. |
| C | Front rim crest too low; cage pockets too shallow in projected height; cage exterior lacks closed thickness. | D expands only the front cage and closes its outer edges, preserving the casing and service bank. |
| D | Cage openings still too narrow/divided; circular plug lacks the reference's dished/stepped profile; service/controller housings lack their compound shapes. | Remain visible for review. Mechanical detailing and material finishing have not begun. |

### Measurements and limitations

Comparison uses the unchanged project camera (45-degree yaw, 30-degree
elevation), four samples and SS 2. One uniform scale and translation fit the
two barrel-end silhouette peaks. No rotation, stretch or image warp is used.
Reference landmarks are manual estimates with approximately four reference
pixels of uncertainty. They are not a solved camera calibration.

The front datum was initially picked on the jacket crest, then corrected to
the actual front-rim crest at reference pixel `(574, 205)`. All saved comparisons
use that same corrected datum. Other picks are recorded in each comparison JSON.

| Error in reference pixels | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| Rear/front silhouette peaks, each | 6.8 | 6.1 | 6.1 | 2.4 |
| Plug center | 31.8 | 4.9 | 5.6 | 5.0 |
| Three service top centers, range | 62.5–87.9 | 0.1–3.2 | 0.1–3.2 | 3.2–7.3 |
| Controller top center | 43.8 | 0.1 | 0.1 | 4.5 |

D's larger front rim changes the normalization fit, so the bank's reported
errors rise despite unchanged bank geometry. These sparse landmarks measure
placement, not surface/topology accuracy; the remaining cage and housing
discrepancies matter even where point errors are small. The first two fitted
landmarks are alignment constraints, not independent validation.

Current D bounds: **4.000 x 2.710 x 1.390** world units. Fits the proposed 4x3
footprint; feet at zero and top below 1.85. Height is derived from the reference
blockout rather than the taller v1. No floor slab.

```sh
# Check that no Blender process is running before each render.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/reactor_study.py -- --pass-name blockout-d --out artifacts/reactor-study
python3 tools/blender/review/reactor_study.py --pass-name blockout-d --out artifacts/reactor-study --compare
```

Use `blockout-a`, `blockout-b` or `blockout-c` to reproduce earlier passes.
The study has no lights, vents, fasteners, labels or final palette. Original
reactor content and production assets remain untouched.

## Earlier detailed v1 — retained, not approved

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
