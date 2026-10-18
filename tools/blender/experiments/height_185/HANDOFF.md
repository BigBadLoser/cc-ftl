# Claude handoff: low-ceiling module art

Branch: **`art/low-ceiling-modules`** in `BigBadLoser/cc-ftl`.
Based on the previous approved Kestrel handoff commit
`d391f5a5cf13413db2828f25818a2f8b4bbab89c`; all changes in this handoff are
additions. No production or existing Claude files are overwritten or deleted.
No merge or gameplay integration is included.

Fetch this branch, inspect its latest commit, and cherry-pick that commit onto
your own branch when ready. Do not reset your working branch to this branch.
All new height builders are self-contained within their experiment directory,
using only the shared sprite toolkit and palette from the repository.

## Current choices

**Wall height is 1.85. Roof plane is 2.05.** Do not use the wall height as the
roof height. Roof mechanisms retain their original size and deploy from 2.05.
The 2.4-height original AI and shield builders are also included and preserved.

| Asset | Current source | State |
| --- | --- | --- |
| ORACLE AI core | `../ai_core_oracle_h185` | Shorter ceiling casing; preferred v1 triangular graph retained; idle screens blank |
| BASTION shield | `../shield_bastion_h185` | Lower yokes and ceiling feed; seven-cell resonator unchanged |
| WARD small shield | `../shield_bastion_h185_ward_lowbody` | **Use this revision.** User approved lower 0.86 casing, full-size clear hex face and restored long swept spine |
| Heavy Kestrel engine | `../engine_kestrel_h185` | Lower inboard cassette, full 1.85 bulkhead, original round 2.6 bell outside hull |

`../shield_bastion_h185` also retains the earlier short-spine WARD for history;
do not use that WARD when assembling the final pack. The lowbody folder keeps
an identical BASTION and identical roof projectors, so its renderer can produce
both current shield modules together. JANUS is outside this height update.

## Review material

`review/` contains compact Blender and pixel references, design metadata and
validation reports. Models, rather than opaque `.blend` files, are the source
of truth. Full-quality sprite packs and editable scenes can be regenerated.
The local art iteration history was not uploaded wholesale.

- `kestrel-comparison.png`: approved original beside the new height variant.
- `kestrel-full-1x.png`, `kestrel-cut-1x.png` and their exact 3x versions:
  hull/machine idle and active at r0/r1, with real shipped crew and floor tiles.
  Context uses local 1.85 full walls and 0.38 cut walls. The engine's own wall
  remains full height in both views.
- `ward-comparison.png` and `ward-pixels-3x.png`: approved lower-casing WARD.
- `ai-core-3x.png`, `shield-large-3x.png`, `shield-small-3x.png`: idle/active.
- `ai-deploy-3x.png`, `shield-large-deploy-3x.png`,
  `shield-small-deploy-3x.png`: roof deploy frames at Z=2.05.
- `height-comparison-1x.png`: preserved 2.4 originals beside height variants;
  its WARD is the earlier short-spine version, superseded by the WARD references.

Kestrel has r0/r1 low-sample sprites, all-rotation geometry checks and idle
Blender views. Full active Blender views and final-quality r2/r3 remain for the
complete render. This is deliberately not a production atlas.

## Rendering later

Use Blender **4.2.9 LTS**. Presentation Python requires numpy and Pillow. Keep
the shared palette, isometric camera, 64x32 tiles, binary colour alpha and
separate additive glow. No module has an accessory floor slab or wide plinth.
Normal roof sprites are opaque; runtime applies the 30% ghost in player cutaway.

For the complete Kestrel pack, use a fresh directory:

```sh
BLENDER_BIN=/path/to/blender PYTHON_BIN=python3 \
  bash tools/blender/experiments/engine_kestrel_h185/render_all.sh \
  /tmp/kestrel-h185-final-new
```

That renders all 12 engine IDs and validates all rotations. Set
`KESTREL_BEAUTY=1` for Blender views and `.blend` scenes too.

The AI renderer supports final quality and four module rotations:

```sh
blender -b -t 6 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/ai_core_oracle_h185/render.py -- \
  --out /tmp/oracle-h185-final-new --part module --rot 0 1 2 3 --quality final
```

Repeat `--part roof-a`, `roof-b`, `context` and optionally `beauty` for the
complete AI pack; use `--quality final` on each job. `--save-blend` saves the
beauty scene. Run that folder's `present.py` after rendering.

For shield previews, `height_185/render_preview.sh` now uses the approved WARD.
For a complete shield pack, the current renderer supports all rotations and
final-quality samples without changing the approved geometry:

```sh
blender -b -t 6 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/shield_bastion_h185_ward_lowbody/render.py -- \
  --out /tmp/shields-h185-final-new --part modules --rot 0 1 2 3 --quality final
```

Repeat with `--part roof-large-a`, `roof-large-b`, `roof-small-a`,
`roof-small-b`, `context` and optionally `beauty --size large` / `beauty --size
small`. Then run that directory's `present.py`. It builds r0 installation
sheets; the other rotations remain correctly anchored individual sprites.
Keep both roof deployment sequences and the five-frame timing unchanged.

The Kestrel bell intentionally extends above the roof **outside** the hull.
Do not squash it to 2.05: preserve its circular section, cone profile, lip,
2.6 diameter and 1.5 protrusion. Only inboard hardware must fit the ceiling.

## Validation

- Repository `npm run check`: lint, typecheck, 25 test files / 138 tests pass.
- AI/shield geometry: all four rotations, footprint bounds, wall/roof height,
  every roof pose, target coverage and correct WARD lens clearance.
- WARD: restored original spine translated down 0.35, unchanged hex geometry
  translated down 0.30, 0.046 lid clearance, same roof projector.
- Kestrel: all four rotations, inboard ceiling bounds, direct deck contact,
  no old floor slab, round bell in both axes, protrusion, full wall end profiles,
  binary alpha, palette, additive exhaust and same-anchor layer assembly.
- Raster reviews use native scale and exact nearest-neighbour 3x.

No production manifest, content definition, sprite atlas or gameplay constant
is updated. Reconcile those explicitly on the gameplay branch after rendering.
