import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import WeightedSequencer from './vitest.sequencer.ts';

/** The short commit hash baked into the build for bug reports; "dev" when git is not available. */
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

/**
 * Test files that change global state: module mocks, spies on globals, fake timers, environment variables. Each runs in a
 * fresh module graph. Every other file shares its worker's loaded modules (`isolate: false`), which saves re-importing the
 * whole sim and content for each of the ~280 files. A new test that mocks or stubs something, or changes data the sim
 * caches per seed (generated galaxy nodes), goes in this list.
 */
const ISOLATED = [
  'src/app/saves.test.ts',
  'src/app/playHook.test.ts', // stubs `window`
  'src/app/stockHints.test.ts', // these two set `danger` on generated nodes, which are cached per seed
  'src/content/standing.test.ts',
  'src/content/derelictFailure.test.ts',
  'src/content/jobs.test.ts',
  'src/content/ships/envSkip.test.ts',
  'src/render/moduleMemo.test.ts', // switches the module-level memo off and back
  'src/render/animClock.test.ts',
  'src/render/assets/compose.test.ts',
  'src/render/assets/gpuKeep.test.ts',
  'src/render/moduleStrips.test.ts',
  'src/render/partPick.test.ts',
  'src/render/pixiFixes.test.ts', // patches two pixi BindGroup methods
  'src/render/regionTiles.test.ts',
  'src/sim/sector/translate.test.ts', // reads the global component registry that ecs.test.ts adds to
  'src/sim/systems/envSolvers.test.ts',
];

/**
 * Three tiers: fast (`*.test.ts`), slow (`*.slow.test.ts`) and soak (`*.soak.test.ts`, off unless `VITEST_SOAK=1`). The fast tier skips `*.slow.test.ts` (`VITEST_FAST=1`, set by `test:quick` / `test:fast` and by PR CI). A CLI `--exclude`
 * does not reach per-project settings, so the tier is chosen here.
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env; // no @types/node here
const SLOW = env.VITEST_FAST === '1' ? ['**/*.slow.test.ts'] : [];
/** The soak tier (`*.soak.test.ts`: design-number runs over game hours or many seeds) runs only with `VITEST_SOAK=1` (`npm run test:soak`). */
const SOAK =
  env.VITEST_SOAK === '1'
    ? []
    : env.SALVAGE_BENCH || env.SALVAGE_BENCH_ONLY
      ? ['**/!(salvageBench).soak.test.ts'] // the salvage bench env vars opt in to its own soak file only
      : ['**/*.soak.test.ts'];

export default defineConfig({
  define: { __COMMIT__: JSON.stringify(commit()) },
  // Tailwind and the `$lib` alias serve only the layout lab (tools/layout/, dev page): the game's pages never import its CSS, so nothing of it reaches `dist/`.
  plugins: [tailwindcss(), svelte()],
  resolve: { alias: { $lib: new URL('./tools/layout/lib', import.meta.url).pathname } },
  test: {
    testTimeout: 60000, // a failure bound only: full-size ships make the combat scenarios slow under parallel load, and CI runners are slower than the dev box
    maxWorkers: 4, // the whole box: the default leaves a core idle
    sequence: { sequencer: WeightedSequencer },
    projects: [
      { extends: true, test: { name: 'shared', setupFiles: ['src/sim/testSetup.ts'], include: ['src/**/*.test.ts', 'tools/**/*.test.ts'], exclude: [...ISOLATED, ...SLOW, ...SOAK], isolate: false } },
      { extends: true, test: { name: 'isolated', setupFiles: ['src/sim/testSetup.ts'], include: ISOLATED, exclude: [...SLOW, ...SOAK], isolate: true } },
    ],
  },
});
