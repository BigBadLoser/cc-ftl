import { JobC, PositionC, PrioritiesC, type Job, type Position, type Priorities } from '../crew/components';
import { jobGoal, origin } from '../crew/helpers';
import type { PathGoal, Tile } from '../crew/pathfind';
import { findSuitSource, type SuitSource } from '../eva/errands';
import { AirlockC } from '../modules/airlock';
import { airlockSuits, airlockUsable } from '../eva/suit';
import { needsMaterials } from '../items/materials';
import { siteWalkModes, type WalkMode } from '../eva/route';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { SCHED_CADENCE, SCHED_DIJKSTRA_ABOVE } from '../tuning';
import { isEmergency } from './emergency';
import { admitLevel, pairCost, repairUrgency } from './jobRank';
import { startErrand } from './machines/eva';
import { astar, dijkstraFrom } from './navSearch';
import { goalTiles, isFallbackStop, isGoalTile, octileBound, reaches, startLabels, viewOf, type View } from './navView';
import { reserveJob } from './task';

/**
 * The job scheduler (docs/CREW_AI.md 7.1 and 7.4, Phase 2). Free crew are matched to open jobs together, one priority level at a time: of
 * every admissible (crew member, job) pair, the lowest tuple `(-urgency, pathCost + pairCost, jobId, crewId)` is assigned and both leave, until
 * none remain; then the next level. So the nearest crew member gets a job (not the lowest id), and a crew member is taken at the best level
 * where any job is reachable for them. Walks follow `planSiteWalk`'s mode order: the first mode that reaches the job is the one costed.
 *
 * Costs are exact. A component labelling per (ship, mode) rules out unreachable jobs without a search. A crew member with more than
 * SCHED_DIJKSTRA_ABOVE candidate jobs in a mode gets one multi-goal Dijkstra; smaller sets are costed lazily, by A* only when a pair's lower
 * bound reaches the top of the queue. A pass runs when the open jobs (or their funding), the free crew, the walkable tiles, thin air (the
 * sector grid's count of oxygen writes across the thin-air line) or the suit stock changed, on every tick while an emergency (fire, breach,
 * rescue) is open, and every SCHED_CADENCE ticks regardless (fight state and other job fields change the outcome without changing that). The
 * gate's memory is `sector.sched`, saved with it.
 *
 * Suits are booked as matches are accepted: a thin-air match looks up its suit source then (`findSuitSource` counts the suit errands already
 * started, this pass's included), so an airlock is never promised more suits than it holds; with none left the match is passed over.
 */

/** One free crew member as a pass sees them. Views, start components and the suit source are looked up on first use. */
class Walker {
  readonly from: Tile;
  readonly ship: number;
  readonly prio: Priorities;
  readonly modes: WalkMode[];
  private views: (View | null)[] = [];
  private starts: number[][] = [];
  private src: SuitSource | null | undefined;
  constructor(private sim: Sim, readonly id: number, readonly pos: Position) {
    this.from = origin(pos);
    this.ship = shipIdOf(sim, pos);
    this.prio = sim.world.get(id, PrioritiesC) as Priorities;
    this.modes = siteWalkModes(sim, id, this.ship);
  }
  /** A suit source as the pass began (the cheap filter of `modeFor`); `bookSource` looks again when a match is accepted. */
  source(): SuitSource | null {
    if (this.src === undefined) this.src = findSuitSource(this.sim, this.id, this.pos) ?? null;
    return this.src;
  }
  /** The suit source now, after the suit errands this pass has already started; none left also rules out this walker's other thin pairs. */
  bookSource(): SuitSource | null {
    if (this.src === null) return null;
    this.src = findSuitSource(this.sim, this.id, this.pos) ?? null;
    return this.src;
  }
  view(k: number): View | null {
    if (this.views[k] === undefined) this.views[k] = viewOf(this.sim, this.ship, (this.modes[k] as WalkMode).opts);
    return this.views[k] as View | null;
  }
  /** The first mode that reaches the goal (a thin mode only with a suit to be had), or -1. No search. */
  modeFor(goal: PathGoal): number {
    for (let k = 0; k < this.modes.length; k++) {
      if ((this.modes[k] as WalkMode).thin && !this.source()) return -1;
      const v = this.view(k);
      if (!v) continue;
      this.starts[k] ??= startLabels(v, this.from);
      if (reaches(v, this.from, this.starts[k] as number[], goal)) return k;
    }
    return -1;
  }
}

interface Pair {
  w: Walker;
  job: number;
  goal: PathGoal;
  /** Index of the walk mode in `w.modes`. */
  k: number;
  urgency: number;
  extra: number;
}

/** A queue entry: a pair's tuple, exact or still a lower bound. */
interface Entry {
  urgency: number;
  key: number;
  job: number;
  crew: number;
  pair: Pair;
  steps?: () => Tile[];
}

const before = (a: Entry, b: Entry): boolean =>
  a.urgency !== b.urgency ? a.urgency > b.urgency : a.key !== b.key ? a.key < b.key : a.job !== b.job ? a.job < b.job : a.crew < b.crew;

class EntryHeap {
  private a: Entry[] = [];
  get size(): number {
    return this.a.length;
  }
  push(e: Entry): void {
    const a = this.a;
    a.push(e);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!before(a[i] as Entry, a[p] as Entry)) break;
      [a[i], a[p]] = [a[p] as Entry, a[i] as Entry];
      i = p;
    }
  }
  pop(): Entry {
    const a = this.a;
    const top = a[0] as Entry;
    const last = a.pop() as Entry;
    if (a.length === 0) return top;
    a[0] = last;
    for (let i = 0; ; ) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < a.length && before(a[l] as Entry, a[m] as Entry)) m = l;
      if (r < a.length && before(a[r] as Entry, a[m] as Entry)) m = r;
      if (m === i) break;
      [a[i], a[m]] = [a[m] as Entry, a[i] as Entry];
      i = m;
    }
    return top;
  }
}

/** Exact entries for a (crew member, mode) group by one multi-goal Dijkstra; unreachable pairs are left out. */
function dijkstraEntries(group: Pair[]): Entry[] {
  const { w, k } = group[0] as Pair;
  const v = w.view(k) as View;
  const goals = new Map<number, number[]>();
  const fallbacks = new Map<number, number[]>();
  const out: Entry[] = [];
  for (const p of group) {
    if (isGoalTile(p.goal, w.from.x, w.from.y)) out.push({ urgency: p.urgency, key: p.extra, job: p.job, crew: w.id, pair: p, steps: () => [] });
    else {
      for (const t of goalTiles(v, p.goal)) {
        const into = isFallbackStop(v, p.goal, t) ? fallbacks : goals;
        into.set(t, [...(into.get(t) ?? []), p.job]);
      }
    }
  }
  if (goals.size === 0 && fallbacks.size === 0) return out;
  const r = dijkstraFrom(v, w.from, goals, fallbacks);
  for (const p of group) {
    const cost = r.cost.get(p.job);
    if (cost !== undefined && !isGoalTile(p.goal, w.from.x, w.from.y)) out.push({ urgency: p.urgency, key: cost + p.extra, job: p.job, crew: w.id, pair: p, steps: () => r.steps(p.job) });
  }
  return out;
}

/** Greedy lowest-tuple matching of one level's pairs. `accept` applies a match, or refuses it (the pair is dropped, both sides stay free). */
function matchPairs(pairs: Pair[], accept: (pair: Pair, steps: Tile[]) => boolean): void {
  const heap = new EntryHeap();
  const groups = new Map<string, Pair[]>();
  for (const p of pairs) {
    const key = `${p.w.id}|${p.k}`;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  for (const group of groups.values()) {
    if (group.length > SCHED_DIJKSTRA_ABOVE) for (const e of dijkstraEntries(group)) heap.push(e);
    else for (const p of group) heap.push({ urgency: p.urgency, key: octileBound(p.w.from, p.goal) + p.extra, job: p.job, crew: p.w.id, pair: p });
  }
  const crewDone = new Set<number>(), jobDone = new Set<number>();
  while (heap.size > 0) {
    const e = heap.pop();
    if (crewDone.has(e.crew) || jobDone.has(e.job)) continue;
    if (!e.steps) {
      const r = astar(e.pair.w.view(e.pair.k) as View, e.pair.w.from, e.pair.goal);
      if (r) heap.push({ ...e, key: r.cost + e.pair.extra, steps: () => r.steps });
      continue;
    }
    if (!accept(e.pair, e.steps())) continue;
    crewDone.add(e.crew);
    jobDone.add(e.job);
  }
}

/** FNV-1a step over a 32-bit value. */
const mix = (h: number, n: number): number => Math.imul(h ^ (n | 0), 0x01000193);

/**
 * What a pass reads that has a cheap fingerprint: thin-air crossings, the suit stock, the open jobs and whether each is funded, the free crew,
 * and the walkable tiles of their ships. Save-stable (the crossing count is saved; no grid revisions), so a loaded game skips and runs the
 * same passes as a continuous one.
 */
function gateSig(sim: Sim, open: number[], free: Walker[]): number {
  let h = mix(0x811c9dc5, sim.sector.grid.crossings());
  // Suit stock: each airlock's suits, whether it can fit them, and the suit errands that have them spoken for.
  const wanted = new Map<number, number>();
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (j.kind === 'suitUp' && j.target) wanted.set(j.target, (wanted.get(j.target) ?? 0) + 1);
  }
  for (const a of [...sim.world.query(AirlockC)].sort((x, y) => x - y)) h = mix(mix(mix(h, a), airlockUsable(sim, a) ? airlockSuits(sim, a) : -1), wanted.get(a) ?? 0);
  for (const j of open) h = mix(h, 2 * j + (needsMaterials(sim.world.get(j, JobC) as Job) ? 1 : 0));
  h = mix(h, -1);
  const ships: number[] = [];
  for (const w of free) {
    h = mix(h, w.id);
    if (!ships.includes(w.ship)) ships.push(w.ship);
  }
  for (const ship of ships.sort((a, b) => a - b)) {
    h = mix(h, ship);
    for (const suited of [false, true]) h = mix(h, viewOf(sim, ship, { suited })?.hash ?? 0);
  }
  return h >>> 0;
}

/**
 * Assign jobs to the free crew `ids` (in id order). Returns the ones that got a job; the rest are left to idle. A thin-air walk sends the crew
 * member for a suit first (the job is reserved and resumed after the errand), as the legacy picker did.
 */
export function assignJobs(sim: Sim, ids: number[]): Set<number> {
  const taken = new Set<number>();
  const open = sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.reservedBy === 0).sort((a, b) => a - b);
  if (open.length === 0 || ids.length === 0) return taken;
  const walkers = ids.map((id) => new Walker(sim, id, sim.world.get(id, PositionC) as Position));
  const sig = gateSig(sim, open, walkers);
  const gate = sim.sector.sched;
  const emergency = open.some((j) => isEmergency(sim.world.get(j, JobC) as Job));
  if (!emergency && gate && gate.sig === sig && sim.tick - gate.at < SCHED_CADENCE) return taken;
  sim.sector.sched = { sig, at: sim.tick };

  const jobs = open.map((id) => {
    const job = sim.world.get(id, JobC) as Job;
    return { id, job, ship: shipIdOf(sim, job), goal: jobGoal(job), urgency: repairUrgency(sim, job) };
  });
  const assigned = new Set<number>();
  for (let level = 1; level <= 4; level++) {
    const pairs: Pair[] = [];
    for (const w of walkers) {
      if (taken.has(w.id)) continue;
      for (const j of jobs) {
        if (assigned.has(j.id) || j.ship !== w.ship) continue;
        const admit = admitLevel(sim, w.id, w.pos, w.prio, j.job, level);
        if (!admit) continue;
        const k = w.modeFor(j.goal);
        if (k < 0) continue;
        pairs.push({ w, job: j.id, goal: j.goal, k, urgency: j.urgency, extra: pairCost(sim, w.id, j.job, (w.modes[k] as WalkMode).thin, admit.relief) });
      }
    }
    matchPairs(pairs, (pair, steps) => {
      const w = pair.w;
      const thin = (w.modes[pair.k] as WalkMode).thin;
      const src = thin ? w.bookSource() : null;
      if (thin && !src) return false;
      taken.add(w.id);
      assigned.add(pair.job);
      reserveJob(sim, w.id, pair.job, steps);
      if (src) startErrand(sim, w.id, 'suitUp', src, w.ship, pair.job);
      return true;
    });
  }
  return taken;
}
