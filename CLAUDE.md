# cc-ftl

Persistent isometric ship-colony game in the browser (Space Haven + FTL depth). Read `docs/STATUS.md`
(current state, branches, decisions) first, then
`docs/DESIGN.md` and `docs/ARCHITECTURE.md` before non-trivial work.

## Commands

- `npm run dev`: dev server
- `npm run build`: production build into `dist/`
- `npm test`: Vitest
- `npm run lint`: ESLint, including the import-boundary rules
- `npm run typecheck`: `tsc` and `svelte-check`
- `npm run check`: lint, typecheck and test. Run it before every commit.
- `npm run sprites`: rebuild the sprite sheets in `public/assets/` with headless Blender
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
- The renderer never draws game content procedurally. Art comes from the Blender sprite pipeline as
  sheets listed in the asset manifest. See "Asset pipeline" in `docs/ARCHITECTURE.md`.

## Workflow

- Use Sonnet or Haiku subagents for well-scoped tasks, and keep token use low.
- Verify visual changes with a headless screenshot before handing them to the user. The user often
  tests on a phone through `main` at https://cc-ftl.bigbadloser.workers.dev. Branch previews
  (`<branch>-cc-ftl.bigbadloser.workers.dev`) are unreliable, so finished, verified work goes to `main`.
- Visual changes: send the user the screenshots (default and zoomed-in) and get their approval before
  merging to `main`. Don't merge visual work on the strength of your own review alone.
