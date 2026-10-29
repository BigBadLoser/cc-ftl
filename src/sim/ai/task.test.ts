import { describe, expect, it } from 'vitest';
import {
  AssignmentC, BedClaimC, CrewC, EatC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import { CarryingC } from '../items/components';
import { ModuleC } from '../modules/components';
import { stampShip } from '../combat/ships';
import type { ContentRegistry } from '../registry';
import { translated } from '../sector/translate';
import { cutLeaving } from '../sector/refs';
import { Sim } from '../sim';
import { auditReservations } from './audit';
import { classOf, machineStates } from './classes';
import { IntentC, InterruptC, TaskC } from './components';
import { explainCrew, taskPath } from './explain';
import { abortTask, attachJob, reserveJob, syncTask, type AbortReason } from './task';

const rows = ['#########', '#___#___#', '#___D___#', '#___#___#', '#########'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: { ...all(4), construction: 1 } } },
  modules: { 'module.bed': { name: 'Bed', footprint: [1, 1], maxHp: 10, power: 0, bed: true } as unknown as ContentRegistry['modules'][string] },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A', 'B', 'C'],
  items: { 'item.metal': { name: 'Metal' } as unknown as ContentRegistry['items'][string] },
  recipes: {},
  structCosts: {},
};

function make(): Sim {
  const sim = new Sim(7, content);
  stampShip(sim, content.ships['ship.t']!, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return sim;
}

function spawn(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.engineer', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all(4), construction: 1 });
  sim.world.add(id, NeedsC, { rest: 100 });
  return id;
}

function job(sim: Sim, kind: 'build' | 'haul' = 'build', x = 6, y = 1): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { category: 'construction', kind, x, y, struct: 1, work: 40, progress: 0, reservedBy: 0 });
  return id;
}

function bed(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, ModuleC, { def: 'module.bed', x, y, rot: 0, hp: 10, enabled: true, powered: false, powerPriority: 0, reservedBy: 0 } as never);
  return id;
}

describe('task API', () => {
  it('reserveJob holds the job, sets the path and mirrors it in Task; abortTask releases it and ends the task', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    const j = job(sim);
    const steps = [{ x: 2, y: 1 }];
    reserveJob(sim, c, j, steps);
    expect(sim.world.get(j, JobC)?.reservedBy).toBe(c);
    expect(sim.world.get(c, AssignmentC)?.jobId).toBe(j);
    expect(sim.world.get(c, PathC)?.steps).toBe(steps);
    expect(sim.world.get(c, TaskC)).toMatchObject({ job: j, machine: 'generic', state: 'Navigate', drive: 'work', class: 'any', stack: [], holds: [] });
    expect(auditReservations(sim).problems).toEqual([]);
    abortTask(sim, c, 'preempt');
    expect(sim.world.get(j, JobC)?.reservedBy).toBe(0);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
    expect(sim.world.get(c, PathC)?.steps).toEqual([]);
    expect(sim.world.has(c, TaskC)).toBe(false);
    expect(auditReservations(sim).problems).toEqual([]);
  });

  it('abortTask disposes of what the reason says: the bed claim, the load, a need in progress', () => {
    const cases: [AbortReason, { bed: boolean; load: boolean; wake: boolean }][] = [
      ['preempt', { bed: false, load: false, wake: false }],
      ['drafted', { bed: true, load: false, wake: false }],
      ['downed', { bed: true, load: false, wake: false }],
      ['equip', { bed: false, load: true, wake: false }],
      ['halted', { bed: true, load: true, wake: false }],
      ['fight', { bed: true, load: true, wake: true }],
    ];
    for (const [reason, want] of cases) {
      const sim = make();
      const c = spawn(sim, 1, 1);
      const b = bed(sim, 3, 3);
      (sim.world.get(b, ModuleC) as { reservedBy: number }).reservedBy = c;
      sim.world.add(c, BedClaimC, { bed: b });
      sim.world.add(c, CarryingC, { item: 'item.metal', count: 3 });
      (sim.world.get(c, CrewC) as { activity: string }).activity = 'sleeping';
      abortTask(sim, c, reason);
      expect(sim.world.has(c, BedClaimC), reason).toBe(!want.bed);
      expect(sim.world.get(b, ModuleC)?.reservedBy, reason).toBe(want.bed ? 0 : c);
      expect(sim.world.has(c, CarryingC), reason).toBe(!want.load);
      expect(sim.world.get(c, CrewC)?.activity, reason).toBe(want.wake ? 'idle' : 'sleeping');
    }
  });

  it('a dead crew member keeps no task, intent or interrupt', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    reserveJob(sim, c, job(sim));
    sim.world.add(c, IntentC, { policy: 'policy.legacy', drive: 'work', since: 0, scores: [0, 0, 0, 1000], nextEval: 1 });
    sim.world.add(c, InterruptC, { reason: 'downed', mode: 'abort', owner: 'none', since: 0 });
    abortTask(sim, c, 'dead');
    expect([TaskC, IntentC, InterruptC].map((k) => sim.world.has(c, k))).toEqual([false, false, false]);
  });

  it('a suit errand started for a job nests under it: the job is the root hold, the errand a child hold; it pops back', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    const j = job(sim);
    reserveJob(sim, c, j);
    const e = sim.world.createEntity();
    sim.world.add(e, JobC, { category: 'operating', kind: 'suitUp', x: 2, y: 2, struct: 0, work: 10, progress: 0, reservedBy: c, target: 99, errandFor: c, resume: j });
    attachJob(sim, c, e);
    const t = sim.world.get(c, TaskC)!;
    expect(t).toMatchObject({ job: j, machine: 'eva', state: 'ToAirlock', holds: [{ kind: 'errand', id: e }], bb: { aux: e, target: 99 } });
    expect(t.stack).toEqual([{ machine: 'generic', state: 'Navigate', class: 'any', bb: { target: 0 } }]);
    expect(taskPath(t)).toBe('generic/Navigate > eva/ToAirlock');
    expect(explainCrew(sim, c).task?.holds).toEqual([`job ${j}`, `errand ${e}`]);
    expect(auditReservations(sim).problems).toEqual([]);
    // the errand done: the parent pops
    sim.world.remove(c, AssignmentC);
    sim.world.destroyEntity(e);
    attachJob(sim, c, j);
    expect(sim.world.get(c, TaskC)).toMatchObject({ job: j, machine: 'generic', stack: [], holds: [] });
  });

  it('a pulled-away errand is left for the suits sweep, which the audit counts as pending, not as a leak', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    const j = job(sim);
    reserveJob(sim, c, j);
    const e = sim.world.createEntity();
    sim.world.add(e, JobC, { category: 'operating', kind: 'suitUp', x: 2, y: 2, struct: 0, work: 10, progress: 0, reservedBy: c, errandFor: c, resume: j });
    attachJob(sim, c, e);
    abortTask(sim, c, 'drafted');
    const r = auditReservations(sim);
    expect(r.problems).toEqual([]);
    expect(r.pendingSweep).toBe(1); // the job the errand set aside (the errand itself was released)
  });

  it('need tasks mirror the legacy components: bed claim, sleeping, meal', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    const b = bed(sim, 3, 3);
    (sim.world.get(b, ModuleC) as { reservedBy: number }).reservedBy = c;
    sim.world.add(c, BedClaimC, { bed: b });
    syncTask(sim, c);
    expect(sim.world.get(c, TaskC)).toMatchObject({ job: 0, drive: 'sleep', machine: 'sleep', state: 'Walk', holds: [{ kind: 'bed', id: b }] });
    (sim.world.get(c, CrewC) as { activity: string }).activity = 'sleeping';
    syncTask(sim, c);
    expect(sim.world.get(c, TaskC)?.state).toBe('Sleep');
    expect(auditReservations(sim).problems).toEqual([]);
    abortTask(sim, c, 'drafted');
    sim.world.add(c, EatC, { x: 2, y: 2, galley: false, item: 'item.metal', left: -1 });
    (sim.world.get(c, CrewC) as { activity: string }).activity = 'idle';
    syncTask(sim, c);
    expect(sim.world.get(c, TaskC)).toMatchObject({ machine: 'eat', state: 'Walk', class: 'any' });
    (sim.world.get(c, EatC) as { left: number }).left = 30;
    syncTask(sim, c);
    expect(sim.world.get(c, TaskC)).toMatchObject({ machine: 'eat', state: 'Consume', class: 'safe' });
  });

  it('the audit finds a reservation no task holds and a stale mirror', () => {
    const sim = make();
    const c = spawn(sim, 1, 1);
    const j = job(sim);
    (sim.world.get(j, JobC) as { reservedBy: number }).reservedBy = c;
    expect(auditReservations(sim).problems).toEqual([`job ${j} (build) reserved by ${c} whose task does not hold it`]);
    const b = bed(sim, 3, 3);
    (sim.world.get(b, ModuleC) as { reservedBy: number }).reservedBy = c;
    expect(auditReservations(sim).problems).toContain(`bed ${b} reserved by ${c} with 0 lifelines`);
  });

  it('every class is defined, a console is held, and the tables enumerate each machine state once', () => {
    const pairs = machineStates().map(([m, s]) => `${m}/${s}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toContain('haul/ToDest');
    expect(classOf('haul', 'ToDest')).toBe('safe');
    expect(classOf('rescue', 'ToBed')).toBe('finish');
    expect(classOf('generic', 'Work', { kind: 'operate' } as never)).toBe('hold');
  });

  it('moves with its ship (blackboard tiles) and is dropped at a cut that takes its job away', () => {
    const task = { job: 5, drive: 'work', machine: 'eva', state: 'ToAirlock', since: 0, class: 'any', holds: [{ kind: 'errand', id: 6 }], bb: { aux: 6, tile: { x: 1, y: 2 } }, stack: [{ machine: 'generic', state: 'Navigate', class: 'any', bb: { tile: { x: 3, y: 4 } } }] };
    const out = translated({ task }, 10, -1) as { task: typeof task };
    expect(out.task.bb.tile).toEqual({ x: 11, y: 1 });
    expect(out.task.stack[0]!.bb.tile).toEqual({ x: 13, y: 3 });
    expect(cutLeaving({ task: { ...task } }, (id) => id !== 5).task).toBeUndefined();
    expect(cutLeaving({ task: { ...task } }, () => true).task).toBeDefined();
  });
});
