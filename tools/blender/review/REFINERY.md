# Refinery — 3x5, one-angle preview

Current preview: `artifacts/refinery-study/colour-f.png` (native 128x64 tile
scale), `.3x.png` (nearest-neighbour), `.comparison.png` (supplied reference
beside the render), and `.landmarks.png` (manual reference landmarks).
Model: `tools/blender/sprites/refinery.py`. Review: `refinery_preview.py`.

## Reference analysis before modelling

The first, smaller image specifies the geometry; the larger sheet supplies
the broader style language. It is not a request to combine the other machines.

- Three large square, chamfered mouths form the highest row. Heavy rims surround
  deep rectangular wells; these are actual openings, not dark top faces.
- Three smaller square mouths form a lower staggered row above the near-side
  machinery. A recessed channel separates the rows.
- Three exposed horizontal drum/roller bays have repeated circumferential ribs.
  Sloped braces separate the bays and tie into a long armour rail.
- Bulky end assemblies comprise sloped front/back housings and a taller central
  service column, rather than one solid rectangular block.
- Orange painted armour, blue-grey structural bodies, lighter steel rims and
  drums, small warm light bands. Thick bevels and broad facets; restrained details.
- The image leaves hidden pipe routing, the far-side mechanism and the function
  of the square mouths ambiguous. Deep process openings are the current working
  interpretation. No speculative tanks, ore piles or smokestacks were added.

User corrections override the initial interpretation: the footprint is **3x5**,
and the three large stacks are **centred across the machine**, at local v=0.
Their long-axis positions are u=(-1.02, 0, 1.02), centred along its length too.
The lower mouths are at v=0.58 and the drums at v=1.14, on the near side.

## Iterative comparisons

Every pass saves parameters, a native render, a 3x preview, side-by-side boards
and JSON measurements. Historical A/B use the original 3x4 constraint; C onward
use the corrected 3x5. Their parameter snapshots preserve historical geometry.

| Pass | Three main findings | Correction / remaining work |
| --- | --- | --- |
| A, neutral blockout | Large mouths have long chimney-like necks; small mouths are too far forward/left; ends are undivided solid masses. | B shortens visible necks, staggers the lower mouths and splits the end masses. |
| B, neutral | End assemblies are cramped and hide the third small mouth; drums lack their structural ribs; the end faces lack the reference bevels. | C applies the user's 3x5 correction, extending the ends while retaining bay positions. |
| C, neutral | Open gaps beside the end pods; smooth drums; hard-edged end housings. | D adds connecting shoulders, rib geometry and bevels. |
| D, mechanical | Large stacks were incorrectly rear-biased; near-side placement must remain correct when moving them; the far-side/end volumes need to surround the central row. | E applies the user's centred-stack correction, preserving relative row spacing and rebuilding the surrounding end/chassis geometry. |
| E, centred neutral | Material groups are undifferentiated; warm light bands are absent; secondary end/service shapes remain simplified. | F adds only basic material grouping and light bands. Secondary forms remain unfinished. |
| F, colour preview | End armour needs a more layered profile; stack necks are still boxier than the reference; drum axles and side machinery remain simplified. | Current preview for user iteration. No final build or integration. |

Placement comparison: after one uniform scale/translation fit to the first and
third large-mouth centres, A's lower-mouth errors were 34–38 reference pixels
and drum errors 22–25. B onward reduces those to approximately **1–4 pixels**.
The manual picks have approximately 3px uncertainty in a small, compressed
300x167 image. The two fit points are alignment constraints, not independent
validation. Sparse centre landmarks do not establish silhouette/topology accuracy.
Camera/projection differences and hidden geometry remain uncertain.

The comparison does not warp, stretch or rotate the render. It uses the project
camera throughout: ortho, yaw 45 degrees, elevation 30 degrees. The right-hand
image is composed directly at display resolution to preserve native render pixels.
Source reference files remain unchanged in `artifacts/refinery-reference/`.

## Preview limits and reproduction

- Actual F bounds: **4.798 long x 2.844 wide x 1.620 high** world units.
  The entire model fits 5 long x 3 wide; top remains below 1.85.
- Origin: footprint centre at deck height. Local u maps to grid x for this single
  preview; game rotation and front-tile anchoring are deferred to integration.
- Structural sills and machine chassis only; no deck/floor slab, room or crew.
- CPU Cycles, four samples, SS 2, two threads, one Blender process at a time.
- Paint is a local non-emissive orange (`#d77b29`), registered only in the study
  process. The production palette and sprite renderer are unchanged. Only the
  small light bands emit. No glow sheet/full atlas is built in this review.
- No `src/`, module definitions, manifest, production atlas or game wiring changes.
  Main reference geometry and process meaning still need user review.

```sh
# First check that no Blender process is running.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_preview.py -- --pass-name colour-f --out artifacts/refinery-study
python3 tools/blender/review/refinery_preview.py --pass-name colour-f --out artifacts/refinery-study --compare
```

For each revision: identify the three largest geometry discrepancies, change
only those components, render, generate a new side-by-side and compare again.
Prioritize silhouette, proportions and topology. Preserve correct geometry.
Never use paint/details to conceal a geometry error. Hold full rendering and
integration until the preview is approved.
