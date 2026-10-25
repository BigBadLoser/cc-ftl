# cc-ftl

Persistent isometric ship-colony game in the browser (Space Haven + FTL depth). Read `docs/HANDOFF.md` and `docs/STATUS.md`
(current state, branches, decisions) first, then
`docs/DESIGN.md` and `docs/ARCHITECTURE.md` before non-trivial work.

## Commands

- `npm run dev`: dev server
- `npm run build`: production build into `dist/`
- `npm test`: Vitest
- `npm run lint`: ESLint, including the import-boundary rules
- `npm run typecheck`: `tsc` and `svelte-check`
- `npm run check:fast`: lint, typecheck, and only the tests affected by uncommitted changes (Vitest's import graph),
  skipping `*.slow.test.ts`. Run it before every commit and before pushing a work branch.
- `npm run check`: lint, typecheck and every test, slow tier included. Run it in the testing round before opening a PR.
  CI runs it on `main`. On a PR, CI skips the slow tier (`*.slow.test.ts`) until the PR has the `full-ci` label,
  to save Actions minutes. Add the label once the PR is ready to merge.
- `npm run sprites`: rebuild the sprite sheets in `public/assets/1x/` with headless Blender (see "Asset pipeline")
  (`tools/blender/setup.sh` installs it). Commit the generated sheets, JSON and manifest.

## Hard rules

- `src/sim` is pure TypeScript. It has no three, svelte or DOM imports, and no `Math.random` or `Date`.
  Lint enforces this.
- Dependency direction:
  - `content` imports only types from `sim`.
  - `render` and `ui` read the sim and never mutate it.
  - `app` wires everything together.
- Commands are the only way into the sim. Events are output only and are never used for sim logic.
- Systems never import or call each other. Their order lives in `src/sim/pipeline.ts`.
- Components are plain serializable data. Entities are referenced by ID.
- Tile state lives in grid typed arrays, written through the grid API.
- Content is TS objects using `satisfies XDef`, referenced by string ID.
- Soft limit of about 400 lines per file. No test or demo code in `src/`. Tests sit next to their source
  as `*.test.ts`.
- Polish follows gameplay.
- Final game art comes from the Blender sprite pipeline, as sheets listed in the asset manifest. See
  "Asset pipeline" in `docs/ARCHITECTURE.md`. Procedural drawing is fine for debug views, overlays and
  temporary placeholders while art is pending. Don't regress to a game drawn in code.

## Workflow

- Flow for every piece of work:
  1. Iterate on a work branch until the user is happy. Commit often with `check:fast` and push the branch freely (a push to
     a branch is a backup, not a release).
  2. Then one round of testing and bug fixes: the full `npm run check`, plus fixing whatever it finds.
  3. Then open the PR. CI and Codex review it, and only the user merges it to `main`. Nothing reaches `main` any other way.
- Use Sonnet or Haiku subagents for well-scoped tasks, and keep token use low.
- Verify visual changes with a headless screenshot before handing them to the user. The user often
  tests on a phone through `main` at https://cc-ftl.bigbadloser.workers.dev. Branch previews
  (`<branch>-cc-ftl.bigbadloser.workers.dev`) are unreliable, so finished, verified work goes to `main`.
- Visual changes: send the user the screenshots (default and zoomed-in) and get their approval before
  merging to `main`. Don't merge visual work on the strength of your own review alone.

- Agents:
  - The main session is the orchestrator. It talks with the user, plans, briefs agents, reviews their results and
    drives the PRs, and does small things itself when that is quicker than a handoff.
  - Subagents default to Sonnet, which handles most well-scoped work.
  - Keep one Opus agent open for bug fixes and work that really needs Opus, and reuse it by message rather than
    starting new ones, so its cache isn't rebuilt every time. Use it only when Opus is needed, and tell the user when it
    gets a task.
  - Visual work: build the minimum viewable prototype first, send the user screenshots and stop, so they can iterate or
    change direction early. Finish the work and open the PR only after their go.
  - Non-visual work: no prototype stop. Work it through to a tested PR.
- Reference repos (e.g. `bigbadloser/space-web-game`) are design reference only; never port code from them.
- No save migrations while this is a prototype: bump `SAVE_VERSION` instead.
- Terminology: a **node** is one playable grid, a **sector** is a group of nodes, **hyperlanes** link sectors (older code
  says "sector" for a node; a rename is pending).
- Don't `pkill -f` (it can kill your own shell); stop processes by PID.
