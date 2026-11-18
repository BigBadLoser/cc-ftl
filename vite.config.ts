import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { layoutCases } from './tools/layout/casesPlugin.mjs';
import { ISOLATED } from './tools/isolatedTests.ts';
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
 * Three tiers: fast (`*.test.ts`), slow (`*.slow.test.ts`) and soak (`*.soak.test.ts`, off unless `VITEST_SOAK=1`). The fast tier skips `*.slow.test.ts` (`VITEST_FAST=1`, set by `test:quick` / `test:fast` and by PR CI). A CLI `--exclude`
 * does not reach per-project settings, so the tier is chosen here.
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env; // no @types/node here
// TICK_STATS=1 adds test/support/tickStats.ts: ticks and step time per test file (node tools/tickStats.mjs reports them).
// Not in the isolated project: it imports the sim before a file's vi.mock could replace a module the sim loads.
const SETUP = ['src/sim/testSetup.ts', 'test/support/setup.ts'];
const SHARED_SETUP = [...SETUP, ...(env.TICK_STATS === '1' ? ['test/support/tickStats.ts'] : [])];
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
  plugins: [tailwindcss(), svelte(), layoutCases()],
  resolve: { alias: { $lib: new URL('./tools/layout/lib', import.meta.url).pathname } },
  test: {
    testTimeout: 60000, // a failure bound only: full-size ships make the combat scenarios slow under parallel load, and CI runners are slower than the dev box
    maxWorkers: 4, // the whole box: the default leaves a core idle
    sequence: { sequencer: WeightedSequencer },
    projects: [
      { extends: true, test: { name: 'shared', setupFiles: SHARED_SETUP, include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'test/**/*.test.ts'], exclude: [...ISOLATED, ...SLOW, ...SOAK], isolate: false } },
      { extends: true, test: { name: 'isolated', setupFiles: SETUP, include: ISOLATED, exclude: [...SLOW, ...SOAK], isolate: true } },
    ],
  },
});
