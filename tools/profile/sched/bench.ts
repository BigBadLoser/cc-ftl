/**
 * BENCHMARK (crew AI Phase 2 step 1): runs a Phase 0 scenario with one scheduler candidate (`candidates.ts`) and reports time and assignment quality.
 * Throwaway tooling. Timing: `sim/schedule` and `sim/tick` per tick (observer time taken out), plus the picker's own time (`pick`) and the emergency
 * check's. Quality: Phase 0 metrics, priority violations (an assignment at level L while an open job at a better level is takeable by that crew member
 * after the pass, checked with the legacy predicates), tiles walked while holding a job per completed job, and the decision log for `ai:diff`.
 */
import { content } from '../../../src/content';
import { AssignmentC, CrewC, JobC, PathC, PositionC, PrioritiesC, type Job, type Priorities, type Probe, type Sim } from '../../../src/sim';
import { jobFits, jobTakeable } from '../../../src/sim/crew/jobFit';
import { canRelieve } from '../../../src/sim/ai/legacyPick';
import { setPickerHook, type PickerHook } from '../../../src/sim/ai/schedule';
import { OPERATE_MAX_LEVEL } from '../../../src/sim/tuning';
import { isErrand } from '../../../src/sim/eva/errands';
import { DecisionRecorder, type Decision } from '../decisions';
import { MetricsRecorder, percentile, type MetricsSummary } from '../metrics';
import { buildScenario, getScenario } from '../scenarios';
import { CANDIDATES, regret } from './candidates';
import { resetStats, stats } from './nav';

void content;

export interface BenchResult {
  scenario: string; seed: number; candidate: string; ticks: number;
  schedule: { mean: number; p95: number; p99: number; max: number };
  pick: { mean: number; p95: number; p99: number; max: number }; warmPickMax: number; warmSchedMax: number;
  emergency: { mean: number; max: number };
  tick: { mean: number; p95: number; p99: number; max: number };
  violations: number; assignments: number; walkedPerJob: number;
  metrics: MetricsSummary;
  counters: Record<string, number>;
  regret: { passes: number; mismatches: number };
  decisions: Decision[];
}

const dist = (xs: number[]): { mean: number; p95: number; p99: number; max: number } => {
  const s = [...xs].sort((a, b) => a - b);
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  return { mean: r(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)), p95: r(percentile(s, 0.95)), p99: r(percentile(s, 0.99)), max: r(s[s.length - 1] ?? 0) };
};

function levelOf(prio: Priorities, job: Job): number {
  return prio[job.category] || 99;
}

export function bench(scenario: string, seed: number, candidate: string, ticksOpt?: number, verify = false): BenchResult {
  const sc = getScenario(scenario);
  const ticks = ticksOpt ?? sc.ticks;
  setPickerHook(undefined);
  const sim: Sim = buildScenario(scenario, seed);
  const now = (): number => performance.now();
  let pickMs = 0, emergMs = 0;
  const base = CANDIDATES[candidate]?.(verify);
  if (!base && candidate !== 'legacy') throw new Error(`no candidate ${candidate}`);
  const hook: PickerHook = {};
  if (base?.perCrew) { const f = base.perCrew; hook.perCrew = (s, id, pos) => { const t = now(); try { return f(s, id, pos); } finally { pickMs += now() - t; } }; }
  if (base?.batch) { const f = base.batch; hook.batch = (s, ids) => { const t = now(); try { return f(s, ids); } finally { pickMs += now() - t; } }; }
  const em = base?.emergency;
  hook.emergency = (s, id, pos, job) => { const t = now(); try { return (em ?? emergencyLegacy)(s, id, pos, job); } finally { emergMs += now() - t; } };
  setPickerHook(hook);
  resetStats();
  regret.passes = 0; regret.mismatches = 0;

  let excluded = 0;
  const ex = (_l: string, fn: () => void): void => { const t = now(); fn(); excluded += now() - t; };
  const metrics = new MetricsRecorder({ stride: 25 });
  const decisions = new DecisionRecorder();
  let schedStart = 0, schedMs = 0, tickStart = 0, tickMs = 0;
  let violations = 0, assignments = 0, walked = 0;
  let before = new Map<number, number>();
  const checkViolations = (): void => {
    for (const id of sim.world.query(CrewC, AssignmentC, PrioritiesC, PositionC)) {
      const jobId = sim.world.get(id, AssignmentC)!.jobId;
      if (before.get(id) === jobId) continue;
      let job = sim.world.get(jobId, JobC);
      if (!job) continue;
      if (isErrand(job)) job = job.resume ? sim.world.get(job.resume, JobC) : undefined;
      if (!job) continue;
      assignments++;
      const prio = sim.world.get(id, PrioritiesC) as Priorities;
      const pos = sim.world.get(id, PositionC)!;
      const L = levelOf(prio, job);
      for (const o of sim.world.query(JobC)) {
        const j = sim.world.get(o, JobC) as Job;
        if (j.reservedBy !== 0 || isErrand(j)) continue;
        const l = prio[j.category];
        if (!(l >= 1 && l < L) || !jobFits(sim, id, pos, j)) continue;
        if (j.kind === 'operate' && l > OPERATE_MAX_LEVEL && !canRelieve(sim, id, j)) continue;
        if (jobTakeable(sim, id, pos, j)) { violations++; break; }
      }
    }
  };
  const snapshot = (): Map<number, number> => {
    const m = new Map<number, number>();
    for (const id of sim.world.query(AssignmentC)) m.set(id, sim.world.get(id, AssignmentC)!.jobId);
    return m;
  };
  const timing: Probe = {
    begin: (l) => {
      if (l === 'sim/tick') { tickStart = now(); excluded = 0; }
      if (l === 'sim/schedule') { ex('x', () => { before = snapshot(); }); schedStart = now(); }
    },
    end: (l) => {
      if (l === 'sim/schedule') { schedMs = now() - schedStart; ex('x', checkViolations); }
      if (l === 'sim/tick') tickMs = now() - tickStart - excluded;
    },
    count: () => {},
  };
  const probe = metrics.probe(sim, decisions.probe(sim, timing, ex), ex);
  const last = new Map<number, string>();
  const warm = Math.min(200, Math.floor(ticks / 10));
  let warmPick = 0, warmSched = 0;
  const sched: number[] = [], pick: number[] = [], emerg: number[] = [], tick: number[] = [];
  for (let i = 0; i < warm + ticks; i++) {
    pickMs = 0; emergMs = 0;
    sim.step(probe);
    const events = sim.events.drain();
    metrics.observe(sim, events);
    decisions.observe(sim);
    for (const id of sim.world.query(AssignmentC, PositionC)) {
      const p = sim.world.get(id, PositionC)!;
      const k = `${p.toX},${p.toY}`;
      if (last.has(id) && last.get(id) !== k) walked++;
      last.set(id, k);
    }
    for (const id of [...last.keys()]) if (!sim.world.has(id, AssignmentC)) last.delete(id);
    if (i < warm) { warmPick = Math.max(warmPick, pickMs); warmSched = Math.max(warmSched, schedMs); }
    if (i >= warm) { sched.push(schedMs); pick.push(pickMs); emerg.push(emergMs); tick.push(tickMs); }
  }
  setPickerHook(undefined);
  const m = metrics.summary();
  void PathC;
  return {
    scenario, seed, candidate, ticks,
    schedule: dist(sched), pick: dist(pick), warmPickMax: Math.round(warmPick), warmSchedMax: Math.round(warmSched), emergency: { mean: dist(emerg).mean, max: dist(emerg).max }, tick: dist(tick),
    violations, assignments, walkedPerJob: Math.round((walked / Math.max(1, m.completion.total)) * 10) / 10,
    metrics: m, counters: { ...stats }, regret: { ...regret }, decisions: decisions.decisions,
  };
}

import { emergencyWaiting as emergencyLegacy } from '../../../src/sim/ai/legacyPick';
