#!/usr/bin/env node
/* global process, console */
// Where test time goes: ticks and Sim.step() time per test file, against each file's wall time.
//   rm -rf .tick-stats && TICK_STATS=1 VITEST_FAST=1 npx vitest run --reporter=json --outputFile=.tick-stats/report.json
//   node tools/tickStats.mjs [n]           the totals and the n heaviest files by step time (default 30)
// Step time is measured inside the test process, so a file's "other" time (setup, generation, serialize, assertions, imports) is its
// wall time minus its step time. Run it on a quiet machine: timings under load are inflated, though shares stay comparable.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { relative } from 'node:path';

const DIR = '.tick-stats';
if (!existsSync(DIR)) { console.error('no .tick-stats/: run the suite with TICK_STATS=1 first (see the header of this file)'); process.exit(2); }
const rel = (f) => relative(process.cwd(), f);
const steps = new Map();
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of readFileSync(`${DIR}/${f}`, 'utf8').split('\n').filter(Boolean)) {
    const { file, ticks, ms } = JSON.parse(line);
    const s = steps.get(rel(file)) ?? { ticks: 0, ms: 0 };
    s.ticks += ticks; s.ms += ms;
    steps.set(rel(file), s);
  }
}
const wall = new Map();
if (existsSync(`${DIR}/report.json`)) {
  const r = JSON.parse(readFileSync(`${DIR}/report.json`, 'utf8'));
  for (const t of r.testResults ?? []) wall.set(rel(t.name), (t.endTime - t.startTime) || 0);
}
const files = [...new Set([...steps.keys(), ...wall.keys()])].map((f) => {
  const s = steps.get(f) ?? { ticks: 0, ms: 0 };
  return { f, ticks: s.ticks, step: s.ms / 1000, wall: (wall.get(f) ?? 0) / 1000 };
});
const sum = (k) => files.reduce((a, x) => a + x[k], 0);
const W = sum('wall'), S = sum('step'), T = sum('ticks');
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
console.log(`${files.length} files; wall ${W.toFixed(0)} s (summed over workers), in Sim.step ${S.toFixed(0)} s (${pct(S, W)}), ${T.toLocaleString()} ticks, ${(T ? (1000 * S) / T : 0).toFixed(2)} ms/tick on average`);
const noTicks = files.filter((x) => !x.ticks);
console.log(`files that never step: ${noTicks.length}, ${noTicks.reduce((a, x) => a + x.wall, 0).toFixed(0)} s wall`);
const n = Number(process.argv[2]) || 30;
console.log(`\n${'step s'.padStart(7)} ${'wall s'.padStart(7)} ${'in step'.padStart(7)} ${'ticks'.padStart(9)} ${'ms/tick'.padStart(7)}  file`);
for (const x of [...files].sort((a, b) => b.step - a.step).slice(0, n)) {
  console.log(`${x.step.toFixed(1).padStart(7)} ${x.wall.toFixed(1).padStart(7)} ${pct(x.step, x.wall).padStart(7)} ${String(x.ticks).padStart(9)} ${(x.ticks ? (1000 * x.step) / x.ticks : 0).toFixed(2).padStart(7)}  ${x.f}`);
}
const other = [...files].sort((a, b) => (b.wall - b.step) - (a.wall - a.step)).slice(0, 10);
console.log('\nmost time outside Sim.step (setup, generation, serialize, assertions):');
for (const x of other) console.log(`${(x.wall - x.step).toFixed(1).padStart(7)} s  ${x.f}`);
