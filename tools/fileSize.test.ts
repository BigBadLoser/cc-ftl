import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * File size ratchet (CLAUDE.md: soft limit of about 400 lines per file). Non-test `.ts` / `.svelte` files under src/ over
 * the limit are listed below with today's line count: a new file over the limit fails, a listed file may not grow, and a
 * listed file that shrank or was split fails the "baseline is current" test so the entry comes down (or goes) with it.
 * To fix a failure, split the file by concern (a module per responsibility), not by moving lines to hide them.
 */
const LIMIT = 400;
const BASELINE: Record<string, number> = {
  'src/app/bridge.ts': 657,
  'src/app/controller.ts': 491,
  'src/content/modules.ts': 635,
  'src/main.ts': 527,
  'src/render/assets/loader.ts': 510,
  'src/render/crewView.ts': 526,
  'src/render/gridView.ts': 577,
  'src/render/moduleArt.ts': 421,
  'src/render/moduleView.ts': 516,
  'src/render/roofArt.ts': 413,
  'src/render/scene.ts': 987,
  'src/render/shuttleView.ts': 405,
  'src/sim/commands.ts': 425,
  'src/sim/galaxy/types.ts': 453,
  'src/sim/registry.ts': 694,
  'src/sim/shipgen/arranger.ts': 418,
  'src/sim/shipgen/assembly/prefab.ts': 403,
  'src/sim/shipgen/assembly/regions.ts': 500,
  'src/sim/shipgen/generate.ts': 435,
  'src/sim/shipgen/groundTurrets.ts': 443,
  'src/sim/shipgen/rooms/furnish.ts': 405,
  'src/sim/tuning.ts': 634,
  'src/ui/App.svelte': 434,
  'src/ui/StarmapView.svelte': 544,
  'src/ui/api.ts': 1719,
  'src/ui/starmapApi.ts': 439,
};

/** Lines the way `wc -l` counts them: newline characters. */
const lineCount = (text: string) => text.split('\n').length - 1;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(p) : [p];
  });

const now: Record<string, number> = {};
for (const f of walk('src')) {
  if (!/\.(ts|svelte)$/.test(f) || /\.test\.ts$/.test(f)) continue;
  const n = lineCount(readFileSync(f, 'utf8'));
  if (n > LIMIT) now[f] = n;
}

describe(`file size in src (soft limit ${LIMIT} lines)`, () => {
  it('no new file over the limit and no listed file grows', () => {
    const bad = Object.entries(now).filter(([f, n]) => n > (BASELINE[f] ?? LIMIT));
    expect(
      bad.map(([f, n]) => `${f}: ${n} lines (${BASELINE[f] ? `baseline ${BASELINE[f]}` : `limit ${LIMIT}`})`),
      `these files are over their size limit: split each by concern into smaller modules instead of growing it`,
    ).toEqual([]);
  });

  it('the baseline is current (lower or remove an entry when a file shrinks or is split)', () => {
    const stale = Object.entries(BASELINE).filter(([f, n]) => (now[f] ?? 0) !== n).map(([f, n]) => `${f}: baseline ${n}, now ${now[f] ?? `at most ${LIMIT} or gone`}`);
    expect(stale, 'update BASELINE in tools/fileSize.test.ts: lower the number to the current count, or delete the entry when the file is within the limit').toEqual([]);
  });
});
