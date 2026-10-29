/**
 * Sim-only profile: runs `newGame` and steps it with the real profiler probe, no browser. Loaded through Vite's SSR loader by
 * tools/profile/sim.js (so TS and extensionless imports resolve like in the app). Deterministic work, so per-system costs are comparable between runs.
 */
import { content } from '../../src/content';
import { newGame } from '../../src/sim';
import { Profiler } from '../../src/app/profiler/profiler';
import { formatReport } from '../../src/app/profiler/report';

export function profileSim(opts: { ticks: number; seed: number; rows: number; populate: boolean }) {
  const sim = newGame(opts.seed, content, undefined, opts.populate);
  const profiler = new Profiler(() => performance.now());
  profiler.enabled = true;
  const warm = Math.min(200, Math.floor(opts.ticks / 10));
  // Drain events like the app loop does (outside the timed span), or the buffer keeps the whole run's history in memory.
  for (let i = 0; i < warm; i++) {
    sim.step();
    sim.events.drain();
  }
  profiler.startRecording();
  for (let i = 0; i < opts.ticks; i++) {
    profiler.begin('loop/frame');
    sim.step(profiler);
    profiler.end('loop/frame');
    sim.events.drain();
  }
  profiler.stopRecording();
  const summary = profiler.summary(40);
  return { summary, report: formatReport(summary, opts.rows), tick: sim.tick, entities: sim.world.entityCount };
}
