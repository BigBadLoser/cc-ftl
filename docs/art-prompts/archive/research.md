# Prompt: research bench for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/research-bench`, based on `main`.

**Task:** new art for the research module, a 2x3 research bench with a chair at the middle of one long side. It replaces the placeholder (today `module.research` borrows `module.console`). Don't reuse the console or start from it.

**Context:**
- Design: `docs/DESIGN.md`, "Core loop direction", the Research bullets. Research is a long standing job: one crew member sits at the bench for a long time working the ship's active project. Later (#380) the bench also studies finds: alien artifacts, prototypes and samples brought aboard.
- Content entry: `module.research` in `src/content/modules.ts` (power 4, a workstation). The sim and UI side is in `src/sim/research/`.
- The look: a lab bench in the ship's industrial style (walls, consoles, the galley and the hydroponics beds on `main` set it):
  - a long work surface with a sample scanner or analysis chamber, instruments, cable runs and a small parts tray;
  - a holo display or screen facing the chair, the one glow while it works;
  - a chair at the middle of the long side, where the researcher sits.
- Give the research glow its own colour, distinct from the tech cyan of consoles and the magenta-pink of grow lights: an amber or pale green-white works. Put it in its own palette set (`"set"` in `palette_extra.json`).

**Size and access:** footprint 2x3 tiles, with rotations `.r0..r3`. The access tile is the chair, at the middle of one long side. Keep that face readable, so a seated crew member visibly works the bench.

**States** (per rotation):
- `.off`: unlit, used when idle (no active project) or unpowered.
- `.on`: holo display and scanner lit, something moving on the screen (a subtle scan line or readout is enough).
- Damaged and destroyed versions, as every module has (see `common.md`).

Ids: `module.research.r<n>.on|off` plus the damage art, all listed in the manifest.

**Out of scope here:**
- A "studying a find" state (the artifact on the scanner). It comes with #380.
- Wiring into `src/`: the footprint change to 2x3, the chair access tile and the `SAVE_VERSION` bump come in the PR that lands the art (as hydroponics did in #373).

**First preview:**
- A labelled sheet in the render lab (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`) with the bench at r0 `.off` and `.on`, and r1 `.on`.
- Show it in a room with walls and a crew member in the chair, at 1x and 3x.
- Send me the sheet and stop. Don't build all the rotations and states until I've approved the look.

**After approval:**
- Build the full set and run `npm run sprites`.
- Commit the sheets, JSON and manifest.
- Wire the art in: `module.research` uses the new asset, footprint 2x3, access at the chair; bump `SAVE_VERSION`.
- Run `npm run check:fast`.
- Open the PR against `main` with the lab sheet as before and after.
