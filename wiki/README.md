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

## Next stages

Generate thumbnail images from the game's sprite manifest; expand reference
coverage; add verified game screenshots and guides. Keep market-dependent
values separate from fixed item base values.
