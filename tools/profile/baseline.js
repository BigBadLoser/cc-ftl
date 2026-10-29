#!/usr/bin/env node
/**
 * Baseline table for the crew AI (docs/CREW_AI.md section 7.4): runs `profile:sim` for each scenario and seed in one process and prints a Markdown table of
 * `sim/decide` self ms (mean/p95/max) and the metrics. The first seed of every scenario runs twice and the metrics are compared: a mismatch is reported (and the
 * exit code is 1), because the counts must be deterministic. Wall-clock figures vary with machine load; the metrics must not.
 *   npm run profile:baseline -- [--scenarios colony,hullplan] [--seeds 1,2,3] [--ticks N (default: each scenario's own)] [--out baseline.json]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seeds = opt('seeds', '1,2,3').split(',').map(Number);
const out = resolve(opt('out', 'baseline.json'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
let bad = 0;
try {
  const { profileSim } = await server.ssrLoadModule('/tools/profile/simProfile.ts');
  const { allScenarios } = await server.ssrLoadModule('/tools/profile/scenarios.ts');
  const wanted = opt('scenarios', undefined)?.split(',');
  const list = allScenarios().filter((s) => !wanted || wanted.includes(s.name));
  const rows = [];
  console.log('| scenario | seed | ticks | decide mean ms | p95 | max | oldest open max | p95 | assign p50 | p95 | never assigned | idle-with-work crew-ticks | completed /1000 ticks |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const sc of list) {
    const ticks = Number(opt('ticks', sc.ticks));
    let first;
    for (const seed of seeds) {
      const r = profileSim({ ticks, seed, rows: 5, populate: sc.populate, scenario: sc.name });
      const d = r.summary.bySelf.find((x) => x.label === 'sim/decide') ?? { mean: 0, p95: 0, max: 0 };
      const m = r.metrics;
      console.log(`| ${sc.name} | ${seed} | ${ticks} | ${d.mean.toFixed(3)} | ${d.p95.toFixed(3)} | ${d.max.toFixed(1)} | ${m.oldestOpenAge.max} | ${m.oldestOpenAge.p95} | ${m.timeToAssign.p50} | ${m.timeToAssign.p95} | ${m.timeToAssign.neverAssigned} | ${m.idleWithWork.crewTicks} | ${m.completion.per1000} |`);
      rows.push({ scenario: sc.name, seed, ticks, decide: { mean: d.mean, p95: d.p95, max: d.max }, metrics: m });
      if (seed === seeds[0]) first = JSON.stringify(m);
    }
    const again = profileSim({ ticks, seed: seeds[0], rows: 5, populate: sc.populate, scenario: sc.name });
    const same = JSON.stringify(again.metrics) === first;
    if (!same) bad++;
    console.log(`<!-- ${sc.name} seed ${seeds[0]} rerun: metrics ${same ? 'identical' : 'DIFFER'} -->`);
  }
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.error(`baseline JSON written to ${out}`);
} finally {
  await server.close();
}
process.exit(bad ? 1 : 0);
