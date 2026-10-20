# Prompt: galley (food printer) and ration art for cc-ftl

(Paste `common.md` above this prompt. Base `art/galley` on `main`.)

**Task:** art for the crew-needs feature that just landed on `main`.

**Read first:**
- `module.galley` in `src/content/modules.ts`: 2x1, crafts rations, and is where crew eat.
- The Needs section of `docs/STATUS.md`.
- `src/render/assets/fallback.ts`. It currently draws the galley as a mint-tinted fabricator; the real sprites replace that automatically once they're in the manifest.

**Sprites:**
1. **`module.galley`:** 2x1, rotations `.r0..r3`, plus an `.active` state while printing.
   - A compact food printer or galley counter: a dispenser hatch, a small serving ledge, and a warm accent light (amber, not the tech cyan) on the active state only.
   - It must read as food, not as another fabricator, at 1x from across a room.
   - The access tile is in front of it (the crew eat there), so keep the front face clear and readable.
2. **Rations:** `item.ration.s`, `.m` and `.l` are stack sizes on the floor or in crates, following the existing item sprite sizes. `item.ration.held` is a ration in a crew member's hand. Also a small UI icon.
   - Sealed ration packs or trays with one clear colour accent, distinct from scrap and parts.
3. **Optional:** an eating pose for the human crew layers (`eat` clip, 8 directions, about 4 frames, standing). Follow the crew layer and clip setup in `human_render.py`. Skip it if it's large; crew can stand idle for now.

**First preview:**
- the galley at r0, idle and active, in a room with walls and a crew member at its access tile;
- the three ration stack sizes on floor tiles, plus the held ration;
- at 1x and 3x.

Render quickly, then wait for feedback.
