# Wall 1.85 / roof 2.05 art variants

Separate variants of ORACLE, BASTION and WARD. The original 2.4-height
sources and rendered assets remain intact. No production sheets, manifest,
wall builder or gameplay constants are changed. Engine and JANUS are outside
the original AI/shield preview pack. The subsequent Kestrel variant and full
publication handoff are documented in [HANDOFF.md](HANDOFF.md).

- `../ai_core_oracle_h185`: ORACLE's continuous casing reaches the 2.05 roof.
  The foot below 0.4 is unchanged; the upper casting and screen are shorter.
  The preferred v1 triangular display graphic keeps its aspect ratio.
  Unpowered screens remain blank; non-emissive magenta paint remains visible.
- `../shield_bastion_h185`: both resonators retain their exact face geometry.
  BASTION's return yokes and neck are shorter. WARD's swept spine is lower;
  its corrected lens and mounting socket are unchanged.
- All three roof mechanisms deploy from 2.05, translated down 0.35 with
  unchanged footprint, target coverage, shutter motion and deployed proportions.
  Their normal sprites remain opaque; runtime can apply the 30% cutaway ghost.
- Review walls end at **1.85**, independently of the **2.05** roof plane.
  The 0.20 difference is intentional. Crew and floor tile scale is unchanged.

The variant directories contain independent copies of the procedural builders
and renderers. Shared sprite primitives, palette and camera still come from
`tools/blender/sprites`. Keeping them at the same directory depth preserves
the original import and project-root conventions.

## Rebuild

From the repository root, with Blender 4.2.9 and Python with numpy/Pillow:

```sh
BLENDER=blender PYTHON=python3 bash tools/blender/experiments/height_185/render_preview.sh artifacts/height185-review-new
blender -b -t 6 --factory-startup --python-exit-code 1 --python tools/blender/experiments/height_185/validate.py
```

The rebuild guard requires a new output directory. This is an r0 low-sample
review pack: idle/active module sprites, all roof deployment frames, Blender
renders and editable `.blend` scenes. The wrapper now uses the approved
`shield_bastion_h185_ward_lowbody` revision. AI and current shield renderers
support all four module rotations and `--quality final`. Final-quality
rendering and production integration remain separate from this review.

Current review output: `artifacts/wall-1.85-roof-2.05/`, with `ai-core/` and
`shields/` subdirectories. `preserved-originals.sha256.json` records original
source/artifact hashes. `geometry-validation.json` checks all four rotations,
footprints, ceiling contacts, wall heights, every roof pose and lens clearance.
`compare.py` generates the Blender overview, original/variant native comparison
and pixel checks (binary alpha, matching frames/anchors, exact 3x, blank idle AI
and identical deployment endpoints). It is included in the rebuild script.

The AI Blender stand-in is now the same 1.55-unit crew height as the shields
and actual shipped crew sprites. The original AI beauty's stand-in was shorter;
use the native comparison for a consistent crew and floor scale between packs.
