# WARD — lower casing / restored spine

Separate revision of the 1.85 wall / 2.05 roof shield pack. All earlier models
and review outputs are preserved. BASTION and the roof mechanisms are unchanged.

WARD's pressure case now ends at 0.86 instead of 1.16. The full-size hex face
and its mounting socket move down 0.30, retaining 0.046 clearance above the lid.
The spine recovers the original 2.4-version sweep and full length: translated
down 0.35, its roots seat inside the lower case and its top still meets 2.05.
The maintenance panel and return line move with the shorter casing. Footprint,
floor contact, colour hierarchy and seven-cell motif are unchanged.

## Review / rebuild

Current output: `artifacts/wall-1.85-roof-2.05/ward-lowbody/`.
`ward-comparison.png` compares the previous height variant with this revision.
`small-review-1x.png` and `small-review-3x.png` show idle and active at exact
native scale with the shipped crew, deck and 1.85-high wall.

From the repo root, using Blender 4.2.9 and Python with numpy/Pillow:

```sh
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/shield_bastion_h185_ward_lowbody/render.py -- --out artifacts/ward-lower-case-new --part beauty --size small --save-blend
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/shield_bastion_h185_ward_lowbody/render.py -- --out artifacts/ward-lower-case-new --part modules --size small
```

The current review folder retains copies of the unchanged BASTION, roof frames
and context sprites from the previous pack so its manifest is self-contained.
For a complete fresh pack, use this renderer for the same parts listed in
`../height_185/render_preview.sh`, then run this directory's `present.py`.
No production assets or gameplay files are changed. Only r0 is rendered for
review; the renderer also accepts `--rot 0 1 2 3 --quality final` for the complete
module set, including the swapped [3,2] BASTION footprint at r1/r3. Roof parts
use their single renderer IDs. Final sprite passes use 24 samples.

`validate.py` runs in Blender and checks all four rotations, footprint, deck
contact, ceiling height, lens clearance and the restored spine dimensions.
`compare.py` runs in Python from the repo root to rebuild the current comparison
images and check pixel alpha, exact 3x and the unchanged sprites in this pack.
