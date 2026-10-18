# ORACLE AI core — final art handoff

Selected form: revision 2 continuous ceiling casing and swept sensor wings.
Selected screen: the original v1 triangular node network and upward branch,
uniformly fitted to the taller current display. Unpowered screens are blank.
There is no module floor slab. The casing and hatch meet at z=2.4.

Final local output: `artifacts/ai-core-oracle/final/`.

`manifest.fragment.json` contains exactly 16 game-facing sprites:

- `module.ai_core.r0` through `r3`, each with an `.active` version;
- `roof.ai_core.stowed`;
- `roof.ai_core.deploy.f0` through `f4`;
- `roof.ai_core` and `roof.ai_core.active`.

Every entry has its own cropped frame and world-relative anchor, footprint
`[2,2]`, colour image and additive glow image. Roof anchors include the actual
2.4-unit elevation. Preserve these offsets; the origin is the centre of the
frontmost footprint tile, with module centre at `(-0.5,-0.5)` in grid space.
The final deploy frame matches the active fully deployed state exactly.

Colour/glow alpha is binary. The player-side 30% mast ghost is a runtime effect;
it is not baked into supplied sprites. The optional cutaway contact sheet
demonstrates that compositing only. Back views naturally hide the front readout.

Final sprites use 24 Cycles samples, the existing 4x supersampling and palette
downsampling, a 1px outline, and a separate glow pass. The assembled Blender view
uses 32 samples. Review roof/floor/wall/crew geometry is separate from the assets.
`review.manifest.json` contains review backdrops and must not enter production.

Reproduce with `bash tools/blender/experiments/ai_core_oracle/render_final.sh`
and a fresh output directory (see README for executable overrides). The model,
renderer and presenter depend only on this experiment and the shared Blender
pipeline, not other untracked experiments.

Review files:

- `blender-active.png`, `oracle-preview.blend`: assembled opaque physical view;
- `all-rotations-1x.png` / `-3x.png`: every module orientation, idle and active;
- `core-r0-review-1x.png` / `-3x.png`: installed context with wall and crew;
- `mast-deploy-strip-3x.png`: roof shutter and mast sequence;
- `core-active-cutaway-3x.png`: runtime-style ghost reference;
- `design.json`: dimensions, quality, selected graphic and render coverage.

This is an isolated asset pack. It does not change gameplay definitions, runtime
roof height, production sprite registration or deployment timing. Integrators
must reconcile older 1x1 AI-core content and 1.2-unit roof assumptions with the
requested 2x2 / 2.4-unit contract. No existing Claude or production files changed.
