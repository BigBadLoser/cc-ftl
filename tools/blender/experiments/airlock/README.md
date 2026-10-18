# AIRLOCK / 01 — first art review

An isolated 1×4 hull airlock built on `art/low-ceiling-modules` at `9b89fbf`.
Source is procedural Blender geometry. No gameplay, content definition, shared
wall builder, palette, production atlas or production manifest is changed.

## Design

- **Row 0: outer door.** Full 1.85-high blue-grey/ochre pressure hatch on the
  hull line, replacing that hull tile. Its skirt meets the 0.38-high sloped
  hull profile, with the upright wall core at ±7/32. The outer hatch keeps its
  full height beside cut or ghost hull neighbours, as Kestrel's bulkhead does.
- **Rows 1–2: chamber.** A fully enclosed, opaque pressure tube with continuous
  walls and a bevelled roof. The tube stays intact in every wall view, including
  cutaway and shortest. **Only an open door reveals the interior.** Equalisation
  hardware, large painted roof chevrons and warning strips identify the entry.
- **Row 3: inner door.** Dusty-rose portal with thinner telescoping leaves.
- Both thresholds have yellow/black hazard markings. The module has **no floor
  slab**: the deck in installation views is review context only.
- The heavy outer hatch has three telescoping steel leaves per side, the
  inner door two. They retract into separate tracks within the jamb. The open
  lane is at least 0.62 wide, with a 1.59-high aperture.
- Red = locked, green = open; amber = cycling. The preview cycle keeps both
  doors shut for 4 seconds before opening the opposite door. Unpowered and
  broken poses close both doors and remove all glow. These are art poses and
  an animation demonstration; simulation logic is not implemented here.

Four rotations are supported and checked for geometry, footprint and every
door pose. This first review renders **r0 and r1** at four sprite samples.
Camera and pixel metric are unchanged: 64×32 tiles, 4× supersampling,
palette quantisation, binary colour alpha and separate additive glow.
The local paint swatches in `materials.py` provide dusty rose and hull ochre
without changing other art. They are written to `palette.airlock.json` for handoff.

## Review files

In `artifacts/airlock-preview/`:

- `airlock-installations-1x.png` / `-3x.png`: r0/r1 with hull and shipped crew,
  in walls-up, cutaway and shortest/ghost views.
- `airlock-full-*`, `airlock-cut-*`, `airlock-ghost-*`: separate wall-view pairs.
- `airlock-doors-inner-*`, `airlock-doors-outer-*`: closed, half-opening, open
  and cycling poses for both rotations, at native and exact nearest-neighbour 3×.
- `airlock-cycle.gif`: interlocked entry/exit demonstration with 4-second waits.
- `blender-airlock.png`, `airlock-preview.blend`: low-sample Blender view and
  editable scene. The chamber stays enclosed in this view too. `raw/` includes
  the dark, closed unpowered pose.
- `sprites/`, `manifest.fragment.json`: independent sealed tube, door
  leaves, door status and cycling overlays. This is an experimental fragment,
  not a drop-in production atlas.
- `geometry-validation.json`, `pixel-validation.json`: footprint, open lane,
  closed opposite door, no slab, palette, alpha, dark power-off and 3× checks.

## Regenerate

Requires Blender with Cycles, NumPy, and presentation Python with NumPy/Pillow.
This preview was rendered with Blender **4.3.2** (available in this environment).
Use the repository's pinned **4.2.9 LTS** for a final production render after
review and compare the images before adopting its outputs.

```sh
BLENDER_BIN=blender PYTHON_BIN=python3 \
  bash tools/blender/experiments/airlock/render_preview.sh \
  "$PWD/artifacts/airlock-preview"
```

Render individual layers for other rotations or higher sample counts:

```sh
blender -b -t 4 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/airlock/render.py -- \
  --out /tmp/airlock-final-new --rot 0 1 2 3 --part layers --samples 24
```

## Layer contract for later integration

All layers share the world anchor at the front-most footprint tile; cropped
images each carry their own pixel anchor. r0 faces north, r1 east, r2 south,
r3 west. The rotated footprint is `[1,4]` or `[4,1]`.

1. `module.airlock.r{r}` is the complete opaque pressure shell: both sidewalls,
   roof, machinery and portal frames. It contains no leaves, status light or
   floor. Keep it opaque and unchanged in every wall view.
2. `module.airlock.inner.r{r}.closed|open|opening.f{0..2}|closing.f{0..2}`
   and matching `outer` IDs are independent leaves. Opening progress is
   20%, 50%, 80%; closing references those same images in reverse order.
   Portal holdouts mask the telescoping leaves inside their tracks.
3. `module.airlock.r{r}.status.sealed|inner-open|outer-open` carries independent
   door status lamps. `module.airlock.r{r}.cycling.f{0..1}` has red lock lamps
   plus alternate amber warning strips. Hide these for power-off/failure.
4. Adjacent hull can cut to 0.38 or ghost at 24% alpha with a dark tint.
   **The entire airlock tube, both portals and the outer hull hatch remain
   full-height and opaque.** Native sprite PNG alpha stays binary; ghosting
   adjacent hull is a runtime operation and is not baked into this module.
   Draw the opaque tube above adjoining hull ghost overlays.

The full-frame raw review renders are the visual source of truth. Integration
must preserve depth ordering with crew inside the chamber and honour the
two-door interlock in simulation. Production integration follows art approval.
