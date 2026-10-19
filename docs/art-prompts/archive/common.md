## Project context (shared)

cc-ftl (github.com/bigbadloser/cc-ftl) is a browser isometric ship-colony game (Space Haven building + FTL combat). Read `CLAUDE.md` and the "Asset pipeline" section of `docs/ARCHITECTURE.md` first.

**How art works:**
- All game art is pre-rendered from Blender and then quantised to pixel art. Models are built in Python from primitives under `tools/blender/sprites/`, rendered headless (Cycles CPU) and baked into sprite sheets listed in an asset manifest.
- The renderer never draws game content procedurally.
- Install Blender with `tools/blender/setup.sh`.
- Isometric tiles are 64x32 px.

**Where to start:**
- Base your branch on `walls-tall`. It is `m4-assets` plus the new taller walls and no module slabs, and it has the module helper kit (`detail.py`, `greeble.py`, `cmbkit.py`) and the clipping and floating-part checker (`overlap.py`).
- See the prototype scripts in `tools/blender/review/proto_*.py` for render and composite plumbing.
- You may write your own helpers.

**Hard style rules:**
- Clean shapes with smooth shading quantised to flat bands. No texture noise and no faceting.
- Every detail must be at least 2 px wide at game scale, or it turns to mush.
- Render at 64 or more Cycles samples (or denoise) so nothing speckles.
- **No floor slab, plinth or deck plate under any module.** Modules stand directly on the ship's floor tiles. Feet, cradles and legs are fine.
- Glow (emissive) only where something should glow.
- No clipping parts and no floating parts. Run an overlap check.
- Walls are 1.85 units tall (`walls.HF`); the roof is a 0.2-thick slab on top, so its top is at 2.05 (`roofs.ZR`); the hull rises to 2.05. Derive heights from those constants. Crew are 1.5 units. The low "cutaway" wall view is 0.38.
- **Never copy or commit reference images.** They are visual reference only.

**Deliverables for review.** The user approves before anything is wired in.
- The Blender render.
- The final pixel sprite on floor tiles with walls and a crew member for scale, at 1x and at a 3x nearest-neighbour zoom.
- Push to your own branch. Do not merge to `main`.
