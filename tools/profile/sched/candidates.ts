/**
 * BENCHMARK PROTOTYPES (crew AI Phase 2 step 1, docs/CREW_AI.md 7.3): scheduler candidates behind `setPickerHook`. Throwaway; the winner is rebuilt in
 * src/sim/ai with tests. All share the component prefilter (`nav.ts`), the legacy admission (`jobFits`, operate relief gate) and the legacy mode order
 * (dry, then thin `any`, then thin `suited`, thin only with a suit to be had).
 *
 * - `prune`  per crew member in id order, legacy semantics exactly (score in steps, lowest id first): prefilter, then jobs in lower-bound order with
 *            legacy `planSiteWalk` until the bound passes the best score. Must record IDENTICAL decisions to legacy.
 * - `gA`     global per-level matching on (level, -urgency, cost x10 + offsets, job id, crew id), costs by lazy A*: pairs keyed by an octile bound in one heap,
 *            exact A* only when a bound reaches the top.
 * - `gC`     same matching, costs by one multi-goal Dijkstra per free crew member and mode (candidate C).
 * - `gB`     same matching, costs read off per-job reverse Dijkstra fields cached per navigation view (candidate B).
 * - `*+gate` the pass runs only when its inputs changed (open jobs, free crew, navigation revisions) or every 20 ticks (`SCHED_CADENCE`).
 */
import { JobC, PrioritiesC, PositionC, WORK_CATEGORIES, type Job, type Position, type Priorities } from '../../../src/sim/crew/components';
import { jobFits } from '../../../src/sim/crew/jobFit';
import { jobGoal, origin } from '../../../src/sim/crew/helpers';
import type { PathGoal, Tile } from '../../../src/sim/crew/pathfind';
import { findSuitSource, isErrand, type SuitSource } from '../../../src/sim/eva/errands';
import { gridHasThinAir, planSiteWalk } from '../../../src/sim/eva/route';
import { hasSuitAir, isSuited, needsAir } from '../../../src/sim/eva/suit';
import { operateAffinity } from '../../../src/sim/combat/operators';
import { shipGrid, shipIdOf } from '../../../src/sim/regions';
import { EVA_JOB_PENALTY, OPERATE_MAX_LEVEL, RELIEF_PENALTY } from '../../../src/sim/tuning';
import { canRelieve, pickJob, repairUrgency } from '../../../src/sim/ai/legacyPick';
import { startErrand } from '../../../src/sim/ai/machines/eva';
import { reserveJob } from '../../../src/sim/ai/task';
import type { PickerHook } from '../../../src/sim/ai/schedule';
import type { Sim } from '../../../src/sim';
import { astar, dijkstraFrom, fieldCost, fieldPath, fieldTo, goalTiles, isGoalTile, octileBound, reaches, startLabels, stepsBound, viewOf, type Mode, type View } from './nav';

interface ModeStep { mode: Mode; thin: boolean }

/** The legacy `planSiteWalk` mode order for this crew member on this ship. */
function modesOf(sim: Sim, crew: number, ship: number): ModeStep[] {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct')) return [];
  if (hasSuitAir(sim, crew) || !needsAir(sim, crew)) return [{ mode: { avoidThin: false, suited: isSuited(sim, crew) }, thin: false }];
  if (!gridHasThinAir(sim, grid)) return [{ mode: { avoidThin: false, suited: isSuited(sim, crew) }, thin: false }, { mode: { avoidThin: false, suited: true }, thin: true }];
  return [{ mode: { avoidThin: true, suited: false }, thin: false }, { mode: { avoidThin: false, suited: false }, thin: true }, { mode: { avoidThin: false, suited: true }, thin: true }];
}

/** A crew member as the candidates see them for one pass. */
class CrewCtx {
  readonly from: Tile;
  readonly ship: number;
  readonly prio: Priorities;
  readonly modes: ModeStep[];
  private views: (View | null | undefined)[] = [];
  private starts: (number[] | undefined)[] = [];
  private src: SuitSource | null | undefined;
  constructor(private sim: Sim, readonly id: number, readonly pos: Position) {
    this.from = origin(pos);
    this.ship = shipIdOf(sim, pos);
    this.prio = sim.world.get(id, PrioritiesC) as Priorities;
    this.modes = modesOf(sim, id, this.ship);
  }
  source(): SuitSource | null {
    if (this.src === undefined) this.src = findSuitSource(this.sim, this.id, this.pos);
    return this.src;
  }
  view(k: number): View | null {
    if (this.views[k] === undefined) this.views[k] = viewOf(this.sim, this.ship, (this.modes[k] as ModeStep).mode);
    return this.views[k] as View | null;
  }
  startsOf(k: number): number[] {
    if (this.starts[k] === undefined) { const v = this.view(k); this.starts[k] = v ? startLabels(v, this.from) : []; }
    return this.starts[k] as number[];
  }
  /** Index of the first mode that reaches the goal (thin modes only with a suit to be had), or -1: the prefilter, no search. */
  classify(goal: PathGoal): number {
    for (let k = 0; k < this.modes.length; k++) {
      if ((this.modes[k] as ModeStep).thin && !this.source()) return -1;
      const v = this.view(k);
      if (v && reaches(v, this.from, this.startsOf(k), goal)) return k;
    }
    return -1;
  }
}

/** The legacy admission: level, fit, and the operate relief gate. Returns whether it is a relief pair, or null when not admitted. */
function admit(sim: Sim, c: CrewCtx, job: Job, level: number): { relief: boolean } | null {
  if (c.prio[job.category] !== level || !jobFits(sim, c.id, c.pos, job)) return null;
  const relief = job.kind === 'operate' && level > OPERATE_MAX_LEVEL;
  if (relief && !canRelieve(sim, c.id, job)) return null;
  return { relief };
}

function openJobs(sim: Sim): number[] {
  return sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.reservedBy === 0);
}

// ---------------------------------------------------------------- prune (per crew, legacy-exact)

export function prunePick(sim: Sim, crewId: number, pos: Position, ownSearch = false): boolean {
  const jobs = openJobs(sim);
  if (jobs.length === 0) return false;
  const c = new CrewCtx(sim, crewId, pos);
  const thinOk = (): boolean => !!c.source();
  for (let level = 1; level <= 4; level++) {
    const cands: { id: number; job: Job; goal: PathGoal; bound: number; off: number }[] = [];
    for (const jobId of jobs) {
      const job = sim.world.get(jobId, JobC);
      if (!job) continue;
      const a = admit(sim, c, job, level);
      if (!a) continue;
      const goal = jobGoal(job);
      const k = c.classify(goal);
      if (k < 0) continue;
      const off = -repairUrgency(sim, job) - operateAffinity(sim, crewId, job) + ((c.modes[k] as ModeStep).thin ? EVA_JOB_PENALTY : 0) + (a.relief ? RELIEF_PENALTY : 0);
      cands.push({ id: jobId, job, goal, bound: stepsBound(c.from, goal) + off, off });
    }
    cands.sort((x, y) => x.bound - y.bound || x.id - y.id);
    let best: { id: number; steps: Tile[]; score: number; thin: boolean } | null = null;
    for (const x of cands) {
      if (best && x.bound > best.score) break;
      const plan = ownSearch ? viewPlan(c, x.goal) : planSiteWalk(sim, crewId, c.ship, c.from, x.goal, thinOk);
      if (!plan) continue;
      // legacy offsets, recomputed from the plan's own thin flag
      const score = plan.steps.length - repairUrgency(sim, x.job) - operateAffinity(sim, crewId, x.job) + (plan.thin ? EVA_JOB_PENALTY : 0) + (x.job.kind === 'operate' && level > OPERATE_MAX_LEVEL ? RELIEF_PENALTY : 0);
      if (!best || score < best.score || (score === best.score && x.id < best.id)) best = { id: x.id, steps: plan.steps, score, thin: plan.thin };
    }
    if (best) {
      reserveJob(sim, crewId, best.id, best.steps);
      const src = best.thin ? c.source() : null;
      if (src) startErrand(sim, crewId, 'suitUp', src, c.ship, best.id);
      return true;
    }
  }
  return false;
}

/** `planSiteWalk` on the cached views: the first mode that reaches, then the same A* (same steps). */
function viewPlan(c: CrewCtx, goal: PathGoal): { steps: Tile[]; thin: boolean } | null {
  const k = c.classify(goal);
  if (k < 0) return null;
  const r = astar(c.view(k) as View, c.from, goal);
  return r && { steps: r.steps, thin: (c.modes[k] as ModeStep).thin };
}

// ---------------------------------------------------------------- global matching

interface Pair {
  c: CrewCtx;
  job: number;
  goal: PathGoal;
  k: number;
  urg: number;
  /** Offsets in cost units: EVA, relief, minus affinity (x10, as the design's tuple). */
  off: number;
  cost: number;
}

type Oracle = 'exhaustive' | 'lazyA' | 'dijkstra' | 'field' | 'hybrid';

/** Hybrid: a (crew, mode) group with more candidate jobs than this gets one Dijkstra; smaller groups stay lazy A*. */
export const HYBRID_K = 6;

const cmp = (a: { urg: number; key: number; job: number; crew: number }, b: { urg: number; key: number; job: number; crew: number }): number =>
  b.urg - a.urg || a.key - b.key || a.job - b.job || a.crew - b.crew;

/** Field cache per view (a rebuilt view is a new object, so stale fields die with it). */
const FIELDS = new WeakMap<View, Map<string, Int32Array>>();
function fieldFor(v: View, job: number, goal: PathGoal): Int32Array {
  let m = FIELDS.get(v);
  if (!m) FIELDS.set(v, (m = new Map()));
  const key = `${job}|${goal.x},${goal.y},${goal.adjacent ? 1 : 0},${goal.w ?? 1},${goal.h ?? 1}`;
  let f = m.get(key);
  if (!f) m.set(key, (f = fieldTo(v, goal)));
  return f;
}

/** Exact costs for every pair (all oracles but lazyA), and a step source. */
function costAll(pairs: Pair[], oracle: Oracle): Map<Pair, () => Tile[]> {
  const steps = new Map<Pair, () => Tile[]>();
  if (oracle === 'exhaustive') {
    for (const p of pairs) {
      const r = astar(p.c.view(p.k) as View, p.c.from, p.goal);
      p.cost = r ? r.cost : Infinity;
      const s = r?.steps ?? [];
      steps.set(p, () => s);
    }
  } else if (oracle === 'dijkstra') {
    const groups = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = `${p.c.id}|${p.k}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    for (const group of groups.values()) {
      const { c, k } = group[0] as Pair;
      const v = c.view(k) as View;
      const goals = new Map<number, number[]>();
      const atStart: Pair[] = [];
      for (const p of group) {
        if (isGoalTile(p.goal, c.from.x, c.from.y)) { atStart.push(p); continue; }
        for (const t of goalTiles(v, p.goal)) goals.set(t, [...(goals.get(t) ?? []), p.job]);
      }
      for (const p of atStart) { p.cost = 0; steps.set(p, () => []); }
      if (goals.size === 0) continue;
      const r = dijkstraFrom(v, c.from, goals);
      for (const p of group) {
        if (atStart.includes(p)) continue;
        p.cost = r.cost.get(p.job) ?? Infinity;
        steps.set(p, () => r.steps(p.job));
      }
    }
  } else if (oracle === 'field') {
    for (const p of pairs) {
      const v = p.c.view(p.k) as View;
      const f = fieldFor(v, p.job, p.goal);
      const cost = fieldCost(v, f, p.c.from, p.goal);
      p.cost = cost < 0 ? Infinity : cost;
      steps.set(p, () => fieldPath(v, f, p.c.from, p.goal));
    }
  }
  return steps;
}

/** Greedy lowest-tuple matching. Returns [pair, steps] in assignment order. */
function match(pairs: Pair[], oracle: Oracle): { p: Pair; steps: Tile[] }[] {
  const out: { p: Pair; steps: Tile[] }[] = [];
  const crewDone = new Set<number>(), jobDone = new Set<number>();
  if (oracle === 'lazyA' || oracle === 'hybrid') {
    const exactSteps = new Map<Pair, () => Tile[]>();
    if (oracle === 'hybrid') {
      const groups = new Map<string, Pair[]>();
      for (const p of pairs) {
        const key = `${p.c.id}|${p.k}`;
        groups.set(key, [...(groups.get(key) ?? []), p]);
      }
      const big = [...groups.values()].filter((g) => g.length > HYBRID_K).flat();
      for (const [p, f] of costAll(big, 'dijkstra')) exactSteps.set(p, f);
    }
    // binary heap over entries {urg, key, job, crew, exact, pair, steps}
    type E = { urg: number; key: number; job: number; crew: number; exact: boolean; p: Pair; steps?: Tile[] };
    const heap: E[] = [];
    const push = (e: E): void => {
      heap.push(e);
      let i = heap.length - 1;
      while (i > 0) { const q = (i - 1) >> 1; if (cmp(heap[i] as E, heap[q] as E) >= 0) break; [heap[i], heap[q]] = [heap[q] as E, heap[i] as E]; i = q; }
    };
    const pop = (): E => {
      const top = heap[0] as E;
      const last = heap.pop() as E;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && cmp(heap[l] as E, heap[m] as E) < 0) m = l;
          if (r < heap.length && cmp(heap[r] as E, heap[m] as E) < 0) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m] as E, heap[i] as E];
          i = m;
        }
      }
      return top;
    };
    for (const p of pairs) {
      const f = exactSteps.get(p);
      if (f) { if (p.cost !== Infinity) push({ urg: p.urg, key: p.cost + p.off, job: p.job, crew: p.c.id, exact: true, p }); }
      else push({ urg: p.urg, key: octileBound(p.c.from, p.goal) + p.off, job: p.job, crew: p.c.id, exact: false, p });
    }
    while (heap.length) {
      const e = pop();
      if (crewDone.has(e.crew) || jobDone.has(e.job)) continue;
      if (!e.exact) {
        const r = astar(e.p.c.view(e.p.k) as View, e.p.c.from, e.p.goal);
        if (!r) continue;
        e.p.cost = r.cost;
        push({ ...e, key: r.cost + e.p.off, exact: true, steps: r.steps });
        continue;
      }
      crewDone.add(e.crew);
      jobDone.add(e.job);
      out.push({ p: e.p, steps: e.steps ?? exactSteps.get(e.p)?.() ?? [] });
    }
    return out;
  }
  const steps = costAll(pairs, oracle);
  const live = pairs.filter((p) => p.cost !== Infinity);
  live.sort((a, b) => cmp({ urg: a.urg, key: a.cost + a.off, job: a.job, crew: a.c.id }, { urg: b.urg, key: b.cost + b.off, job: b.job, crew: b.c.id }));
  for (const p of live) {
    if (crewDone.has(p.c.id) || jobDone.has(p.job)) continue;
    crewDone.add(p.c.id);
    jobDone.add(p.job);
    out.push({ p, steps: (steps.get(p) as () => Tile[])() });
  }
  return out;
}

/** Regret counter for `verify`: passes whose matching differs from the exhaustive reference. */
export const regret = { passes: 0, mismatches: 0 };

export function globalPass(sim: Sim, ids: number[], oracle: Oracle, verify = false): Set<number> {
  const taken = new Set<number>();
  const jobs = openJobs(sim);
  if (jobs.length === 0) return taken;
  const crews = ids.map((id) => new CrewCtx(sim, id, sim.world.get(id, PositionC) as Position));
  const assigned = new Set<number>();
  const jobShip = new Map<number, number>();
  for (const j of jobs) jobShip.set(j, shipIdOf(sim, sim.world.get(j, JobC) as Job));
  for (let level = 1; level <= 4; level++) {
    const pairs: Pair[] = [];
    for (const c of crews) {
      if (taken.has(c.id)) continue;
      for (const jobId of jobs) {
        if (assigned.has(jobId) || jobShip.get(jobId) !== c.ship) continue;
        const job = sim.world.get(jobId, JobC) as Job;
        const a = admit(sim, c, job, level);
        if (!a) continue;
        const goal = jobGoal(job);
        const k = c.classify(goal);
        if (k < 0) continue;
        const off = 10 * (((c.modes[k] as ModeStep).thin ? EVA_JOB_PENALTY : 0) + (a.relief ? RELIEF_PENALTY : 0) - operateAffinity(sim, c.id, job));
        pairs.push({ c, job: jobId, goal, k, urg: repairUrgency(sim, job), off, cost: Infinity });
      }
    }
    if (pairs.length === 0) continue;
    const result = match(pairs, oracle);
    if (verify && oracle !== 'exhaustive') {
      regret.passes++;
      const ref = match(pairs.map((p) => ({ ...p, cost: Infinity })), 'exhaustive');
      const a = result.map((r) => `${r.p.c.id}:${r.p.job}`).join(',');
      const b = ref.map((r) => `${r.p.c.id}:${r.p.job}`).join(',');
      if (a !== b) regret.mismatches++;
    }
    for (const { p, steps } of result) {
      taken.add(p.c.id);
      assigned.add(p.job);
      reserveJob(sim, p.c.id, p.job, steps);
      const src = (p.c.modes[p.k] as ModeStep).thin ? p.c.source() : null;
      if (src) startErrand(sim, p.c.id, 'suitUp', src, p.c.ship, p.job);
    }
  }
  return taken;
}

/** Pass gate: run on a change of inputs or every `cadence` ticks. */
function gated(batch: (sim: Sim, ids: number[]) => Set<number>, cadence = 20): (sim: Sim, ids: number[]) => Set<number> {
  let last = '';
  let lastTick = -1e9;
  return (sim, ids) => {
    const g = sim.sector.grid;
    const sig = `${openJobs(sim).join(',')}|${ids.join(',')}|${g.revision('struct')},${g.revision('jam')},${g.revision('module')}`;
    if (sig === last && sim.tick - lastTick < cadence) return new Set();
    last = sig;
    lastTick = sim.tick;
    return batch(sim, ids);
  };
}

const perCrewBatch = (pick: (sim: Sim, id: number, pos: Position) => boolean) => (sim: Sim, ids: number[]): Set<number> => {
  const out = new Set<number>();
  for (const id of ids) if (pick(sim, id, sim.world.get(id, PositionC) as Position)) out.add(id);
  return out;
};

export const CANDIDATES: Record<string, (verify: boolean) => PickerHook | undefined> = {
  legacy: () => ({ perCrew: pickJob }),
  prune: () => ({ perCrew: prunePick }),
  'prune+gate': () => ({ batch: gated(perCrewBatch(prunePick)) }),
  prune2: () => ({ perCrew: (sim, id, pos) => prunePick(sim, id, pos, true) }),
  'prune2+gate': () => ({ batch: gated(perCrewBatch((sim, id, pos) => prunePick(sim, id, pos, true))) }),
  gA: (v) => ({ batch: (sim, ids) => globalPass(sim, ids, 'lazyA', v) }),
  gC: (v) => ({ batch: (sim, ids) => globalPass(sim, ids, 'dijkstra', v) }),
  gB: (v) => ({ batch: (sim, ids) => globalPass(sim, ids, 'field', v) }),
  gX: () => ({ batch: (sim, ids) => globalPass(sim, ids, 'exhaustive') }),
  gH: (v) => ({ batch: (sim, ids) => globalPass(sim, ids, 'hybrid', v) }),
  'gH+gate': (v) => ({ batch: gated((sim, ids) => globalPass(sim, ids, 'hybrid', v)) }),
  'gA+gate': (v) => ({ batch: gated((sim, ids) => globalPass(sim, ids, 'lazyA', v)) }),
  'gC+gate': (v) => ({ batch: gated((sim, ids) => globalPass(sim, ids, 'dijkstra', v)) }),
};

export { WORK_CATEGORIES, isErrand };
