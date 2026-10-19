## Project context (shared)

cc-ftl (github.com/bigbadloser/cc-ftl, a private repo) is a browser isometric ship-colony game: Space Haven building plus FTL combat. Read `CLAUDE.md`, `docs/STATUS.md` and the "Asset pipeline" section of `docs/ARCHITECTURE.md` first.

**How I want to work: iterate on quick previews, not beauty renders.**
- Work through a complete first version on your own, without checking in after each step.
- Then show me that first full preview, rendered quickly: low samples, game-scale pixel sprites. No high-quality beauty renders or full sprite builds.
- We iterate on quick previews like that until I'm happy with the look.
- Only after I approve do the high-quality renders, the full sprite build and the wiring into `src/`.

**How the art works:**
- All game art is pre-rendered in Blender and quantised to pixel art.
- Models are built in Python from primitives under `tools/blender/sprites/`, rendered headless with Cycles CPU, and baked into sprite sheets listed in `public/assets/manifest.json`.
- Install Blender with `tools/blender/setup.sh`.
- Iso tiles are 64x32 px.
- See the prototype scripts in `tools/blender/review/proto_*.py` for the render and composite plumbing.
- The module helper kit is `detail.py`, `greeble.py` and `cmbkit.py`, plus the `overlap.py` checker for clipping and floating parts.

**Branch:**
- Base your branch on `main`, which has all the approved art: walls, roof, consoles, sitting crew, weapons, engines and robots (unless the prompt says otherwise).
- Push to your own branch, named below. Never push to `main`.

**Hard style rules:**
- Clean shapes, smooth shading quantised to flat bands. No texture noise, no faceting.
- Every detail must be at least 2 px at game scale.
- No floor slab, plinth or deck plate under modules. Feet, cradles and legs are fine.
- Glow only where something should glow. No clipping or floating parts.
- Heights come from the constants:
  - walls are 1.85 units tall (`walls.HF`);
  - the roof slab top is at 2.05 (`walls.hull_top()`);
  - crew are 1.5 units tall.
- Match the look of the approved art. Never copy or commit reference images.

**Deliverables for each preview:**
- the in-game-scale pixel sprite on floor tiles, with walls and a crew member for scale, at 1x and at a 3x nearest-neighbour zoom;
- a quick Blender preview render only if it helps; no beauty shots until the look is approved.
