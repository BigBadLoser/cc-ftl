# Refinery production asset

Final standalone export of the approved 3x4 refinery. The pack is ready for
integration; it has not been merged into the live manifest or wired into `src/`.

## Contents

- `1x/sprites/refinery.png` and `refinery.glow.png`: matching **4096x126** atlases.
- `1x/manifest.fragment.json`: standard static-asset entries for all rotations and
  states. **24 unique frames**, **31 entries** including zero-cost aliases.
- `1x/animations.json`: four-frame working loop for each rotation, 4 fps.
- `1x/frames/`: normalized native frames, matching glow PNGs and pose metadata.
- `1x/refinery.blend`: editable r0 idle model, saved with Blender **4.2.9 LTS**.
- `1x/settings.json`: exact render configuration, pipeline/model hashes and
  provenance. `parameters.json`, `layout.json` and `integration.json` carry the
  production dimensions, placement and required application changes.
- `review/`: final states, animation, placement with shipped crew/floors,
  approved-preview comparison, atlas validation and geometry audit.
- `reference/`: the approved design preview and its parameters, for comparison.
- `tools/`: the model, export adapter, exporter and verification source.
- `CHECKSUMS.sha256`: checksums for the complete unpacked package.

## Render settings and size

The export uses the current main pipeline at **e8c50906**, including its renderer,
post-processing, standard prop crop/outline and atlas packer. Current main ships
**64x32 native art** in `public/assets/1x`; the game displays it **2x** on its
128x64 grid. The earlier design reviews were 128x64-native previews. These final
sprites are freshly rendered at the current native size, not resized previews.

| Setting | Production value |
|---|---|
| Blender | 4.2.9 LTS, the version pinned by `tools/blender/setup.sh` |
| Supersampling / Cycles samples | 4x / 4 |
| Camera | Orthographic, yaw 45 degrees, elevation 30 degrees |
| Lighting | Shared sun 3.9, ambient 0.15, standard shadows disabled |
| Colour management | Standard / None, no dithering |
| Post-processing | Economy palette + refinery entries; standard 1px prop outline |
| Atlas | Standard packer; 4096 maximum side; transparent 1px gutters |
| Footprint / maximum height | 3x4 tiles / 1.7939 units, below 1.85 walls |

Each rotation has a fixed frame size and anchor across all six states:

| Rotation | Native frame | Floor anchor |
|---|---|---|
| r0 | 159x117 | (70,124) |
| r1 | 175x123 | (106,130) |
| r2 | 159x124 | (57,125) |
| r3 | 175x117 | (101,118) |

The anchor is the **front-most footprint tile centre at deck height**. An anchor
can lie below the visible crop because that footprint corner contains no model
geometry. Keep these anchors as exported; do not centre or clamp them. The
renderer places sprites directly using these values. Rotated footprints are
[3,4], [4,3], [3,4], [4,3].

## Asset IDs and state selection

- `module.refinery.rN`: powered idle.
- `module.refinery.rN.active`: working frame 0; valid static fallback.
- `module.refinery.rN.active.f1` through `.f3`: remaining working frames.
- `module.refinery.rN.active.f0`: alias of `.active`.
- `module.refinery.rN.unpowered`: display off, no emission, feed isolated.
- Bare `module.refinery`, `.active` and `.unpowered` alias r0.

Working advances the billet to the receiver, then includes an empty collection
beat before the next batch. Only the terminal emits. Unpowered frames retain a
stopped billet and have completely empty glow frames. Use `animations.json` for
the ordered frame IDs, fps and loop flag.

## Placement and integration handoff

1. Copy the atlas twins into `public/assets/1x/sprites/` and **merge** the fragment's
   sheets/assets into the existing 1x manifest. Do not replace the whole manifest.
2. Keep footprint **[3,4]**, but set `module.refinery.access` to **[3,3]**, replacing
   the current [3,1]. That is the operator tile next to this console. The rotated
   offsets are [3,3], [0,3], [-1,0], [3,-1].
3. Select `.unpowered` explicitly when power is unavailable. While crafting,
   advance the `.active` frame sequence using the game animation clock; otherwise
   select powered idle. The current module chain resolves `.active` statically
   but does not yet select these unpowered/animation variants automatically.
4. Face the operator toward the terminal. The placement review uses existing
   game crew/floors at the exported anchors and the renderer's depth ordering.

The production adapter moves the console **0.12 tiles outward** to put the
controls within reach. Its outside edge stays inside the footprint by 0.02;
controls remain at 0.874 high. The nearest control is 0.662 units from the access
tile centre in every rotation. The original access [3,1] points toward the wrong
end. Application content has deliberately not been changed in this art package.

`refinery_geometry_audit.py` matches the approved model's exact vertex digest in
the pinned pipeline, then proves that only the terminal upper arm/pod/controls
move outward. Height and material attributes are unchanged. No crew, floor tiles
or room geometry are included in the exported asset.

## Review and verification

- `review/placement.png`: four rotations on the shipped floor grid, with crew
  at the required access tiles. Cyan marks the footprint; yellow marks access.
- `review/states.png` and `review/working.gif`: final packed states and loops.
- `review/preview-vs-final.png`: approved design vs final at the same world scale.
  Differences are the coarser current native art size, standard shadow settings,
  and the small console reach adjustment.
- `review/validation.json`: exact atlas/frame round trips, clear gutters, equal
  colour/glow layouts, display-only glow, zero unpowered emission, aligned frame
  sets, footprint bounds, header compatibility and access checks.
- `review/geometry-audit.json`: approved geometry preservation audit.

## Rebuild

Use a main checkout at e8c50906 (full revision in `settings.json`) and its pinned
Blender. Run only this asset, one Blender process at a time:

```sh
REFINERY_PIPELINE=/path/to/main-checkout
REFINERY_BLENDER=/path/to/blender-4.2.9-linux-x64/blender
env -u SPRITE_SS -u SPRITE_SAMPLES SPRITE_PREVIEW=0 "$REFINERY_BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/export_refinery.py -- --pipeline "$REFINERY_PIPELINE" --out 1x
python3 tools/blender/validate_refinery.py --package 1x --pipeline "$REFINERY_PIPELINE" --report review/validation.json
python3 tools/blender/review/refinery_export_review.py --package 1x --pipeline "$REFINERY_PIPELINE" --approved reference --out review
"$REFINERY_BLENDER" -b -t 2 --factory-startup --python-exit-code 1 --python tools/blender/refinery_geometry_audit.py -- --pipeline "$REFINERY_PIPELINE" --approved reference --report review/geometry-audit.json
```

Use `refinery_asset.build` for production anchoring and access placement. The
historical `refinery_revision_b` builder is centred for design reviews. The export
driver resumes matching rendered frames and rebuilds only this package; it does
not run the full sprite build or change the application.
