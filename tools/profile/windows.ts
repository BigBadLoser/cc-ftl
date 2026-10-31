/**
 * Windowed growth report: steps a scenario and, per window of ticks, prints the mean/p95/max ms of `sim/schedule` per tick next to counts that can grow
 * (jobs by kind, reserved jobs, crew, entities, item stacks). Loaded through Vite's SSR loader by tools/profile/windows.js. Reads the sim only.
 */
import { content } from '../../src/content';
import { newGame, type Probe } from '../../src/sim';
import { JobC, CrewC } from '../../src/sim/crew/components';
import { buildScenario } from './scenarios';

export interface WindowRow { tick: number; mean: number; p95: number; max: number; jobs: number; reserved: number; crew: number; entities: number; byKind: Record<string, number> }

export function profileWindows(opts: { ticks: number; seed: number; window: number; scenario?: string; label?: string }): WindowRow[] {
  const label = opts.label ?? 'sim/schedule';
  const sim = opts.scenario ? buildScenario(opts.scenario, opts.seed) : newGame(opts.seed, content, undefined, true);
  let t0 = 0;
  let acc = 0;
  const probe: Probe = {
    begin(l) { if (l === label) t0 = performance.now(); },
    end(l) { if (l === label) acc += performance.now() - t0; },
    count() {},
  };
  const rows: WindowRow[] = [];
  let samples: number[] = [];
  for (let i = 1; i <= opts.ticks; i++) {
    acc = 0;
    sim.step(probe);
    sim.events.drain();
    samples.push(acc);
    if (i % opts.window === 0) {
      const sorted = [...samples].sort((a, b) => a - b);
      const byKind: Record<string, number> = {};
      let jobs = 0, reserved = 0;
      for (const id of sim.world.query(JobC)) {
        const j = sim.world.get(id, JobC)!;
        jobs++;
        if (j.reservedBy) reserved++;
        byKind[j.kind] = (byKind[j.kind] ?? 0) + 1;
      }
      rows.push({ tick: sim.tick, mean: samples.reduce((a, b) => a + b, 0) / samples.length, p95: sorted[Math.floor(sorted.length * 0.95)]!, max: sorted[sorted.length - 1]!, jobs, reserved, crew: [...sim.world.query(CrewC)].length, entities: sim.world.entityCount, byKind });
      samples = [];
    }
  }
  return rows;
}
