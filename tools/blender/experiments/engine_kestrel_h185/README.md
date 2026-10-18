# Heavy Kestrel — wall 1.85 / roof 2.05 variant

Separate adaptation of the approved stage-7 engine. The original
`../engine_kestrel` remains intact. No production assets, shared wall builder
or gameplay constants are changed.

- The engine's full-height hull ends now meet **1.85-high** walls. This folder's
  `hull_walls.py` is a private copy of the current hull profile with that height;
  full and cut context tiles use it too, so the butt joints match exactly.
- The inboard power cassette retains its footprint and width, with a lower,
  broad upper casing. Its vertical section is fitted around the thrust axis;
  the forward end blends back into the round throat. The service cover and
  close-coupled feeds fit below the **2.05** roof. Integral supports still bolt
  directly to the deck; the central saddle and sump support the lower case.
- The thrust axis is at **1.30**. The bell, circular bearing and exhaust move
  down together by 0.12. The approved nozzle is not scaled: its mouth remains
  **2.6 tiles across in both axes**, with a **1.5-tile metal protrusion**.
  Its outboard upper lip reaches 2.60, outside the roof footprint. All inboard
  metal stays at or below 2.05; the full-height bearing reaches that plane.
- The engine bulkhead always stays full height beside cut-down neighbours.
  The hull and machine still render separately at the same world anchor.
- Floor contact, brass details, pipework, gauges, valves, dark idle mouth and
  additive active exhaust are retained. No separate floor plate is introduced.

## Claude: complete rendering later

Blender 4.2.9 LTS; presentation Python requires numpy and Pillow.

```sh
BLENDER_BIN=/path/to/blender PYTHON_BIN=python3 \
  bash tools/blender/experiments/engine_kestrel_h185/render_all.sh \
  /tmp/kestrel-h185-final-new
```

The output directory must be new. This renders all 12 production IDs and checks
geometry in all rotations, palette, binary alpha, dimensions and additive
exhaust. It also renders local review wall tiles without changing public
assets. Set `KESTREL_BEAUTY=1` to render all Blender views and save `.blend`s.
The wrapper uses 24 samples for sprites. `render.py --preview` uses 4 samples.

Review output is in `artifacts/wall-1.85-roof-2.05/kestrel/`: r0/r1 idle/active
pixel layers, full/cut installation sheets, and idle Blender views. Other
rotations remain for Claude's complete render; their geometry is validated.
`manifest.fragment.json` is an isolated fragment, not a production manifest.

The output layer IDs and footprint are unchanged:

```text
module.engine.hull.r{0..3}
module.engine.machine.r{0..3}
module.engine.machine.r{0..3}.active
4 along hull x 5 deep; [4,5] at r0/r2 and [5,4] at r1/r3
```

## Integration change (m4-integration)

The hull wall of the engine's hull row is the game's own hull tile (it follows the wall view level: full with
the walls up and on roofed ships, the near-hull ghost in cutaway / low). The engine's layers, all on one anchor:
- `module.engine.hull.r<n>`: the bulkhead only, never cut: two full-height armour shoulders through the
  production hull strip (20/32, `strip()`), the sill under the bearing, the blue-grey plates and the bearing;
- `module.engine.machine.r<n>[.active]`: the inboard machine cut by the bulkhead and the production hull wall
  (`wall()`, `sprites/walls.py` pieces as holdouts), for walls-up / roofed views;
- `module.engine.machine.open.r<n>[.active]`: the same without the wall cut, for cutaway / low;
- `module.engine.bell.r<n>[.active]`: everything beyond the hull's outer face (nozzle, pipework, exhaust), which
  the renderer sorts by the tile beyond the hull row so it draws over the hull behind it.
`hull_walls.py` remains for the review context tiles only.
