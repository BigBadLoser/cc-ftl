# Fresh 3x4 refinery mockup

## Current: v2 grey geometry

The user found the first case too square. The revised blockout replaces the full
box with a raised, faceted processing vessel on separated cradles, a canted
offset loading hopper, a tapered feed throat and a lower projecting die/receiver.
Broad pressure bands follow the vessel's changing cross-section. A large return
manifold connects a small side pump, with open space around the support frame.
There are no lights, paint groups, display panels or surface decorations.

- Model: `sprites/refinery_blockout.py`, parametric `RefineryBlockout`.
- Review: `review/refinery_blockout_preview.py`.
- Artifacts: `artifacts/refinery-compact-v2/preview.png`, native/3x grey sprites,
  parameters and measured bounds. `comparison.png` shows v1 and v2 in the same
  single grey material, at identical camera and world scale. `blockout.blend`
  contains the editable grey model and review camera.
- Bounds: approximately **3.690 long x 2.584 wide x 1.719 high**. Fits 3x4 and
  remains below the 1.85 wall height.
- Geometry review uses the project sun with shadows enabled on both versions
  to expose overlaps and gaps. Camera, 128x64 scale, four samples and SS 2 remain
  unchanged. No room or floor plane.
- Shape/layout preview only. The hopper, chamber proportions, open supports and
  outlet are still available for iteration. No integration or full sprite build.

```sh
# Check no Blender process is running first.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_blockout_preview.py -- --out artifacts/refinery-compact-v2
python3 tools/blender/review/refinery_blockout_preview.py --out artifacts/refinery-compact-v2 --compose
```

## Earlier v1 — retained

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
