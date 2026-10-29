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
- `npm run check`: lint, typecheck and every test, slow tier included. Run it in the testing round, after the last
  merge of `main` into the branch, and paste its result (pass, test count, any load timeouts rerun alone) into the PR
  body. Affected-only or partial runs don't count. CI minutes cost money: CI runs only lint, typecheck, the build and
  the fast tests the change affects (on ready PRs only: drafts and pushes to `main` don't run it, nor do markdown-only
  changes), plus the full suite once a day on `main` when it changed. Batch fixes into one push rather than pushing every commit to an open PR.
- `npm run profile` / `npm run profile:sim`: performance profiler for agents (headless game / sim only). See `docs/PROFILING.md`.
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
  2. Then one round of testing and bug fixes: merge `main` in, run the full `npm run check`, and fix whatever it finds.
  3. Then open the PR, with the `npm run check` result in its body, as a draft while it still expects fixes (draft PRs
     don't run CI). Codex skips drafts too, so comment `@codex review` to get its review. Mark the PR ready once the fixes
     are batched in; CI (and another Codex review) runs from then on. CI and Codex review it, and only
     the user merges it to `main`. Nothing reaches `main` any other way.
  Docs-only changes (`*.md`, no code) skip the PR and go straight to `main`.
- GitHub issues track the work. Every bug or piece of work gets an issue (create one if none exists), and every PR
  links it: `Closes #N` when it finishes the issue, `Part of #N` when it doesn't. Reference the issue in commit messages
  (`Refs #N`). When work lands or stalls without a PR, comment on the issue.
- Use Sonnet or Haiku subagents for well-scoped tasks, and keep token use low.
- Verify visual changes with a headless screenshot before handing them to the user. The user playtests branches locally
  (`npm run dev`; debug starts like `?scenario=hullplan` help). `main` is published to https://bigbadloser.github.io/cc-ftl/
  by the manual "Deploy to GitHub Pages" workflow; it does not deploy on every push. There are no branch previews.
- **Desktop only.** The game will not be played on phones. Don't spend work on phone layouts, touch gestures or phone
  screenshots, and don't add phone-specific requirements to briefs. Existing phone breakpoints may stay as they are; don't
  extend or fix them unless the user asks.
- UI work follows the **UI soft rules** in `docs/DESIGN.md` ("UI"): nothing happens only in UI, show don't tell, numbers
  on demand, the ship's log vs urgent clickable alerts, the Esc menu. They are soft: suggest breaking one when it fits better,
  and let the user decide.
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
- Save migrations are not a priority yet, not a ban: by default bump `SAVE_VERSION` when the saved shape changes. When
  keeping existing saves is cheap (a storage move, a renamed field), suggest a migration and let the user decide.
- Terminology: a **node** is one playable grid, a **sector** is a group of nodes, **hyperlanes** link sectors (older code
  says "sector" for a node; a rename is pending).
- Don't `pkill -f` (it can kill your own shell); stop processes by PID.
