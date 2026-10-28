# Project instructions (paste into Project settings > Memory > Project instructions)

cc-ftl: a persistent isometric ship-colony game in the browser (Space Haven building plus FTL combat). Repo
`bigbadloser/cc-ftl`. Every thread reads `CLAUDE.md`, `docs/HANDOFF.md` and `docs/STATUS.md` first.

How the user works:
- **Desktop-first game.** The user sometimes tests on a phone via `main` at https://bigbadloser.github.io/cc-ftl/ (published by hand).
  Branch previews are unreliable, so finished, verified work goes to `main`.
- **Visual changes need the user's approval of screenshots (default and zoomed) before merging to main.** Verify with
  headless screenshots yourself first, and look at them. Never claim something is fixed without zooming in on it.
- **Art:**
  - Iterate on quick previews; no beauty shots until the user approves the look.
  - Separate art work goes to a complete first version, then one quick preview, without checking in at every step.
  - Final game art comes from the Blender pipeline. Procedural drawing is fine for debug views, overlays, UI and temporary
    placeholders.
- **Models:** threads and agents default to Sonnet. If a task warrants Opus, say so and get the user's sign-off first.
  The ship generator and sector-refactor architecture work are already approved for Opus.
- **Early feedback.** The user wants early feedback and rapid iteration on design work (generators, layouts), not long
  silent runs.
- **Reference repos** such as `bigbadloser/space-web-game` are for design reference only. Never port code from them.
- **No save migrations** while this is a prototype. Bump `SAVE_VERSION` and discard old saves.

Engineering rules (also in `CLAUDE.md`):
- `src/sim` is pure TypeScript: no Math.random or Date, a seeded RNG.
- Commands go in, events come out.
- Systems never call each other.
- Components are plain data.
- Content is TS with `satisfies`.
- About 400 lines per file.
- Tests sit beside their source.
- `npm run check` before every commit.
- Never hand-merge `public/assets/manifest.json`; regenerate it with the sprite tooling.
- Don't use `pkill -f`; it can kill your own shell. Stop processes by PID.

Terminology:
- a **node** is one playable grid;
- a **sector** is a group of nodes;
- sectors are linked by **hyperlanes**.

Older code and docs say "sector" for a node, and a rename is pending.
