# Prompt: derelict dressing (damage and decay variants) for cc-ftl

(Paste `common.md` above this prompt. **Branch override:** base `art/derelict` on `main`, not `m4-integration`.)

**Task:** the art that turns an ordinary generated ship into a derelict. The generator lays out the ship, and a later decay pass breaks rooms, scorches areas and scatters debris. This job makes the visuals that pass will use. Two kinds of derelict:
- **abandoned wrecks** infested with aliens;
- **rogue AI shipyards and factories**.

**Read first:**
- the floor, wall and roof families: `tools/blender/sprites/floors.py`, `hull.py` and `roofs.py`, with their tile naming and masks in the manifest;
- the wall view levels (up, cutaway, low) in `docs/ARCHITECTURE.md`.

**Sprites, all overlays or variants on top of the existing tile families, so any ship can be decayed:**
1. **Breaches.** A hull hole open to space, on a floor tile and on a wall piece, using the same masks as walls so breached runs join. Torn plate edges, exposed ribs, no glow.
2. **Scorch and burn.** Burn marks for floors and walls, in 2–3 variants each, as overlays. Also a burnt-out module look as a generic overlay to lay over any module sprite, not per-module art.
3. **Debris.** Floor clutter: bent plates, cables, sparking junction boxes (a small spark on the glow sheet), floating chunks for vacuum rooms. 4–6 props, 1 tile each, with no footprint so crew walk over them.
4. **Dead lights.** A broken or flickering variant of the existing light module, plus dim emergency red striplights for derelict corridors.
5. **Infestation, for alien wrecks.** Organic growth overlays for floors and walls with an egg cluster prop. Coordinate the colour with the alien creature's accent colour; check `art/alien` if it exists.
6. **AI shipyard dressing.** Cable bundles, a robot parts scrap pile, and a dormant fabricator glow variant. Keep it small; most of this comes from existing robot art.

**Look:** keep the approved materials and palette. Decay should read clearly at 1x without becoming noisy texture. Prefer a few big, clear shapes (a jagged hole, a black scorch blot) over fine grime.

**First preview:**
- one 8x6 room shown twice: intact, then decayed with a breach, scorch, debris, a dead light and infestation;
- a second small room with AI shipyard dressing;
- crew member for scale;
- at 1x and 3x, in both cutaway and roofed views.

Render quickly, then wait for feedback.
