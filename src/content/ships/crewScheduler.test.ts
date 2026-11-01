import { describe, expect, it } from 'vitest';
import { AssignmentC, CrewC, JobC, ModuleC, PathC, PositionC, PrioritiesC, WORK_CATEGORIES, findPath, homeShip, newGame, shipGrid, type Job, type Priorities, type Sim } from '../../sim';
import { admitLevel, pairCost, repairUrgency } from '../../sim/ai/jobRank';
import { astar, dijkstraFrom } from '../../sim/ai/navSearch';
import { goalTiles, indexOf, isFallbackStop, reaches, startLabels, viewOf } from '../../sim/ai/navView';
import { assignJobs } from '../../sim/ai/scheduler';
import { abortTask } from '../../sim/ai/task';
import { jobGoal, origin } from '../../sim/crew/helpers';
import type { PathOpts, Tile } from '../../sim/crew/pathfind';
import { findSuitSource } from '../../sim/eva/errands';
import { airlockSuits } from '../../sim/eva/suit';
import { AirlockC } from '../../sim/modules/airlock';
import { placementError, removeModule, spawnModule } from '../../sim/modules/spawn';
import { planSiteWalk } from '../../sim/eva/route';
import { destroyJob } from '../../sim/items/stacks';
import { shipIdOf } from '../../sim/regions';
import { DoorJam, Struct, isWalkable } from '../../sim/structure';
import { SCHED_CADENCE, SCHED_DIJKSTRA_ABOVE } from '../../sim/tuning';
import { content } from '../index';

/**
 * The job scheduler (docs/CREW_AI.md 7.4, #194 Phase 2). Its navigation views agree with `findPath` tile for tile; its matching equals an
 * exhaustive reference built on the legacy walk planner (`planSiteWalk`, every pair searched); priorities are strict; the nearest crew member
 * wins; the pass gate skips only unchanged inputs and runs again on the cadence.
 */

const run = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) {
    sim.step();
    sim.events.drain();
  }
};

/** Deterministic LCG for picking tiles. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return (n: number): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
};

const all = (v: number): Priorities => Object.fromEntries(WORK_CATEGORIES.map((c) => [c, v])) as unknown as Priorities;

/** A starter ship with every job gone and every crew member free, standing still. */
function board(seed: number): { sim: Sim; ship: number; crew: number[]; floor: Tile[] } {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  const crew = [...sim.world.query(CrewC)];
  for (const c of crew) if (sim.world.has(c, AssignmentC)) abortTask(sim, c, 'jobGone');
  for (const j of [...sim.world.query(JobC)]) destroyJob(sim, j);
  for (const c of crew) {
    const p = sim.world.get(c, PositionC)!;
    sim.world.add(c, PositionC, { ...p, x: p.toX, y: p.toY, progress: 0 });
    sim.world.add(c, PathC, { steps: [] });
  }
  const g = shipGrid(sim, ship)!;
  const floor: Tile[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) floor.push({ x, y });
  return { sim, ship, crew, floor };
}

function postJob(sim: Sim, t: Tile, extra: Partial<Job> = {}): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { category: 'construction', kind: 'build', x: t.x, y: t.y, struct: Struct.Wall, work: 100, progress: 0, reservedBy: 0, ...extra } as Job);
  return id;
}

const NB: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

/** `findPath`'s cost of a walk: 10 a straight step, 14 a diagonal, four times that onto an exterior tile. */
function walkCost(sim: Sim, ship: number, from: Tile, steps: Tile[]): number {
  const g = shipGrid(sim, ship)!;
  let cost = 0;
  let at = from;
  for (const s of steps) {
    cost += (s.x !== at.x && s.y !== at.y ? 14 : 10) * (isWalkable(g.get('struct', s.x, s.y)) ? 1 : 4);
    at = s;
  }
  return cost;
}

/** The exhaustive reference: every admitted pair searched with `planSiteWalk`, the lowest tuple taken first, level by level. */
function reference(sim: Sim, crew: number[]): Map<number, { job: number; cost: number }> {
  const out = new Map<number, { job: number; cost: number }>();
  const open = sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.reservedBy === 0).sort((a, b) => a - b);
  const jobsTaken = new Set<number>();
  for (let level = 1; level <= 4; level++) {
    const pairs: { crew: number; job: number; urgency: number; key: number; cost: number }[] = [];
    for (const c of crew) {
      if (out.has(c)) continue;
      const pos = sim.world.get(c, PositionC)!;
      const prio = sim.world.get(c, PrioritiesC) as Priorities;
      for (const j of open) {
        if (jobsTaken.has(j)) continue;
        const job = sim.world.get(j, JobC)!;
        const admit = admitLevel(sim, c, pos, prio, job, level);
        if (!admit) continue;
        const plan = planSiteWalk(sim, c, shipIdOf(sim, pos), origin(pos), jobGoal(job), () => !!findSuitSource(sim, c, pos));
        if (!plan) continue;
        const cost = walkCost(sim, shipIdOf(sim, pos), origin(pos), plan.steps);
        pairs.push({ crew: c, job: j, urgency: repairUrgency(sim, job), key: cost + pairCost(sim, c, job, plan.thin, admit.relief), cost });
      }
    }
    pairs.sort((a, b) => b.urgency - a.urgency || a.key - b.key || a.job - b.job || a.crew - b.crew);
    for (const p of pairs) {
      if (out.has(p.crew) || jobsTaken.has(p.job)) continue;
      out.set(p.crew, { job: p.job, cost: p.cost });
      jobsTaken.add(p.job);
    }
  }
  return out;
}

/** What `assignJobs` reserved: crew to job and the cost of the reserved walk. */
function assigned(sim: Sim, crew: number[]): Map<number, { job: number; cost: number }> {
  const out = new Map<number, { job: number; cost: number }>();
  for (const c of crew) {
    const a = sim.world.get(c, AssignmentC);
    if (!a) continue;
    const pos = sim.world.get(c, PositionC)!;
    out.set(c, { job: a.jobId, cost: walkCost(sim, shipIdOf(sim, pos), origin(pos), sim.world.get(c, PathC)!.steps) });
  }
  return out;
}

describe('crew scheduler: navigation views', () => {
  it('reach and walk exactly as findPath, under every walker condition, with shut doors, thin air and a thin start', () => {
    const { sim, ship, floor } = board(4);
    const g = shipGrid(sim, ship)!;
    const pick = lcg(11);
    for (let i = 0; i < 6; i++) {
      const t = floor[pick(floor.length)]!;
      g.set('jam', t.x, t.y, DoorJam.Shut);
    }
    for (let i = 0; i < 25; i++) {
      const t = floor[pick(floor.length)]!;
      g.set('o2', t.x, t.y, 0);
    }
    const modes: PathOpts[] = [{}, { avoidThin: true }, { suited: true }, { avoidThin: true, suited: true }];
    let reached = 0;
    for (const opts of modes) {
      const v = viewOf(sim, ship, opts)!;
      for (let i = 0; i < 300; i++) {
        const from = floor[pick(floor.length)]!;
        const to = floor[pick(floor.length)]!;
        const goal = i % 3 === 0 ? { x: to.x, y: to.y } : { x: to.x, y: to.y, adjacent: true, w: 1 + (i % 2), h: 1 };
        const want = findPath(sim, ship, from, goal, opts);
        expect(reaches(v, from, startLabels(v, from), goal), `${JSON.stringify(opts)} ${JSON.stringify(from)} -> ${JSON.stringify(goal)}`).toBe(want !== null);
        expect(astar(v, from, goal)?.steps ?? null).toEqual(want);
        if (want) reached++;
      }
    }
    expect(reached).toBeGreaterThan(400);
  });

  it('stop beside a doorway only when no other stop is reachable, as findPath does (#248), in A* and Dijkstra alike', () => {
    const { sim, ship, floor } = board(5);
    const g = shipGrid(sim, ship)!;
    const doors: Tile[] = [];
    for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Door) doors.push({ x, y });
    expect(doors.length).toBeGreaterThan(0);
    // Goals whose ring holds a doorway; jam a few tiles at random.
    const goals = floor.filter((t) => doors.some((d) => Math.max(Math.abs(d.x - t.x), Math.abs(d.y - t.y)) === 1)).map((t) => ({ x: t.x, y: t.y, adjacent: true }));
    const pick = lcg(5);
    for (let i = 0; i < 8; i++) {
      const t = floor[pick(floor.length)]!;
      g.set('jam', t.x, t.y, DoorJam.Shut);
    }
    // Fence three goals so that their doorway is the only reachable stop: shut every other tile of their ring.
    const fenced = goals.filter((_, i) => i % Math.max(1, Math.floor(goals.length / 3)) === 0).slice(0, 3);
    for (const t of fenced) {
      for (let y = t.y - 1; y <= t.y + 1; y++) for (let x = t.x - 1; x <= t.x + 1; x++) {
        if ((x !== t.x || y !== t.y) && g.get('struct', x, y) !== Struct.Door) g.set('jam', x, y, DoorJam.Shut);
      }
    }
    const v = viewOf(sim, ship, {})!;
    let onDoor = 0, checked = 0;
    for (let i = 0; i < 300; i++) {
      const from = floor[pick(floor.length)]!;
      const goal = i % 3 === 0 ? fenced[i % fenced.length]! : goals[pick(goals.length)]!;
      const want = findPath(sim, ship, from, goal, {});
      const got = astar(v, from, goal);
      expect(got?.steps ?? null, `${JSON.stringify(from)} -> ${JSON.stringify(goal)}`).toEqual(want);
      if (!got || got.steps.length === 0) continue;
      const end = got.steps[got.steps.length - 1]!;
      if (g.get('struct', end.x, end.y) === Struct.Door) onDoor++;
      const proper = new Map<number, number[]>(), fb = new Map<number, number[]>();
      for (const t of goalTiles(v, goal)) (isFallbackStop(v, goal, t) ? fb : proper).set(t, [0]);
      const r = dijkstraFrom(v, from, proper, fb);
      expect(r.cost.get(0)).toBe(got.cost);
      const dEnd = r.steps(0).at(-1)!;
      expect(isFallbackStop(v, goal, indexOf(v, dEnd.x, dEnd.y))).toBe(g.get('struct', end.x, end.y) === Struct.Door);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
    expect(onDoor).toBeLessThan(checked);
    expect(onDoor).toBeGreaterThan(0);
  });
});

describe('crew scheduler: matching', () => {
  for (const [n, seed] of [[3, 1], [SCHED_DIJKSTRA_ABOVE, 2], [SCHED_DIJKSTRA_ABOVE + 1, 3], [30, 4], [60, 5]] as const) {
    it(`assigns as the exhaustive reference: ${n} jobs, mixed priority levels, a shut-off corner (seed ${seed})`, () => {
      const { sim, ship, crew, floor } = board(seed);
      const pick = lcg(seed * 7);
      // Crew rank construction and hauling differently, so pairs fall on several levels.
      crew.forEach((c, i) => sim.world.add(c, PrioritiesC, { ...all(0), construction: 1 + (i % 3), hauling: 1 + ((i + 1) % 3) }));
      for (let i = 0; i < n; i++) postJob(sim, floor[pick(floor.length)]!, { category: i % 2 ? 'hauling' : 'construction' });
      // A job no one can reach: fenced in by shut door jams.
      const g = shipGrid(sim, ship)!;
      const t = floor[pick(floor.length)]!;
      for (const [dx, dy] of NB) g.set('jam', t.x + dx, t.y + dy, DoorJam.Shut);
      const walled = postJob(sim, t);
      const want = reference(sim, crew);
      sim.sector.sched = undefined;
      const taken = assignJobs(sim, crew);
      const got = assigned(sim, crew);
      expect(got).toEqual(want);
      expect([...taken].sort()).toEqual([...want.keys()].sort());
      expect(sim.world.get(walled, JobC)!.reservedBy).toBe(0);
      expect(want.size).toBeGreaterThan(0);
    });
  }

  it('is strict: a crew member takes a far job at a better level over a near one at a worse level', () => {
    const { sim, crew, floor } = board(1);
    const [a] = crew as [number];
    sim.world.add(a, PrioritiesC, { ...all(0), construction: 1, hauling: 2 });
    const pos = sim.world.get(a, PositionC)!;
    const byDist = [...floor].sort((p, q) => Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) - Math.max(Math.abs(q.x - pos.x), Math.abs(q.y - pos.y)));
    const near = postJob(sim, byDist[2]!, { category: 'hauling' });
    const far = postJob(sim, byDist[byDist.length - 1]!, { category: 'construction' });
    sim.sector.sched = undefined;
    assignJobs(sim, [a]);
    expect(sim.world.get(a, AssignmentC)?.jobId).toBe(far);
    expect(sim.world.get(near, JobC)!.reservedBy).toBe(0);
  });

  it('gives a job to the nearest crew member, not the lowest id', () => {
    const { sim, crew, floor } = board(1);
    const [a, b] = crew as [number, number];
    for (const c of [a, b]) sim.world.add(c, PrioritiesC, { ...all(0), construction: 1 });
    const pb = sim.world.get(b, PositionC)!;
    const pa = sim.world.get(a, PositionC)!;
    const d = (p: Tile, q: Tile): number => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
    const site = floor.filter((t) => d(t, pb) === 1 && d(t, pa) > 3)[0]!;
    const job = postJob(sim, site);
    sim.sector.sched = undefined;
    assignJobs(sim, [a, b]);
    expect(sim.world.get(job, JobC)!.reservedBy).toBe(b);
    expect(sim.world.has(a, AssignmentC)).toBe(false);
  });
});

describe('crew scheduler: suits', () => {
  it('books suits as matches are accepted: an airlock is never promised more suits than it holds, the next one is used instead', () => {
    const { sim, ship, crew, floor } = board(3);
    const g = shipGrid(sim, ship)!;
    const [near] = [...sim.world.query(AirlockC)] as [number];
    sim.world.get(near, AirlockC)!.suits = 1;
    // A second airlock with its full stock, as far from the first as it can be placed (the starter is packed: clear the modules of its
    // far corner first).
    const at = sim.world.get(near, ModuleC)!;
    for (const m of [...sim.world.query(ModuleC)]) {
      const mod = sim.world.get(m, ModuleC)!;
      if (m !== near && Math.abs(mod.x - at.x) > 12 && shipIdOf(sim, mod) === ship) removeModule(sim, m);
    }
    let best: { x: number; y: number; rot: number; d: number } | null = null;
    for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) for (const rot of [0, 1, 2, 3]) {
      const d = Math.abs(x - at.x) + Math.abs(y - at.y);
      if ((!best || d > best.d) && placementError(sim, ship, 'module.airlock', x, y, rot) === null) best = { x, y, rot, d };
    }
    expect(best).not.toBeNull();
    const far = spawnModule(sim, 'module.airlock', best!.x, best!.y, best!.rot);
    expect(airlockSuits(sim, far)).toBeGreaterThanOrEqual(2);
    // Sites out on the hull: reachable only in a suit. Crew are moved next to the one-suit airlock, so it is everyone's nearest.
    const from = floor.sort((p, q) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) - (Math.abs(q.x - at.x) + Math.abs(q.y - at.y)));
    const team = crew.filter((c) => sim.world.get(c, CrewC)!.species !== 'species.robot').slice(0, 3);
    expect(team.length).toBe(3);
    team.forEach((c, i) => {
      const t = from[i]!;
      sim.world.add(c, PositionC, { x: t.x, y: t.y, toX: t.x, toY: t.y, progress: 0, facing: 0 });
      sim.world.add(c, PrioritiesC, { ...all(0), construction: 1 });
    });
    const sites: Tile[] = [];
    for (let y = g.y0; y < g.y0 + g.height && sites.length < 3; y++) for (let x = g.x0; x < g.x0 + g.width && sites.length < 3; x++) {
      const goal = { x, y, adjacent: true };
      if (g.get('struct', x, y) === Struct.Space && !findPath(sim, ship, from[0]!, goal, {}) && findPath(sim, ship, from[0]!, goal, { suited: true })) sites.push({ x, y });
    }
    expect(sites.length).toBe(3);
    for (const t of sites) postJob(sim, t);
    sim.sector.sched = undefined;
    assignJobs(sim, team);
    const errands = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).filter((j) => j.kind === 'suitUp');
    expect(errands.filter((j) => j.target === near).length).toBe(1);
    expect(errands.filter((j) => j.target === far).length).toBe(2);
    expect(team.every((c) => sim.world.has(c, AssignmentC))).toBe(true);
  });
});

describe('crew scheduler: pass gate', () => {
  it('skips a pass whose inputs did not change, runs on a new job at once and on the cadence regardless', () => {
    const { sim, ship, crew, floor } = board(2);
    for (const c of crew) sim.world.add(c, PrioritiesC, { ...all(0), construction: 1 });
    const g = shipGrid(sim, ship)!;
    const t = floor[floor.length >> 1]!;
    for (const [dx, dy] of NB) g.set('jam', t.x + dx, t.y + dy, DoorJam.Shut);
    postJob(sim, t); // unreachable: every pass assigns nothing
    sim.sector.sched = undefined;
    assignJobs(sim, crew);
    const first = sim.sector.sched!;
    expect(first.at).toBe(sim.tick);
    sim.tick += 1;
    assignJobs(sim, crew);
    expect(sim.sector.sched).toBe(first); // unchanged inputs: skipped
    // Unjam the fence: the walkable tiles changed, so the next call runs and takes the job.
    for (const [dx, dy] of NB) g.set('jam', t.x + dx, t.y + dy, DoorJam.None);
    assignJobs(sim, crew);
    expect(sim.sector.sched!.at).toBe(sim.tick);
    expect(crew.some((c) => sim.world.has(c, AssignmentC))).toBe(true);
    // A new job (fenced in again, so nobody takes it) is a new input; then nothing changes until the cadence comes round.
    const free = crew.filter((c) => !sim.world.has(c, AssignmentC));
    for (const [dx, dy] of NB) g.set('jam', t.x + dx, t.y + dy, DoorJam.Shut);
    sim.tick += 1;
    postJob(sim, t);
    assignJobs(sim, free);
    const gate = sim.sector.sched!;
    expect(gate.at).toBe(sim.tick);
    sim.tick += SCHED_CADENCE - 1;
    assignJobs(sim, free);
    expect(sim.sector.sched).toBe(gate);
    sim.tick += 1;
    assignJobs(sim, free);
    expect(sim.sector.sched!.at).toBe(sim.tick);
  });

  it('wakes on thin air and on suit stock, and never holds back while an emergency is open', () => {
    const { sim, ship, crew, floor } = board(2);
    for (const c of crew) sim.world.add(c, PrioritiesC, { ...all(0), construction: 1 });
    const g = shipGrid(sim, ship)!;
    const t = floor[floor.length >> 1]!;
    for (const [dx, dy] of NB) g.set('jam', t.x + dx, t.y + dy, DoorJam.Shut);
    postJob(sim, t); // unreachable: every pass assigns nothing
    sim.sector.sched = undefined;
    assignJobs(sim, crew);
    const ran = (): boolean => {
      const before = sim.sector.sched;
      sim.tick += 1;
      assignJobs(sim, crew);
      return sim.sector.sched !== before;
    };
    expect(ran()).toBe(false);
    // A small oxygen change that stays breathable is no input; a tile going thin is.
    const air = floor[0]!;
    g.set('o2', air.x, air.y, (g.get('o2', air.x, air.y) as number) - 0.5);
    expect(ran()).toBe(false);
    g.set('o2', air.x, air.y, 0);
    expect(ran()).toBe(true);
    expect(ran()).toBe(false);
    // A suit taken from the airlock.
    const [lock] = [...sim.world.query(AirlockC)] as [number];
    sim.world.get(lock, AirlockC)!.suits = airlockSuits(sim, lock) - 1;
    expect(ran()).toBe(true);
    expect(ran()).toBe(false);
    // An open emergency (a fire nobody can reach): a pass every tick.
    postJob(sim, t, { kind: 'extinguish', category: 'firefighting' });
    expect(ran()).toBe(true);
    expect(ran()).toBe(true);
  });
});
