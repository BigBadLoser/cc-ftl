#!/usr/bin/env node
/**
 * BENCHMARK (crew AI Phase 2 step 1, throwaway): scheduler candidates on the Phase 0 scenarios.
 *   node tools/profile/schedBench.js --scenarios storm,haul --seeds 1,2 --candidates legacy,prune,gA [--ticks N] [--verify] [--out results.json]
 * Each run is one candidate on one scenario and seed; decisions are diffed against the `legacy` run of the same scenario and seed when present.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const scenarios = opt('scenarios', 'storm').split(',');
const seeds = opt('seeds', '1').split(',').map(Number);
const cands = opt('candidates', 'legacy,prune').split(',');
const ticks = opt('ticks', undefined);
const verify = args.includes('--verify');
const out = opt('out', undefined);

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const rows = [];
try {
  const b = await server.ssrLoadModule('/tools/profile/sched/bench.ts');
  const d = await server.ssrLoadModule('/tools/profile/decisions.ts');
  for (const sc of scenarios) for (const seed of seeds) {
    let ref;
    for (const c of cands) {
      const r = b.bench(sc, seed, c, ticks ? Number(ticks) : undefined, verify);
      if (c === 'legacy') ref = r.decisions;
      let diff = '-';
      if (ref && c !== 'legacy') {
        const dd = d.diffDecisions(ref, r.decisions);
        diff = dd.identical ? 'IDENTICAL' : `first t=${dd.divergence?.tick} (${dd.divergence?.reason})`;
      }
      const m = r.metrics;
      const row = {
        scenario: sc, seed, cand: c, sched: r.schedule, pick: r.pick, warmPick: r.warmPickMax, warmSched: r.warmSchedMax, emerg: r.emergency, tick: r.tick,
        viol: r.violations, assigns: r.assignments, walked: r.walkedPerJob,
        assignP50: m.timeToAssign.p50, assignP95: m.timeToAssign.p95, never: m.timeToAssign.neverAssigned, oldestP95: m.oldestOpenAge.p95,
        done1000: m.completion.per1000, idleWork: m.idleWithWork.crewTicks, counters: r.counters, regret: r.regret, diff,
      };
      rows.push(row);
      console.log([sc, seed, c.padEnd(10),
        `sched ${row.sched.mean.toFixed(3)}/${row.sched.p95.toFixed(2)}/${row.sched.p99.toFixed(2)}/${row.sched.max.toFixed(1)}`,
        `pick ${row.pick.mean.toFixed(3)}/${row.pick.p99.toFixed(2)}/${row.pick.max.toFixed(1)}`,
        `warm ${row.warmSched}`, `emerg ${row.emerg.mean.toFixed(3)}`,
        `tick ${row.tick.mean.toFixed(2)}/${row.tick.p99.toFixed(1)}`,
        `viol ${row.viol}`, `asg ${row.assigns}`, `walk/job ${row.walked}`,
        `wait p50/p95 ${row.assignP50}/${row.assignP95}`, `never ${row.never}`, `done/1k ${row.done1000}`, `idleW ${row.idleWork}`,
        `A* ${r.counters.astar} dij ${r.counters.dijkstra} fld ${r.counters.fields} nodes ${r.counters.nodes} views ${r.counters.views}`,
        verify ? `regret ${r.regret.mismatches}/${r.regret.passes}` : '', diff].join('  '));
    }
  }
  if (out) writeFileSync(resolve(out), JSON.stringify(rows, null, 1));
} finally {
  await server.close();
}
