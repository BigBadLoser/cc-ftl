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

## Guide screenshots

`npm run capture` starts the game's dev server, runs every recipe in `scripts/guide-shots.mjs` in headless Chromium and
writes `static/guides/<name>.webp`, plus callout positions for `<GuideShot>` in `src/data/guide-shots/`. Re-run it
after art or UI changes and commit the results; `npm run capture -- hud` runs only shots whose name contains `hud`. The
home page's ship and backdrop come from the same recipes.
