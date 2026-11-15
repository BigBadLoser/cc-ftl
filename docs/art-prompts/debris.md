# Prompt: debris field pieces for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/debris`, based on `main`. Issue #504 (part of #171).

**Task:** a kit of loose wreckage for debris fields, the small cousin of a derelict: a scatter of broken ship parts, left from an old fight, in open space. Crews cut scrap from it through the salvage flow. Pieces are placed singly or in groups, so each must read alone and in a pile.

**Context:**
- Design: #504 and #171. Salvage: `docs/ARCHITECTURE.md`, "Derelict salvage".
- It must look like broken pieces of the same ship language, not generic space junk. Match the approved hull plating (`tile.hull.*`, `tile.roof.*`), the beams (`struct.beam.*`, `sprites/struct.py`), the scrap look (`structure_scrap.py`, `scrap.py`) and the containers (`containers*`). Reuse their kit and materials (`steelkit`, `detail.py`, `greeble.py`) so edges, rivets and panel seams agree.
- Don't reuse or restyle `decay.debris.*` (one-tile props on derelict floors, they stay). These are free-standing pieces with no floor under them. No floor slab or plinth (see `common.md`).
- Torn means broken, not noisy: a few big sheared and bent shapes, exposed ribs or core, a cleanly bent edge, one or two scorch bands. Details at least 2 px. Nothing glows, except a rare live cable end on the pipe chunk (dim, tech cyan, sparse).

**Pieces** (footprint in tiles; every piece gets rotations `.r0..r3`, since the shapes are not symmetric, and variants `.v1..vN` as listed):

| Piece | Footprint | Variants | Look |
|---|---|---|---|
| Hull plate, small | 1x1 | v1..v3 | Offcut of armour plate, one bent corner, one torn edge, a few rivets; lies tilted |
| Hull plate, large | 2x2 | v1..v3 | Big armour sheet with a deep fold, a ragged torn side, a hatch or port stub in one version |
| Hull plate, long | 1x3 | v1..v2 | Narrow strip of wall or skirt, twisted, one end sheared |
| Truss segment | 1x2 | v1..v2 | Snapped beam run with two or three cross ties, one end bent |
| Truss segment, long | 1x4 | v1 | The same, longer, with a splayed end |
| Pipe or engine chunk | 2x2 | v1..v2 | A snapped length of heavy pipe or a nozzle ring with torn mounting struts and scorched mouth |
| Scatter bits | 1x1 | v1..v6 | Small things: bolt-shank, plate shard, cable loop, bent rib, bracket, a dented canister |

- Large pieces may lean on a smaller one for a pile look, but each sprite is a single piece.
- No loose containers here: the container sheets exist, so the node places those itself.
- Pieces tilt, so check each from all four rotations at the iso camera for sprite overlap with neighbouring tiles and clean, reachable pivots (anchor at the footprint's front tile, like any module).

**States:**
- Intact only. The salvage flow has no partial stages: a part is stripped in one job and then it is gone (`planJobs`, one scrap yield per part). No cut or damaged versions, and no `.damaged` or `.destroyed` art.
- The renderer draws the "marked for salvage" overlay and removes the piece when stripped, so the art needs nothing for either.

**Palette and tint:**
- A steel palette, not a faction palette: debris is old and bare. Mostly the shared steel, gunmetal and rust ramps, with scorch on the edges.
- Pieces may carry a plain painted patch (a scrap of livery, hazard stripe or hull number) from the existing palette names (`hivis`, `c4T3`, `navy`, `medWhite`), at fixed colour. No faction key colours and no runtime tint, so the sprites need no `.tint` layer.
- If you need new colours, put them in their own palette set (`"set": "debris"` in `palette_extra.json`) and select it for this family only.

**Ids and manifest:** family and sheet `debris`. All pieces listed in `public/assets/manifest.json`:
- `debris.plate.s.v<n>.r<k>`, `debris.plate.l.v<n>.r<k>`, `debris.plate.long.v<n>.r<k>`
- `debris.truss.v<n>.r<k>`, `debris.truss.long.v<n>.r<k>`
- `debris.chunk.v<n>.r<k>`
- `debris.bit.v<n>.r<k>`

Script: `tools/blender/sprites/debris.py`, with the pieces built in functions per kind so they can be kitbashed.

**Out of scope here:**
- Wiring into `src/`: the node generator, placement, the salvage parts and the render layer.
- Container pieces, item sprites for the scrap, and any effects (sparks, drifting).

**First preview:**
- A labelled sheet in the render lab (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`), one rotation (r0 only), low samples (`--preview`: SS 2, 1 sample), with:
  - one variant of every kind from the table;
  - a test scene: a pile of five or six pieces of mixed sizes on empty space, with a 1x1 floor tile and a crew member (in EVA suit if one exists on `main`, else a standard one) for scale, at 1x and 3x;
  - the large plate and the truss beside real `tile.hull.*` and `struct.beam.*` sprites, so the family match can be judged.
- Send me the sheet and stop. Don't build the other rotations or variants until I've approved the look.

**After approval:**
- Build the full set and run `npm run sprites`.
- Commit the sheets, JSON and manifest.
- Run `npm run check:fast`.
- Open the PR against `main` with the lab sheet.
