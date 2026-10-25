# Fresh 3x4 refinery mockup

## Current: A/B grey geometry

A preserves the v2 open-cradle model, parameters, Blender scene and render
byte-for-byte. The rejected wedge B has been removed. Its replacement is a new
upright pressure-vessel concept: a low roller hopper feeds the vessel's side,
an agitator motor sits on the dished pressure head, a side condenser connects
through broad return plumbing, and a circular die discharges into an open
inclined casting trough. A low cast chassis connects the main parts. All surfaces
still use one grey material, without emission.

### B mechanical refinement (after concept selection)

The chosen B blockout is now the geometric reference. `b-blockout.png` and its
anchor metadata preserve that approved render; `b-refinement-comparison.png`
shows it beside the current model at identical camera, deck anchor and scale.
The 1.82-diameter pressure vessel, hopper rim, feed/outlet positions and overall
height remain unchanged. A remains byte-for-byte preserved.

The three main changes visible in the comparison are:

1. The upper pressure joint is split into two physical flanges with a 0.025 gap.
   Four shaped clamp castings replace the isolated square studs. The motor has
   four cooling ribs, retaining its original axis and envelope.
2. The loading well is deeper and has larger internal clearance, with shaft
   bearings and a shared drive housing attached to the hopper's near cheek.
3. Seven spaced condenser fins replace the broad solid side face. Pipe sockets
   describe the condenser connections, and the die has six fasteners. Guides
   and billet now follow the actual slope of the output trough.

Current B bounds: **3.670 long x 2.426 wide x 1.794 high**. The rear feed throat
remains partly obscured in this angle; the broad pressure lid remains a strong
shape. This is still a low-sample grey mechanical preview, without a materials
pass or production sprite build.

### B pipe seating correction

Feedback identified pipework overhanging its terminating geometry. The prior
mechanical preview is retained as `b-pipes-before.png` with its anchor metadata;
`b-pipes-comparison.png` compares that reference against the current render.

The three main corrections are:

1. The upper condenser connection moves inward from the collector's end and
   enters a supported pad on its top face. The pipe terminates inside the header.
2. The lower condenser connection leaves a thick end collector through its end
   face, with the pipe end buried in that collector instead of grazing the edge
   of the thin lower header.
3. Both vessel connections use radial necks embedded in the wall. The upper one
   is below the lid joint. Their collars and pipe sections are coaxial; straight
   segments continue through each fitting before the bends begin.

Pipe section frames now carry their orientation through bends, avoiding the
previous reference-axis switch near vertical. `pipe-contact-review.json`
records a diagnostic check of terminal rings against the faceted vessel and
bevelled collectors: the four ends and two collector-side collar backs all have
positive receiving-solid clearance. Vessel, hopper, output and overall bounds
remain unchanged. Still grey, four samples, one Blender process at a time.

- B model: `sprites/refinery_revision_b.py`, parametric `VesselRefinery`.
- Review: `review/refinery_ab_preview.py`. Only B is rendered; A is copied from v2.
- Artifacts: `artifacts/refinery-ab/comparison.png` at matched camera, world scale
  and deck origin; `a.png` / `b.png` native sprites, nearest-neighbour 3x images,
  editable `a.blend` / `b.blend`, parameters and measured bounds alongside them.
- Chosen B blockout bounds: **3.670 long x 2.431 wide x 1.794 high**, within 3x4
  and below 1.85. Mechanical refinement bounds are listed above.
- The rejected B's model, parameters and renders were replaced; its older `b0.*`
  files were deleted. Git history retains the earlier work.
- A render SHA-256: `8b2207881ccf6773aea0c488ed56bfc738213beaa5513d8d42d04f6c371c32a9`.
- First new blockout review found three issues: a solid outlet cap, unsupported
  condenser and a knob-like top drive. The second pass opened a real recessed
  die bore, added condenser feet/supports and a vessel sump, and replaced the knob
  with a horizontal agitator motor. The vessel proportions and feed geometry
  were preserved during those corrections.
- Remaining concerns: the broad pressure flange dominates the top, and the rear
  feed throat is partly obscured by the vessel in this angle. This remains a
  geometry study. No materials pass, game integration or full sprite build.

```sh
# Check no Blender process is running first.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_ab_preview.py -- --out artifacts/refinery-ab
python3 tools/blender/review/refinery_ab_preview.py --out artifacts/refinery-ab --compose
```

## Preserved A: v2 grey geometry

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
