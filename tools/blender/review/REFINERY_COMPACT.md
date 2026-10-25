# Fresh 3x4 refinery mockup

## Current: final standalone production pack

The user approved the geometry, materials, rotations and operating-state loop,
then authorized final export using the other modules' settings and sheet sizes.
The finished pack is `artifacts/refinery-production/`, with detailed handoff in
its `README.md`; the downloadable bundle is `artifacts/refinery-production.zip`.

Production uses current main e8c50906, which now ships 64x32-native art displayed
2x on the 128x64 grid. It uses the project-pinned Blender 4.2.9 LTS, SS4/four
samples, the shared camera/light defaults and standard `env_build` / `pack`
functions. It does not use the previews' SS2/shadow override or their Blender
4.3.2 binary. Historical 128x64-native previews below remain preserved.

There are 24 final frames in matching 4096x126 colour/glow atlases, with 31
manifest entries including aliases. The six states in each orientation share
one fixed frame size and front-most-tile anchor. The fragment header matches the
current 1x manifest. Shader, source and pipeline hashes are recorded.

The placement audit found the existing access [3,1] was at the wrong end. The
handoff requires [3,3]; no `src/` changes were made. `refinery_asset.py` moves the
console outward by 0.12 within the footprint for reach, retaining its height.
The geometry audit verifies that only those terminal vertices move, and that
the original approved geometry and material attributes otherwise match exactly.

The final atlas is validated pixel-for-pixel against the raw frames, with clear
gutters, matched glow layout, zero unpowered glow and correct rotated bounds.
`review/placement.png` composes the actual atlas with shipped crew/floor art at
the exported anchors. Final integration, state selection and application access
update remain a separate task.

## Preserved design iteration history

A preserves the v2 open-cradle model, parameters, Blender scene and render
byte-for-byte. The rejected wedge B has been removed. Its replacement is a new
upright pressure-vessel concept: a low roller hopper feeds the vessel's side,
an agitator motor sits on the dished pressure head, a side condenser connects
through broad return plumbing, and a circular die discharges into an open
inclined casting trough. A low cast chassis connects the main parts. The approved
B geometry now has a first industrial material pass, described below.

### B material preview

The user's ore-bin image establishes a muted industrial yellow as the shared
highlight language. This pass uses yellow `#b6a45d` on the feed bowl/shutter,
motor and receiver service covers, pressure clamps and one tactile control.
The large vessel remains blue-grey, with a lighter pressure lid, graphite chassis
and flanges, pale working steel for pipes/rollers, and a bright neutral billet.
The terminal has a dark screen and restrained self-lit cyan gauges.

The three principal changes against the grey reference are:

1. Blue-grey paint separates the pressure vessel from its dark structural joints.
2. Yellow identifies loading and service mechanisms, following the bin reference.
3. Pale steel distinguishes the material path and connected plumbing; the cyan
   display identifies the crew operating position.

Material roles live in `sprites/refinery_finish.py`; the `materials` parameter
switches between this finish and the grey study. The geometry builder only marks
roles: it does not change part positions or dimensions for the material pass.
`b-material-before.png`, `.json` and `.blend` preserve the approved grey reference.
The review loads that Blender reference and asserts equal vertex positions and
polygon topology before rendering. `b.json` records the matching result and a
vertex digest. `b-material-comparison.png` shows the two at the same camera/scale.

Native and 3x previews were inspected. Bounds remain **3.670 x 2.496 x 1.794**.
The initial material pass reviewed one angle; the user approved its colour
scheme. The four-orientation review is described below. No wear pass, full
sprite build or game integration. The existing crew scale image is retained
from the grey pass.

### Four-rotation review

`review/refinery_rotation_preview.py` renders r0–r3 in one sequential Blender
process, four samples per view, at 128x64 tile scale. Artifacts are in
`artifacts/refinery-rotations/`: native and 3x PNGs, measured bounds and deck
anchors per view, parameters, review metadata and `rotations.png` at matched
world scale. r1 is the previously approved camera angle.

`refinery_revision_b(..., rotation=...)` now accepts all four orientations.
Crosswise feed/output rollers inherit their parent orientation, and vertical
cylinder facets turn with their frames. The review checks every vertex against
a rigid rotation of the approved Blender model, plus identical topology and
material attributes. The r1 image is pixel-for-pixel identical to the approved
material preview. All orientations fit the rotated 3x4 footprint and stay below
1.85 high, without cropped geometry.

Visible limitations: the console faces the camera in r0/r1 and is largely hidden
on the far side in r2/r3. The outlet is also mostly behind the vessel in r3.
These are physical occlusions; components have not been repositioned per view.
The user approved the rotations. Operating/unpowered previews follow below;
production exports are still pending.

```sh
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_rotation_preview.py -- --out artifacts/refinery-rotations
python3 tools/blender/review/refinery_rotation_preview.py --out artifacts/refinery-rotations --compose
```

### Operating state previews

`review/refinery_state_preview.py` renders the approved r1 angle in powered idle,
four working poses and unpowered, including colour and glow passes. Only these
six review poses are rendered, in one sequential Blender process at four samples.
`artifacts/refinery-states/` contains native/3x PNGs, matching glow images, pose
metadata, `power-comparison.png`, `working-frames.png` and `working.gif` (4 fps).

- Powered idle is pixel-for-pixel identical to the approved material image.
- Working advances a billet from u=1.33 to 1.63 along the existing inclined
  rollers, jogs the feed shutter by up to 0.07, moves its piston/cleat with the
  leaf, and cycles the three large screen gauges. The one-second GIF represents
  repeating batches; a brief empty receiver pose separates consecutive billets.
- Unpowered blanks the screen with zero emission in the geometry and rendered
  glow pass. The four overlapping shutter leaves extend to the throat stop;
  the retained output billet represents material already on the stopped bed.

`sprites/refinery_operating.py` supplies `operating_pose(parameters, state, frame)`
without modifying the approved parameter set. `powered_feed` / `powered_output`
remain hardware-presence options; state changes use the helper's display,
gate and billet parameters. The machinery is unchanged outside these moving
parts and display faces. All poses retain the 3.670 x 2.496 x 1.794 bounds.

Review limits: only r1 state frames are rendered so far, and output collection
is represented by the empty receiver pose. The shutter jog is subtle at native size; the
moving billet and gauge changes carry the operating read. No runtime wiring,
full sprite build or production atlas export yet.

```sh
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_state_preview.py -- --out artifacts/refinery-states
python3 tools/blender/review/refinery_state_preview.py --out artifacts/refinery-states --compose
```

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

Mechanical-pass B bounds: **3.670 long x 2.426 wide x 1.794 high**. The rear feed throat
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

### B automated handling and operator terminal

The user asked for a crew terminal, powered feed gate and automated output
receiver, provided the additions read at 128x64 tile scale. The preceding pipe
pass is preserved as `b-automation-before.png` / `.json` and compared at the same
deck origin and camera in `b-automation-comparison.png`.

- A braced terminal arm attaches to the chassis beside the hopper. Its inclined
  screen uses a broad recessed bezel, charcoal inset and three large pale gauges;
  two tactile controls follow the screen's incline. There is no small lettering.
- A half-covering sliding shutter rides on raised hopper rails. The fixed
  cylinder and extended piston connect to the moving leaf's side cleat. One feed
  roller remains exposed in this static operating pose.
- Four powered rollers replace the output tray guides, with a side drive case
  and end stops. The smaller billet rests on their inclined tangent plane,
  leaving three roller positions substantially visible.

The first native render identified three clarity issues: the blank screen read
as a tray, the shutter leaves were too narrow, and the billet hid too much of the
roller bed. The next pass steepened the terminal face and added its neutral
screen contrast, broadened the gate leaves, and raised/exposed more of the
output rollers. Final native and 3x renders were inspected. The terminal reads
most strongly; the feed actuator remains a smaller supporting detail.

Current bounds: **3.670 long x 2.496 wide x 1.794 high**, inside 3x4 and under
the 1.85 walls. The vessel and corrected pipework are retained. The three additions
have independent `terminal`, `powered_feed` and `powered_output` parameters;
terminal placement is also adjustable. Preview only, without handling animation,
game integration or a full materials/sprite build.

### Lower console and crew scale review

The terminal pod, screen graphics and tactile controls move down exactly 0.15
units using `terminal_drop`. Its arm keeps the chassis mounting foot and lowers
the upper seat to meet the pod. Controls now top out at **0.874** and the screen
spans **0.856–1.117** above deck. The refinery's other geometry and dimensions are
unchanged. `b-console-before.png` / `.json` preserve the prior preview, and
`b-console-comparison.png` compares the two console heights.

`review/refinery_crew_preview.py` produces `crew-scale.png` (native),
`crew-scale-preview.png` (3x nearest neighbour) and measured `crew-scale.json`.
It uses the existing v2 game crew, idle frame 0, facing the terminal at grid
(-1.0, 1.90). The source outfit colours remain uncorrected. Crew use the nominal
1.5 game scale; the evaluated dressed figure measures about 1.555 with hair.
Feet are at z=0, the same deck datum as the refinery. Crew are review-only and
are absent from the standalone model/sprite.

```sh
# After the standalone preview; wait for its Blender process to finish first.
SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/review/refinery_crew_preview.py -- --out artifacts/refinery-ab
python3 tools/blender/review/refinery_crew_preview.py --out artifacts/refinery-ab --compose
```

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
