# CC-FTL Gameplay Wiki

A static SveltePress/SvelteKit 3 wiki bundled with the CC-FTL game deployment.

## Development

Requires Node.js >=22.17.

```sh
cd wiki
npm install
npm run dev
npm run check
npm run build
```

The default base path is `/cc-ftl/wiki`, including in local development.
Browse to the URL printed by Vite with that prefix.

`npm run generate` imports pure game content definitions from `../src/content/`.
It writes generated reference Markdown and JSON under ignored paths in `wiki/src/`.
Generated pages are not hand-edited; handwritten guides live beside them.

## Deployment

`.github/workflows/pages.yml` manually builds the root Vite game and this wiki
from one commit, then places the wiki output at `dist/wiki/`.
The game remains at `/cc-ftl/` and the wiki lives at `/cc-ftl/wiki/`.

The two sites must never be published independently into the same GitHub Pages
artifact, as either would replace the other.

## Generated pages and live data

`npm run generate` (run by `dev`, `check` and `build`) writes, from the game's own definitions:

- the reference catalogs and entry pages under `src/routes/reference/` (all but the hand-written modules index),
- `src/routes/guides/controls/` from the keymap (`src/ui/keymap/actions.ts`),
- `src/data/generated/game-data.json`, which guides read through `<Stat>`, `<ModuleTable>` and `<GoalActs>`, so their
  numbers follow rebalances,
- sprite crops and module placement previews under `static/generated/`.

All of it is git-ignored; never edit it by hand. `npm run check` also type-checks the generators against the game's
content types, so a renamed field fails the check instead of printing "undefined".

Hand-written guides live in `src/routes/guides/` and `src/routes/mechanics/`. Mark behaviour that is planned but not
built with `<ComingLater>`.

## Live panels

Guides show real game UI components with `<GamePanel>` instead of screenshots wherever the thing shown is a panel or card
(not the game world). Their data comes from real games: each recipe in `scripts/panel-recipes.ts` starts a seeded game
headless in Node, sets a scene up with the game's debug-scenario commands, runs a few seconds and keeps what the game's
own snapshot functions (`src/app/*Snapshot.ts`) hand the panel. `npm run generate` saves the results to
`src/data/generated/panels/<name>.json`, one file per recipe, so a page imports and ships only its own (`panelOf` in `src/lib/panels.ts`), typed by the recipes' return types, so a
changed panel fails the check. No sim code reaches the browser. The game's theme is scoped to `.game-ui`
(`scripts/game-ui-css.ts`) so it can't touch the wiki's own styles.

## Guide screenshots

`npm run capture` starts the game's dev server, runs every recipe in `scripts/guide-shots.mjs` in headless Chromium and
writes `static/guides/<name>.webp`, plus callout positions for `<GuideShot>` in `src/data/guide-shots/`. Re-run it
after art or UI changes and commit the results. It uses the GPU; on a machine without one (a cloud container) set
`CAPTURE_SOFTWARE_GL=1`, which is much slower. It prints each shot's progress; `npm run capture -- hud` runs only shots whose name contains `hud`. The
home page's ship and backdrop come from the same recipes.
