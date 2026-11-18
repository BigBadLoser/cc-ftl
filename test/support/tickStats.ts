import { afterAll, expect } from 'vitest';
import { Sim } from '../../src/sim/sim';

/**
 * Where test time goes (#371): with `TICK_STATS=1` this setup file (vite.config.ts) counts every `Sim.step()` and the time spent in it, per
 * test file, and appends one JSON line per file to `.tick-stats/<pid>.jsonl`. `node tools/tickStats.mjs` joins that with a Vitest JSON report
 * (per-file wall time) into a table: ticks, step seconds, share of the file's time in ticks, milliseconds per tick. Off by default: nothing
 * is patched in a normal run.
 */
type Stat = { ticks: number; ms: number };
const PATCHED = Symbol.for('cc-ftl.tickStats');
const proto = Sim.prototype as unknown as { step: (...a: unknown[]) => void; [PATCHED]?: Map<string, Stat> };
const g = globalThis as unknown as { process: { pid: number; cwd(): string }; performance: { now(): number } };

if (!proto[PATCHED]) {
  const stats = new Map<string, Stat>();
  proto[PATCHED] = stats;
  const step = proto.step;
  proto.step = function (this: Sim, ...a: unknown[]): void {
    const t0 = g.performance.now();
    try {
      step.apply(this, a);
    } finally {
      const file = expect.getState().testPath ?? '?';
      const s = stats.get(file) ?? { ticks: 0, ms: 0 };
      s.ticks++;
      s.ms += g.performance.now() - t0;
      stats.set(file, s);
    }
  };
}

afterAll(async () => {
  const stats = proto[PATCHED];
  if (!stats?.size) return;
  type Fs = { mkdirSync(p: string, o: { recursive: boolean }): void; appendFileSync(p: string, s: string): void };
  const fsModule = 'node:fs'; // a variable: this project has no Node types, and Vite must not try to bundle it
  const { mkdirSync, appendFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
  const dir = `${g.process.cwd()}/.tick-stats`;
  mkdirSync(dir, { recursive: true });
  const lines = [...stats].map(([file, s]) => JSON.stringify({ file, ...s })).join('\n');
  appendFileSync(`${dir}/${g.process.pid}.jsonl`, `${lines}\n`);
  stats.clear();
});
