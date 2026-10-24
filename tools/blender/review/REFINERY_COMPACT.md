# Fresh 3x4 refinery mockup

Independent concept requested by the user after the reference-led 3x5 study.
One enclosed processing hood joins a loading hopper to an output die/drawer.
The radiator, coolant line and control bezel are attached to the same case.
Orange hood, cool grey body, dark service recesses and restrained status lights.
No detached stacks, separate machines or floor slab.

- Model: `sprites/refinery_compact.py`, `refinery_compact(CompactRefinery(...))`.
- Current preview: `artifacts/refinery-compact-v1/preview.png`; native render,
  nearest-neighbour 3x sprite, dimensions and editable parameters alongside it.
- Footprint: 3 short x 4 long. Local grid x is the long axis for this review.
  Origin at footprint centre/deck height; game anchoring and rotations deferred.
- Model bounds: approximately 3.785 long x 2.640 wide x 1.600 high.
- Project camera: ortho, 45-degree yaw, 30-degree elevation; native 128x64 tiles.
  Four samples, SS 2, two CPU threads, one Blender process at a time.
- Preview only: proportions, cover shape, hopper and output treatment are open
  to iteration. No production build, atlas, manifest or `src/` changes.
- Burnt-orange paint is registered only in the review process, without emission.
  Only the warm process indicators and cyan control display emit.

```sh
# Check no Blender process is running first.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_compact_preview.py -- --out artifacts/refinery-compact-v1
python3 tools/blender/review/refinery_compact_preview.py --out artifacts/refinery-compact-v1 --compose
```
