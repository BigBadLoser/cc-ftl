/**
 * Sim-only profile: builds a scenario (`scenarios.ts`; none = the start node) and steps it with the real profiler probe, no browser. Loaded through Vite's
 * SSR loader by tools/profile/sim.js (so TS and extensionless imports resolve like in the app). Deterministic work, so per-system costs are comparable
 * between runs, and the crew-AI metrics (`metrics.ts`), the decision log (`decisions.ts`) and the board dump (`board.ts`) are exact counts that repeat.
 * The observers read the sim after each step, outside the timed span.
 */
import { content } from '../../src/content';
import { NOOP_PROBE, newGame, type Probe } from '../../src/sim';
import { Profiler } from '../../src/app/profiler/profiler';
import { formatReport } from '../../src/app/profiler/report';
import { dumpBoard, type Board } from './board';
import { OBSERVE_LABEL, type Excluder } from './excluded';
import { DecisionRecorder, type Decision } from './decisions';
import { MetricsRecorder, formatMetrics, type MetricsSummary } from './metrics';
import { buildScenario, getScenario } from './scenarios';

export interface ProfileOpts {
  ticks: number;
  seed: number;
  rows: number;
  /** Start node populated (only without a scenario; a scenario says for itself). */
  populate: boolean;
  scenario?: string;
  /** Collect the crew-AI metrics (default true). */
  metrics?: boolean;
  /** Idle-with-work sampling stride in ticks. */
  stride?: number;
  /** Record assignment decisions. */
  decisions?: boolean;
  /** Dump the board when `sim.tick` reaches this value (setup ticks count). */
  boardAt?: number;
}

export interface ProfileResult {
  summary: ReturnType<Profiler['summary']> & { scenario: string; seed: number; metrics?: MetricsSummary };
  report: string;
  tick: number;
  entities: number;
  metrics?: MetricsSummary;
  decisions?: Decision[];
  board?: Board;
  /** The tick the run started at (after scenario setup) and ended at. */
  startTick: number;
}

export function profileSim(opts: ProfileOpts): ProfileResult {
  const name = opts.scenario ?? 'none';
  const sim = opts.scenario ? buildScenario(opts.scenario, opts.seed) : newGame(opts.seed, content, undefined, opts.populate);
  const startTick = sim.tick;
  const profiler = new Profiler(() => performance.now());
  profiler.enabled = true;
  const metrics = opts.metrics === false ? undefined : new MetricsRecorder({ stride: opts.stride ?? 25 });
  const decisions = opts.decisions ? new DecisionRecorder() : undefined;
  let board: Board | undefined;
  const meta = { scenario: name, seed: opts.seed };
  const maybeDump = (): void => {
    if (opts.boardAt !== undefined && !board && sim.tick === opts.boardAt) board = dumpBoard(sim, { ...meta, tick: sim.tick });
  };
  maybeDump();
  // The observers that must see assignments before `sim/work` ride on the probe chain, with the profiler (when timing) at the end.
  const probeFor = (timing?: Profiler): Probe => {
    const base = timing ?? NOOP_PROBE;
    const ex: Excluder | undefined = timing ? (label, fn) => timing.excluded(label, fn) : undefined;
    const withDecisions = decisions ? decisions.probe(sim, base, ex) : base;
    return metrics ? metrics.probe(sim, withDecisions, ex) : withDecisions;
  };
  const warm = Math.min(200, Math.floor(opts.ticks / 10));
  // Drain events like the app loop does (outside the timed span), or the buffer keeps the whole run's history in memory.
  const after = (): void => {
    const events = sim.events.drain();
    metrics?.observe(sim, events);
    decisions?.observe(sim);
    maybeDump();
  };
  for (let i = 0; i < warm; i++) {
    sim.step(probeFor());
    after();
  }
  profiler.startRecording();
  for (let i = 0; i < opts.ticks; i++) {
    profiler.begin('loop/frame');
    sim.step(probeFor(profiler));
    profiler.end('loop/frame');
    profiler.excluded(OBSERVE_LABEL, after);
  }
  profiler.stopRecording();
  const m = metrics?.summary();
  const summary = { ...profiler.summary(40), scenario: name, seed: opts.seed, ...(m ? { metrics: m } : {}) };
  const report = formatReport(profiler.summary(40), opts.rows) + (m ? `\n\n${formatMetrics(m)}` : '');
  return { summary, report, tick: sim.tick, entities: sim.world.entityCount, startTick, ...(m ? { metrics: m } : {}), ...(decisions ? { decisions: decisions.decisions } : {}), ...(board ? { board } : {}) };
}

export { getScenario };
