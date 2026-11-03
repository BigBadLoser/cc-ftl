import { describe, expect, it } from 'vitest';
import { BASELINE, BASELINE_COMMIT, variantKey, type BenchVariant } from './salvageBench.baseline';
import { BENCH_HOURS, BENCH_TICKS, formatBench, runBench, setupBench } from './salvageBench';

/**
 * The salvage throughput bench (docs/ARCHITECTURE.md "Throughput check", #286). It runs the real salvage loop on a big derelict for 2 game hours and
 * reads the scrap brought home. The numbers in `salvageBench.baseline.ts` were measured on today's salvage trip code before slice 0 changed anything;
 * slices 2 and 3 must not fall below them (the mean at least the baseline, each seed at least 90% of its own).
 *
 * One run is a few minutes of wall time, so the 12 runs (4 variants x seeds 1-3) are not in the default slow tier. `SALVAGE_BENCH=1 npx vitest run
 * salvageBench` runs them all; `SALVAGE_BENCH_ONLY=6lock:2` runs one (variant:seed). `npm run profile:sim -- --scenario salvageBench --ticks 144000`
 * prints the same scrap-per-hour number. The default tier runs a short smoke of the same setup.
 */
const VARIANTS: BenchVariant[] = [{ crew: 6, airlock: false }, { crew: 6, airlock: true }, { crew: 4, airlock: false }, { crew: 4, airlock: true }];
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const only = env.SALVAGE_BENCH_ONLY;
const full = !!env.SALVAGE_BENCH || !!only;

/** Append a result line to the file named by SALVAGE_BENCH_OUT (the runner's console is not shown); no file, no line. */
async function record(line: string): Promise<void> {
  const file = env.SALVAGE_BENCH_OUT;
  if (!file) return;
  const fs = await import(/* @vite-ignore */ ['node', 'fs'].join(':'));
  fs.appendFileSync(file, `${line}\n`);
}

describe('salvage throughput bench', () => {
  it.skipIf(!!only)('runs: a short shift on the bench wreck brings scrap home, and the same seed gives the same run', () => {
    const quick = (): ReturnType<typeof runBench> => runBench(setupBench(1, { crew: 6, airlock: false }), 20 * 60 * 5);
    const a = quick();
    expect(a.scrap).toBeGreaterThan(0);
    expect(a.stripped).toBeGreaterThan(0);
    expect(quick()).toEqual(a);
  }, 120000);

  /**
   * More crew is never slower: on each seed (and each wreck), 6 crew bring home at least what 4 do. Nothing at home competes for them, and
   * each crew member of the 6 is at least as willing (three at priority 1, three at 3); the shuttle's seats and suits cap the party either way.
   * `SALVAGE_BENCH_ONLY=more:2` (or `morelock:2`) runs one seed.
   */
  describe.skipIf(!full)('more crew is never slower (SALVAGE_BENCH=1)', () => {
    for (const airlock of [false, true]) {
      const key = airlock ? 'morelock' : 'more';
      const seeds = [1, 2, 3].filter((s) => !only || only === `${key}:${s}`);
      if (seeds.length === 0) continue;
      it(`wreck ${airlock ? 'with' : 'without'} an airlock: 6 crew bring home at least what 4 do, seed by seed`, async () => {
        for (const s of seeds) {
          const [six, four] = [6, 4].map((crew) => runBench(setupBench(s, { crew: crew as 4 | 6, airlock }), BENCH_TICKS));
          await record(`${key} seed ${s}: 6 crew ${six!.scrap}, 4 crew ${four!.scrap}`);
          expect(six!.scrap).toBeGreaterThanOrEqual(four!.scrap);
        }
      }, 3600000);
    }
  });

  describe.skipIf(!full)('2 game hours (SALVAGE_BENCH=1)', () => {
    for (const v of VARIANTS) {
      const key = variantKey(v);
      const seeds = [1, 2, 3].filter((s) => !only || only === `${key}:${s}`);
      if (seeds.length === 0) continue;
      it(`${v.crew} crew, wreck ${v.airlock ? 'with' : 'without'} an airlock: no worse than the baseline of ${BASELINE_COMMIT}`, async () => {
        const base = BASELINE[key];
        const perHour: number[] = [];
        for (const s of seeds) {
          const r = runBench(setupBench(s, v), BENCH_TICKS);
          await record(`${key} seed ${s}: ${formatBench(r)} | ${JSON.stringify({ scrap: r.scrap, stripped: r.stripped })}`);
          if (base[s - 1]) expect(r.perHour).toBeGreaterThanOrEqual(0.9 * (base[s - 1]!.scrap / BENCH_HOURS)); // no baseline recorded yet: just measure
          if (v.airlock) expect(r.scrap).toBeGreaterThan(0); // #292: a dead airlock on the wreck no longer stalls the crew at its door
          perHour.push(r.perHour);
        }
        if (seeds.length === 3 && base.length === 3) expect(perHour.reduce((n, x) => n + x, 0) / 3).toBeGreaterThanOrEqual(base.reduce((n, b) => n + b.scrap, 0) / (3 * BENCH_HOURS));
      }, 3600000);
    }
  });
});
