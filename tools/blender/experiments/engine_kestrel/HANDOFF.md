# Claude handoff — approved Heavy Kestrel

The user approved **stage 7** and asked for the source to be published so you
can do the full renders later. Preserve this design. The included reference
PNGs were rendered before the handoff; publishing does not run another full
render or integrate the asset into gameplay.

## Keep these decisions

- Four tiles along the hull, five tiles deep. Local u=-2.5..2.5, v=-2..2;
  +u points outboard. The hull row is u=1.5..2.5, centred at u=2.
- One bell, outer mouth diameter 2.6 tiles. Its metal ends at u=4, exactly
  1.5 tiles past the footprint. Narrow throat, flared skirt, tapering jacket
  relief, slimmer beveled exit ring. Dark open mouth when idle.
- Heavy casing and cast supports, with restrained brass, pipework, service
  hatches, gauges and bolted unions. Supports and mounting lugs sit directly
  on the ship's deck at z=0. **Do not restore the separate floor/base plate.**
- The engine replaces its hull row. Its own armoured bulkhead is always full
  height; there is no cut-down engine hull layer. Neighbouring walls may cut
  down independently. Actual production wall pieces form the two butt joints.
- Hull first, machine second, at one world anchor. Each cropped layer has its
  own anchor offset. Machine rendering uses the hull as a Cycles holdout.
- r0=-gridY, r1=+gridX, r2=+gridY, r3=-gridX. Footprint is [4,5] for r0/r2 and
  [5,4] for r1/r3. Sprite origin is the frontmost footprint tile centre.
- Active core and cyan plume use a separate additive pass. There is no opaque
  cyan cone in the colour sprite. Exhaust is a static art-directed volume;
  animation and physics are not implemented.

## Preserve other work

This is an additive handoff based on repository commit `c44def7`. All added
files live under `tools/blender/experiments/engine_kestrel/`. No existing
Claude builder or review script is replaced. The model imports shared toolkit
modules (`core`, `detail`, `greeble`, `cmbkit`, `walls`, `post`, `compose`), but
never calls `engine_proto` or the JANUS/BRONTES experimental builders.

Fetch `art/heavy-kestrel-approved` and inspect/cherry-pick its single handoff
commit onto your working branch when ready. Do not reset or overwrite your
working branch to take the asset. Adapt toolkit integration if your branch
has newer helpers, while preserving the approved model and layer contract.

## Full rendering later

Use the repository-pinned **Blender 4.2.9 LTS**. Sprite/geometry rendering uses
Blender's bundled numpy. Presentation Python needs numpy and Pillow. Set
`BLENDER_BIN` and `PYTHON_BIN` to installed executables; the repository's
`tools/blender/setup.sh` can install Blender if needed.

From the repository root, choose a **new, unused output directory**:

```sh
BLENDER_BIN=/path/to/blender PYTHON_BIN=python3 \
  bash tools/blender/experiments/engine_kestrel/render_all.sh \
  /tmp/kestrel-full
```

That renders all four rotations sequentially, including hull, machine idle
and machine active: **12 asset IDs**, each with colour and glow PNGs. It writes
`manifest.fragment.json`, runs geometry/PNG checks with `--require-complete`,
and creates native/3x layer composites. Installation previews beside shipped
deck/walls/crew are implemented for r0/r1 only; r2/r3 still get correct native
composites. Extend those installation layouts separately if needed.

To also produce idle/active Blender views and editable scenes in all four
rotations, set `KESTREL_BEAUTY=1` on that command. Optional `KESTREL_THREADS`
defaults to 6. The wrapper refuses an existing output path and never copies
anything into `public/assets` or changes the production manifest.

For a single job, the underlying commands are:

```sh
# Full sprite layer set for one rotation; repeat with --rot 1, 2, 3.
blender -b -t 6 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/engine_kestrel/render.py -- \
  --out /tmp/kestrel-full --stage 7 --rot 0 --no-beauty

# Optional one-view Blender review.
blender -b -t 6 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/engine_kestrel/render.py -- \
  --out /tmp/kestrel-full --stage 7 --rot 1 --no-sprites \
  --beauty-state active --save-blend
```

The renderer emits exactly:

```text
module.engine.hull.r{0..3}
module.engine.machine.r{0..3}
module.engine.machine.r{0..3}.active
```

Use the resulting fragment for an explicit later integration. Do not replace
`public/assets/manifest.json` with this fragment; it contains only this engine.
The cached branch used for the art review had the older engine contract, so
reconcile placement/content definitions with the current gameplay branch.

## Validation and remaining work

The approved stage was checked visually in r0/r1 and at native pixel scale.
Actual geometry in all four rotations passed footprint, 2.6-tile mouth,
1.5-tile protrusion, full-height wall-end and deck-contact checks. The palette
and binary alpha of the available r1 idle reference passed. A separate audit
confirmed the last pass preserved the powerhead, service hardware and hull,
removed the legacy floor and brought mounting supports to the ship deck.

`approved/manifest.fragment.json` intentionally contains **only r1 hull and
r1 machine idle**. Do not treat it as evidence that all states were rendered.
The final stage-7 active state and r2/r3 raster views still need the full render
and visual inspection. Earlier-stage active previews are not substitutes.

The included reference can be rechecked without rendering:

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/engine_kestrel/validate.py -- \
  tools/blender/experiments/engine_kestrel/approved
```

Run `validate.py -- /tmp/kestrel-full --require-complete` after the full set.
Inspect all four directions, additive exhaust over space, same-anchor layer
assembly, and the unchanged full-height engine hull beside cut walls before
installing production art. The design itself is approved; no merge or atlas
replacement is included in this handoff.
