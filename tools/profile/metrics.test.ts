import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { AssignmentC, CrewC, JobC, PositionC, PrioritiesC, ShipC, homeShip, newGame, serialize, shipGrid, type Sim } from '../../src/sim';
import { Struct } from '../../src/sim/structure';
import { MetricsRecorder, percentile } from './metrics';
import { buildScenario } from './scenarios';

/** A crew-free-of-chores game: the starter ship with its crew, no jobs. `tick` is set by hand to drive the recorder at chosen times. */
function bare(): { sim: Sim; crew: number[] } {
  const sim = newGame(1, content);
  return { sim, crew: [...sim.world.query(CrewC)] };
}

function postJob(sim: Sim, x: number, y: number, extra: Record<string, unknown> = {}): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { category: 'construction', kind: 'build', x, y, struct: Struct.Wall, work: 100, progress: 0, reservedBy: 0, ...extra });
  return id;
}

describe('percentile', () => {
  it('uses nearest rank and is 0 for nothing', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentile([7], 0.95)).toBe(7);
  });
});

describe('MetricsRecorder maths on a hand-driven sim', () => {
  it('measures open age, time to assign and completions by category', () => {
    const { sim, crew } = bare();
    const m = new MetricsRecorder({ stride: 1000 }); // no idle sampling here
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    const job = postJob(sim, ship.x + 3, ship.y + 3);
    sim.tick = 10;
    m.observe(sim); // first seen at 10: age 0
    sim.tick = 20;
    m.observe(sim); // age 10
    sim.world.get(job, JobC)!.reservedBy = crew[0]!;
    sim.world.add(crew[0]!, AssignmentC, { jobId: job });
    sim.tick = 30;
    m.observe(sim); // taken at 30: waited 20; no longer open
    sim.tick = 40;
    sim.world.remove(crew[0]!, AssignmentC);
    sim.world.destroyEntity(job);
    m.observe(sim, [{ type: 'crew.jobDone', crew: crew[0]!, kind: 'build', ship: homeShip(sim), x: 0, y: 0 }]);
    const s = m.summary();
    expect(s.ticksObserved).toBe(4);
    expect(s.jobsSeen).toBe(1);
    expect(s.oldestOpenAge).toEqual({ max: 10, p95: 10, atEnd: 0 });
    expect(s.timeToAssign).toEqual({ n: 1, p50: 20, p95: 20, max: 20, neverAssigned: 0 });
    expect(s.completion.total).toBe(1);
    expect(s.completion.byCategory.construction).toEqual({ done: 1, per1000: 250 }); // 1 in 4 observed ticks
  });

  it('counts a job nobody takes as never assigned and keeps ageing it', () => {
    const { sim } = bare();
    const m = new MetricsRecorder({ stride: 1000 });
    postJob(sim, 5, 5);
    for (const t of [100, 150, 300]) {
      sim.tick = t;
      m.observe(sim);
    }
    const s = m.summary();
    expect(s.oldestOpenAge.max).toBe(200);
    expect(s.oldestOpenAge.atEnd).toBe(200);
    expect(s.timeToAssign.neverAssigned).toBe(1);
    expect(s.timeToAssign.n).toBe(0);
  });

  it('ignores operate jobs and errands', () => {
    const { sim } = bare();
    const m = new MetricsRecorder({ stride: 1000 });
    postJob(sim, 5, 5, { kind: 'operate', category: 'operating' });
    postJob(sim, 6, 5, { kind: 'suitUp', category: 'repair' });
    sim.tick = 5;
    m.observe(sim);
    sim.tick = 50;
    m.observe(sim);
    expect(m.summary().jobsSeen).toBe(0);
    expect(m.summary().oldestOpenAge.max).toBe(0);
  });

  it('counts idle crew with a takeable job as idle-with-work, and none when the job is out of reach', () => {
    const { sim, crew } = bare();
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    // A floor tile in the corridor (the starter ship's corridor runs along y = 9..10): reachable.
    const near = postJob(sim, ship.x + 12, ship.y + 9, { kind: 'build', struct: Struct.Door });
    const m = new MetricsRecorder({ stride: 1 });
    sim.tick = 1;
    m.observe(sim);
    const a = m.summary().idleWithWork;
    expect(a.samples).toBe(1);
    expect(a.crewSamples).toBe(crew.length);
    expect(a.idleWithWorkSamples).toBeGreaterThan(0);
    expect(a.idleWithWorkSamples).toBeLessThanOrEqual(a.idleSamples);
    expect(a.crewTicks).toBe(a.idleWithWorkSamples); // stride 1
    sim.world.destroyEntity(near);
    // Same job, but on a tile that is not on any ship: nobody can take it.
    postJob(sim, 1, 1);
    const m2 = new MetricsRecorder({ stride: 1 });
    sim.tick = 2;
    m2.observe(sim);
    expect(m2.summary().idleWithWork.idleWithWorkSamples).toBe(0);
  });

  it('finds no idle-with-work in the sealed storm and repeats exactly', () => {
    const run = (): string => {
      const sim = buildScenario('storm', 1);
      const m = new MetricsRecorder({ stride: 5 });
      for (let i = 0; i < 40; i++) {
        sim.step();
        m.observe(sim, sim.events.drain());
      }
      return JSON.stringify(m.summary());
    };
    const a = run();
    expect(run()).toBe(a);
    const s = JSON.parse(a);
    expect(s.idleWithWork.idleWithWorkSamples).toBe(0);
    expect(s.timeToAssign.neverAssigned).toBeGreaterThan(50);
  });
});

describe('completions in the step they were taken', () => {
  /** A one-tick repair job beside an idle crew member: decide assigns it and work finishes it in the same step. */
  const run = (withProbe: boolean): Record<string, { done: number }> => {
    const sim = newGame(1, content);
    sim.step();
    sim.events.drain();
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    const crew = sim.world.query(CrewC).find((id) => {
      const p = sim.world.get(id, PositionC)!;
      return p.x === p.toX && p.y === p.toY && (sim.world.get(id, PrioritiesC)!.repair ?? 0) > 0 && p.x > ship.x + 1;
    })!;
    const p = sim.world.get(crew, PositionC)!;
    postJob(sim, p.x - 1, p.y, { category: 'repair', work: 1 });
    const m = new MetricsRecorder({ stride: 1000 });
    for (let i = 0; i < 5; i++) {
      sim.step(withProbe ? m.probe(sim) : undefined);
      m.observe(sim, sim.events.drain());
    }
    return m.summary().completion.byCategory;
  };

  it('counts it under the job category, not other', () => {
    expect(run(true)).toEqual({ repair: { done: 1, per1000: 200 } });
    expect(run(false)).toEqual({ other: { done: 1, per1000: 200 } }); // the gap the probe closes
  });
});

describe('the recorder leaves the sim alone', () => {
  /** Breathable air everywhere, a build job open when observed, then all the air removed: unsuited crew may not take it, whether or not anyone measured. */
  const run = (observe: boolean): string => {
    const sim = newGame(1, content);
    const me = homeShip(sim);
    const s = sim.world.get(me, ShipC)!;
    const fill = (v: number): void => {
      const g = shipGrid(sim, me)!;
      for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) g.set('o2', x, y, v);
    };
    const m = new MetricsRecorder({ stride: 1 });
    for (let i = 0; i < 40; i++) {
      sim.step();
      const events = sim.events.drain();
      if (i === 0) {
        fill(21);
        postJob(sim, s.x + 12, s.y + 9, { struct: Struct.Door }); // open when observed, taken in the next decide pass
      }
      if (observe) m.observe(sim, events);
      if (i === 0) fill(0);
    }
    return JSON.stringify(serialize(sim));
  };

  it('gives a byte-identical sim with metrics on and off, through an oxygen loss', () => {
    expect(run(true)).toBe(run(false));
  });
});
