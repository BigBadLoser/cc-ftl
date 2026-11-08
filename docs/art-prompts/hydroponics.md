# Prompt: hydroponics beds with visible crops for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/hydroponics`, based on `main`. Farming is being built on `feature/food-59` (issue #59). Read that branch's `src/sim/farm/` and the crop items in its content for the ids. Don't wait for it to merge: the sprites are all you deliver.

**Task:** new art for hydroponics grow beds, in two sizes, with the crop growing in them visible from across a room. This replaces the current `module.hydroponics` sprite completely. Don't reuse it or start from it.

**Context:**
- Design: `docs/DESIGN.md`, "New modules: comfort, medical, gear, food", the Hydroponics and Galley bullets.
- How it plays:
  - The player picks a crop per bed.
  - A crew member sows it from the access tile, with water brought to the bed.
  - It grows while the bed has power.
  - When ripe, a crew member harvests it and the bed is sown again.
  - An empty bed draws no power and shows as powered down.
- The four crops, which must be told apart at 1x by shape and colour, not just tint:

  | Crop | Look |
  |---|---|
  | Greens | Low, broad leafy heads (lettuce, chard), bright fresh green |
  | Protein beans | Taller climbing vines on small trellis canes, darker green, pods hanging when ripe |
  | Medicinal herbs | Small bushy clumps with pale flowers (white or lilac) when ripe; a grey-green or blue-green leaf |
  | Grain | Upright stalks that go from green to gold, with heavy heads when ripe |

- The bed itself: a sealed hydroponic trough or tray on legs, with water lines, a nutrient tank or pump, and grow lights on a bar or arm above. It sits in the ship's industrial style: walls, consoles and the galley are on `main` for the look.
  - The grow lights are the one glow. Keep them a warm magenta-pink or white-violet grow-lamp colour, which reads as "plants" and differs from the tech cyan.
  - The lights are lit only while powered.

**Sizes** (footprints in tiles, both with rotations `.r0..r3`):
- **Small: 1x2.** One trough. Id `module.hydroponics`.
- **Large: 2x3.** Two or three troughs side by side, or one wide bed, with a walkway feel. Id `module.hydroponics_large`.
- The access tile is on a long side. Keep that face readable, so a crew member standing there visibly works the bed.

**States.** Build the bed and the crop as separate layers, so states combine without a sprite for every mix:
1. **Bed base** per size and rotation:
   - `.off`: unlit, the powered-down look, used when the bed is empty or has no power.
   - `.on`: grow lights lit, water running (a subtle glint or bubble in the trough is enough).
2. **Crop layer** per size, rotation, crop and stage. It is drawn on top of the bed, aligned to the troughs:
   - `.sprout`: just sown, small shoots;
   - `.grow`: half grown;
   - `.ripe`: full and ready, the most distinct silhouette.

   Ids: `module.hydroponics.crop.<crop>.<stage>.r<n>` and the same under `module.hydroponics_large`, with `<crop>` one of `greens`, `beans`, `herbs`, `grain`.
   The large bed's crop layer covers all of its troughs.
   An empty bed has no crop layer.

List all of them in the manifest. Put the plant colours in their own palette set (`"set"` in `palette_extra.json`).

**Out of scope here:**
- Item sprites for the harvested crops and the meals. Those come in a later prompt.
- Wiring into `src/`, including the large bed's content entry. The food branch adds the module and the renderer's crop layer.

**First preview:**
- A labelled sheet in the render lab (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`) with:
  - the small bed at r0 `.off` and `.on`;
  - the small bed `.on` with each crop at `.ripe`;
  - one crop through all three stages;
  - the large bed at r0 `.on` with a ripe crop.
- Show them in a room with walls and a crew member at the access tile, at 1x and 3x.
- Send me the sheet and stop. Don't build all the rotations and stages until I've approved the look.

**After approval:**
- Build the full set and run `npm run sprites`.
- Commit the sheets, JSON and manifest.
- Run `npm run check:fast`.
- Open the PR against `main` with the lab sheet as before and after.
