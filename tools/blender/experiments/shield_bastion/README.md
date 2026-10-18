# BASTION / WARD — shield generator look development

First approval preview only: r0, low samples, active states static. No gameplay,
production art, shared palette, existing experiments or other worktrees changed.

## Design

**BASTION**, 2x3: a heavy longitudinal conditioning bank with two cast return
yokes, a front-facing seven-cell resonator and a continuous ceiling feed well.
The roof assembly is a central hex emitter surrounded by six hinged hex petals.
It rises as a compact bundle, then opens into a shallow collecting dish.

**WARD**, 2x2: a squat pressure casing with an upward-facing seven-cell lens and
one swept structural spine. Its roof projector is a two-prong field fork: two
telescoping pylons separate and extend inward-curving emitter claws around a
central lens. It is deliberately not a scaled copy of BASTION.

Both echo the approved shield-console motif: one centre hex plus six neighbours.
The centre is the main light source; surrounding cells are much dimmer. Visible
cyan is controlled emission geometry, not paint. Housing is grey/navy/dark teal.
Unpowered references have only a tiny pilot light. There are no floor slabs or
module plinths: the lower mass is the casing itself, with a narrow kick recess.

## Contract

- Large footprint `[2,3]` at r0/r2, `[3,2]` at r1/r3. Small is `[2,2]`.
- Body and roof share the frontmost footprint-tile origin, with centre at
  `(-0.5,-1)` for large r0/r2, `(-1,-0.5)` for large r1/r3, and `(-0.5,-0.5)`
  for every small rotation. All builders accept `rot=0..3`; only r0 is rendered.
- Floor z=0; ceiling/roof z=**2.4**. Both bodies carry a physical feed structure
  to this plane. Existing production 1.2-high roof builders are not used.
- BASTION target: chamfered 2.4x1.6 hatch, cut 0.16, area 3.7888 / 6 = **63.15%**.
- WARD target: regular hexagon of radius 0.95, area 2.3448 / 4 = **58.62%**.
- Stowed hatch top is flush within 0.001 units of the roof plane. BASTION uses
  nested sliding shutters; WARD uses three radial iris leaves. Hidden sections
  are clipped to the aperture and no door remains upright around the emitter.
- Five deployment samples: hatch parts first, emitter rises, heads unfold, then
  the field core energises at the fully deployed endpoint (about 2 seconds at
  runtime). No shield bubble is baked into these sprites.
- `deploy.f4` equals fully deployed `.active`. `roof.<id>` is deployed/unpowered.
- Colour and glow alpha are binary. Supply normal roof sprites: runtime applies
  the 30% ghost on the player ship. No opacity reduction is baked into the art.

Preview IDs in `manifest.fragment.json` (20 total):

- `module.shield_gen.r0` / `.active`;
- `module.shield_gen_small.r0` / `.active`;
- `roof.shield_gen.stowed`, `.deploy.f0`–`f4`, `roof.shield_gen`, `.active`;
- the equivalent eight `roof.shield_gen_small...` entries.

Review backdrops are isolated in `review.manifest.json`, not the game-facing
fragment. Every cropped sprite has its own world-relative anchor and glow layer.

## Reproduce

From repository root with Blender 4.2 and Python with numpy/Pillow:

```bash
bash tools/blender/experiments/shield_bastion/render_preview.sh artifacts/shield-bastion/preview-fresh
```

Set `BLENDER` / `PYTHON` executable paths if needed. Use a fresh output directory.
Jobs run sequentially: each updates the same fragment manifest. Interior sprites
use 4 samples, roof sprites 8, Blender views 12, with the established orthographic
camera, 4x supersampling, palette mode downsampling, 1px outline and glow pass.

The Blender views show opaque physical assemblies for mechanical review. Native
context sheets show the interior module itself beside shipped floor/crew sprites
and an exactly 2.4-high wall. Roof strips are on patches at z=2.4. Exact 3x images
use nearest-neighbour enlargement.

Main outputs:

- `blender-large.png` / `blender-small.png`, editable matching `.blend` files;
- `blender-both.png`, side-by-side comparison of the two Blender renders;
- `large-review-1x.png` / `-3x.png`, unpowered beside active;
- `small-review-1x.png` / `-3x.png`;
- `both-modules-review-1x.png` / `-3x.png`;
- `large-deploy-strip-3x.png` / `small-deploy-strip-3x.png`;
- individual colour, glow and additive preview sprites under `sprites/`.

## Visual review

The first assembled and native renders exposed partially buried cell clusters.
The large resonator was brought forward and its hex casing aligned; the small
lens was raised until all seven cells survived at native size. Roof review then
changed WARD's forward-facing heads into inward-curving claws, strengthening
its field-projector identity and distinction from the large dish.

Small-lens clearance follow-up: the complete WARD panel moves 0.14 units along
its outward normal and seats on a narrower dark hex socket. Its front bezel's
lowest corner is now z=1.206, above the casing lid at z=1.16. The updated Blender
view, native states and contact sheets are in
`artifacts/shield-bastion/hex-clearance/`; the initial preview is preserved.
For a targeted rerender, `--part modules --size small` updates only WARD's states.

Other rotations, final sample counts and optional running pulses await look
approval. No `common.md` was present in this checkout or the attachment folder;
the explicit brief and established camera/palette pipeline govern this study.
Older production generator footprints and roof heights remain untouched.
