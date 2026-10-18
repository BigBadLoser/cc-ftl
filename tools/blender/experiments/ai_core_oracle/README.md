# ORACLE — AI core, two design revisions

Isolated look development. No gameplay, production models, shared palette, shipped
sprites or existing experiments are modified. The next approval gate is the look;
only r0 is rendered, with low samples. No optional running-loop animation yet.

**Revision 2 is the selected design.** A continuous cast casing forms a yoke
between the deck and ceiling. Its inset decision-graph display, replaceable
magenta cheek panels, service latch and rear data connectors preserve the first
preview's identity. The roof array now has two swept sensing wings and two
smaller ranging booms, giving the sensor a clearer hierarchy than four equal arms.
The casing sits directly on the ship deck; there is no floor plate or plinth.
Magenta paint remains visible without power. All unpowered screens are blank:
inactive glyph geometry is omitted, rather than merely turning off its glow.

The final selection restores the **v1 triangular display network with its upward
branch**, uniformly fitted to the taller current window. This graphic correction
preserves the selected housing, roof hatch and sensor geometry.

The two artistic passes are explicit model variants (`--revision 1` / `2`):

1. Extended split crown and four-paddle sensor. Render review exposed a stacked,
   top-heavy silhouette at the ceiling collar.
2. Continuous ceiling yoke, taller branching display and paired swept arrays.
   This integrates the deployment well into the primary casing and separates
   the major sensing surfaces from the smaller ranging booms.

The user's corrections (blank unpowered screens, an actual ceiling connection,
and a hatch that clears the mast) apply to both variants. They are independent
of the two artistic experiments. The original preview images/source snapshot
remain in `artifacts/ai-core-oracle/preview`; the revised studies are in
`revision-1` and `revision-2` beneath the same artifact directory.

## Geometry and IDs

- Footprint: `[2,2]`, fully blocked by gameplay. Art origin is the centre of the
  frontmost footprint tile. Footprint centre `(-0.5,-0.5)` in grid coordinates.
- Floor is z=0; casing reaches the ceiling at **z=2.4**, aligned with the roof.
  This uses the requested
  height, independently of the older 1.2-high production roof/wall builders.
- Hull-flush hatch is 1.6 x 1.6 with 0.12 chamfers: target plan area 2.5312 tiles,
  **63.28%** of the footprint. Closed leaf hardware is flush within 0.001 tiles.
- Six shutter leaves telescope into two shallow pockets beneath the roof rim.
  The shutter clears before the keyed mast rises. The sensing wings and ranging
  booms then extend/unfold, with tips lighting progressively. No upright hatch
  leaves remain beside the deployed mast. The final deploy pose equals active.
- The stowed shutters and permanent rim are flush within 0.001 tiles of z=2.4.
  Hidden shutter sections are clipped from the overlay sprite, preventing buried
  hardware from painting over the neighbouring roof.
- All four rotations are supported by the model's `rot` argument. Only r0 has
  been visually reviewed/rendered; approval precedes the remaining rotations.
- Module IDs: `module.ai_core.r0`, `module.ai_core.r0.active`.
- Roof IDs: `roof.ai_core.stowed`, `roof.ai_core.deploy.f0`–`f4`,
  `roof.ai_core`, `roof.ai_core.active`.
- No 30% ghost is baked in. Colour alpha is binary; runtime owns ghost opacity.
  Normal per-sprite anchors account for the real 2.4-high roof placement.
- `review.wall` and `review.roof` are review backdrops, not production assets.
  The wall is exactly 2.4 high. Crew/floor in pixel sheets are shipped assets.

The five deployment frames are pose samples for a runtime transition of about
2 seconds. Frame selection and reverse stow playback remain renderer concerns.

## Reproduce quick previews

Run from repository root with Blender 4.2 and the existing `sprites` pipeline.
The default is revision 2; pass `--revision 1` to reproduce the first experiment.
Use a fresh output directory to avoid mixing studies. Each job writes a fragment
manifest incrementally, so run jobs **sequentially**.

```bash
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/ai_core_oracle/render.py -- --out artifacts/ai-core-oracle/revision-2 --part module
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/ai_core_oracle/render.py -- --out artifacts/ai-core-oracle/revision-2 --part roof-a
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/ai_core_oracle/render.py -- --out artifacts/ai-core-oracle/revision-2 --part roof-b
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/ai_core_oracle/render.py -- --out artifacts/ai-core-oracle/revision-2 --part context
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/ai_core_oracle/render.py -- --out artifacts/ai-core-oracle/revision-2 --part beauty --save-blend
python tools/blender/experiments/ai_core_oracle/present.py artifacts/ai-core-oracle/revision-2
```

`present.py` requires numpy/Pillow. Sprite previews use four Cycles samples,
4x supersampling, palette mode downsampling, a one-pixel outline and the normal
glow pass. The Blender view uses 12 samples, shows the opaque assembled sensor
for mechanical review, and saves an editable `.blend`.
Review sheets include exact native pixels and exact nearest-neighbour 3x copies.

## Final sprite pack

With the design locked, use a fresh output directory:

```bash
bash tools/blender/experiments/ai_core_oracle/render_final.sh artifacts/ai-core-oracle/final
```

Set `BLENDER` and `PYTHON` if these executables are not on PATH. The final script
renders every module rotation, unpowered and active, at 24 samples; all eight roof
poses/states at 24 samples; and one assembled Blender view at 32 samples. It keeps
the approved camera, palette, 4x supersampling, outline and glow workflow.
It refuses an existing output directory and writes no production files.

The final `manifest.fragment.json` contains only the 16 requested AI-core assets.
Review wall/roof assets live in `review.manifest.json`. `present.py` merges these
only for review sheets and adds an `all-rotations-1x.png` / `-3x.png` contact sheet.
Gameplay footprint, ceiling-height migration, sprite registration, roof deployment
timing and ghost opacity remain runtime integration work; the art package supplies
the requested sprite IDs, anchors, colour and glow layers.

Main review outputs:

- `blender-active.png` and `oracle-preview.blend`
- `core-r0-review-1x.png` / `core-r0-review-3x.png` (unpowered beside active)
- `core-active-cutaway-3x.png` (review-only 30% ghost composited over the module;
  the supplied roof sprites themselves remain fully opaque)
- `mast-deploy-strip-3x.png` (stowed, f0–f4, fully active on roof patches)
- `manifest.fragment.json` and individual colour/glow sprite PNGs

No `common.md` was present in this checkout or the supplied attachment folder;
the explicit AI-core brief and this repository's camera/palette pipeline govern
this study. Production integration remains separate from this isolated art pack.
