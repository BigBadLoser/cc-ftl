import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CrewC, DraftedC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import { gridFromTemplate } from '../ship';
import { deserialize, serialize } from '../save';
import { newGame } from '../newGame';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { Struct } from '../structure';
import type { SimEvent } from '../events';

const rows = ['#########', '#___#___#', '#___D___#', '#___#___#', '#########'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, crafting: v, cooking: v,
});
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: {
    'role.engineer': { name: 'E', priorities: { ...all(4), construction: 1 } },
    'role.gunner': { name: 'G', priorities: { ...all(4), operating: 1 } },
    'role.medic': { name: 'M', priorities: { ...all(4), medical: 1 } },
  },
  modules: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A', 'B', 'C', 'D', 'E', 'F'],
  items: {},
  recipes: {},
  structCosts: {},
};

function make(): Sim {
  const sim = new Sim(7, content);
  sim.grids.set(1, gridFromTemplate(1, content.ships['ship.t']!));
  return sim;
}

function spawn(sim: Sim, x: number, y: number, prio: Priorities = all(4), rest = 100): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.engineer', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId: 1, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...prio });
  sim.world.add(id, NeedsC, { rest });
  return id;
}

const construction = { ...all(4), construction: 1 };
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const struct = (sim: Sim, x: number, y: number) => sim.grids.get(1)!.get('struct', x, y);
const build = (sim: Sim, x: number, y: number, s: number = Struct.Wall) =>
  sim.enqueue({ type: 'job.build', gridId: 1, x, y, struct: s });

describe('crew jobs', () => {
  it('walks through a door and builds a wall', () => {
    const sim = make();
    const id = spawn(sim, 1, 2, construction);
    build(sim, 6, 1);
    let passedDoor = false;
    const events: SimEvent[] = [];
    for (let i = 0; i < 600 && struct(sim, 6, 1) !== Struct.Wall; i++) {
      sim.step();
      events.push(...sim.events.drain());
      if ((sim.world.get(id, PositionC)?.x ?? 0) > 4) passedDoor = true;
    }
    expect(struct(sim, 6, 1)).toBe(Struct.Wall);
    expect(passedDoor).toBe(true);
    expect(events.some((e) => e.type === 'crew.jobDone')).toBe(true);
    expect(sim.world.has(id, AssignmentC)).toBe(false);
    expect(sim.world.query(JobC)).toHaveLength(0);
  });

  it('reserves: two crew and two jobs take one each', () => {
    const sim = make();
    const a = spawn(sim, 1, 1, construction);
    const b = spawn(sim, 1, 3, construction);
    build(sim, 3, 1);
    build(sim, 3, 3);
    run(sim, 2);
    const ja = sim.world.get(a, AssignmentC)?.jobId;
    const jb = sim.world.get(b, AssignmentC)?.jobId;
    expect(ja).toBeDefined();
    expect(jb).toBeDefined();
    expect(ja).not.toBe(jb);
    expect(sim.world.get(ja!, JobC)?.reservedBy).toBe(a);
  });

  it('respects priorities: 0 never taken, level 1 beats a nearer level 3', () => {
    const sim = make();
    const off = spawn(sim, 1, 1, { ...all(4), construction: 0 });
    build(sim, 2, 1);
    run(sim, 100);
    expect(sim.world.has(off, AssignmentC)).toBe(false);
    expect(sim.world.query(JobC)).toHaveLength(1);

    const sim2 = make();
    const c = spawn(sim2, 1, 1, { ...all(4), construction: 3, repair: 1 });
    build(sim2, 2, 3); // near, construction (level 3)
    const far = sim2.world.createEntity();
    sim2.world.add(far, JobC, {
      category: 'repair', kind: 'build', x: 7, y: 3, struct: Struct.Wall, work: 40, progress: 0, reservedBy: 0,
    });
    run(sim2, 2);
    expect(sim2.world.get(c, AssignmentC)?.jobId).toBe(far);
  });

  it('drafted crew ignore jobs and go to their target', () => {
    const sim = make();
    const id = spawn(sim, 1, 1, construction);
    sim.enqueue({ type: 'crew.draft', id, drafted: true });
    sim.enqueue({ type: 'crew.moveTo', id, x: 3, y: 3 });
    build(sim, 2, 1);
    run(sim, 100);
    const p = sim.world.get(id, PositionC)!;
    expect([p.x, p.y]).toEqual([3, 3]);
    expect(sim.world.has(id, AssignmentC)).toBe(false);
    expect(sim.world.get(id, JobC)).toBeUndefined();
    expect(sim.world.get(id, CrewC)?.activity).toBe('drafted');
    expect(sim.world.get(id, DraftedC)?.target).toBeNull();
    sim.enqueue({ type: 'crew.draft', id, drafted: false });
    run(sim, 100);
    expect(struct(sim, 2, 1)).toBe(Struct.Wall);
  });

  it('tired crew sleeps, wakes, then resumes work', () => {
    const sim = make();
    const id = spawn(sim, 1, 1, construction, 19);
    sim.step();
    expect(sim.world.get(id, CrewC)?.activity).toBe('sleeping');
    build(sim, 3, 1);
    run(sim, 50);
    expect(sim.world.has(id, AssignmentC)).toBe(false);
    const events: SimEvent[] = [];
    for (let i = 0; i < 2000 && struct(sim, 3, 1) !== Struct.Wall; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    expect(events.some((e) => e.type === 'crew.wokeUp')).toBe(true);
    expect(struct(sim, 3, 1)).toBe(Struct.Wall);
  });

  it('cancel frees the crew', () => {
    const sim = make();
    const id = spawn(sim, 1, 1, construction);
    build(sim, 7, 1);
    run(sim, 10);
    expect(sim.world.has(id, AssignmentC)).toBe(true);
    sim.enqueue({ type: 'job.cancel', gridId: 1, x: 7, y: 1 });
    run(sim, 2);
    expect(sim.world.has(id, AssignmentC)).toBe(false);
    expect(sim.world.query(JobC)).toHaveLength(0);
    expect(sim.world.get(id, PathC)?.steps).toHaveLength(0);
  });

  it('deconstruct turns a wall into floor; invalid commands are rejected', () => {
    const sim = make();
    spawn(sim, 3, 2, construction);
    sim.enqueue({ type: 'job.deconstruct', gridId: 1, x: 4, y: 1 });
    sim.enqueue({ type: 'job.deconstruct', gridId: 1, x: 1, y: 1 }); // floor
    sim.enqueue({ type: 'job.build', gridId: 1, x: 4, y: 1, struct: Struct.Wall }); // job exists
    sim.enqueue({ type: 'crew.setPriority', id: 999, category: 'repair', value: 1 });
    sim.step();
    const rejected = sim.events.drain().filter((e) => e.type === 'command.rejected');
    expect(rejected).toHaveLength(3);
    run(sim, 200);
    expect(struct(sim, 4, 1)).toBe(Struct.Floor);
  });

  it('priority commands update and reset from role', () => {
    const sim = newGame(3, { ...content, ships: { 'ship.starter': content.ships['ship.t']! } });
    const id = sim.world.query(PrioritiesC)[0]!;
    sim.enqueue({ type: 'crew.setPriority', id, category: 'cooking', value: 2 });
    sim.step();
    expect(sim.world.get(id, PrioritiesC)?.cooking).toBe(2);
    sim.enqueue({ type: 'crew.resetPriorities', id });
    sim.step();
    expect(sim.world.get(id, PrioritiesC)?.cooking).toBe(4);
  });
});

describe('crew determinism', () => {
  const setup = (): Sim => {
    const sim = newGame(11, { ...content, ships: { 'ship.starter': content.ships['ship.t']! } });
    build(sim, 6, 1);
    build(sim, 2, 3, Struct.Door);
    return sim;
  };
  it('same seed and commands give identical saves', () => {
    const a = setup();
    const b = setup();
    run(a, 600);
    run(b, 600);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.world.query(CrewC)).toHaveLength(4);
  });
  it('save round-trips with crew mid-walk', () => {
    const a = setup();
    const walking = () => a.world.query(CrewC).some((id) => a.world.get(id, CrewC)?.activity === 'walking');
    for (let i = 0; i < 200 && !(walking() && a.tick > 10); i++) a.step();
    expect(walking()).toBe(true);
    const b = deserialize(serialize(a), a.content);
    run(a, 300);
    run(b, 300);
    expect(serialize(b)).toBe(serialize(a));
  });
});
