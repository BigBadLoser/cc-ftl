import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
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
  'src/app/stockHints.test.ts', // these two set `danger` on generated nodes, which are cached per seed
  'src/content/standing.test.ts',
  'src/content/derelictFailure.test.ts',
  'src/content/jobs.test.ts',
  'src/content/ships/envSkip.test.ts',
  'src/render/animClock.test.ts',
  'src/render/assets/compose.test.ts',
  'src/render/assets/gpuKeep.test.ts',
  'src/render/moduleStrips.test.ts',
  'src/render/partPick.test.ts',
  'src/render/regionTiles.test.ts',
  'src/sim/sector/translate.test.ts', // reads the global component registry that ecs.test.ts adds to
  'src/sim/systems/envSolvers.test.ts',
];

/**
 * The fast tier skips `*.slow.test.ts` (`VITEST_FAST=1`, set by `test:quick` / `test:fast` and by PR CI). A CLI `--exclude`
 * does not reach per-project settings, so the tier is chosen here.
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env; // no @types/node here
const SLOW = env.VITEST_FAST === '1' ? ['**/*.slow.test.ts'] : [];

export default defineConfig({
  define: { __COMMIT__: JSON.stringify(commit()) },
  plugins: [svelte()],
  test: {
    testTimeout: 60000, // a failure bound only: full-size ships make the combat scenarios slow under parallel load, and CI runners are slower than the dev box
    maxWorkers: 4, // the whole box: the default leaves a core idle
    sequence: { sequencer: WeightedSequencer },
    projects: [
      { extends: true, test: { name: 'shared', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'], exclude: [...ISOLATED, ...SLOW], isolate: false } },
      { extends: true, test: { name: 'isolated', include: ISOLATED, exclude: SLOW, isolate: true } },
    ],
  },
});
