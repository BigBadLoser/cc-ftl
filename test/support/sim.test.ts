import { describe, expect, it } from 'vitest';
import { stampShip } from '../../src/sim/combat/ships';
import { shipIds } from '../../src/sim/regions';
import { Sim } from '../../src/sim/sim';
import { cachedWorld, expectReplayable } from './world';
import { fixtureShip, nth, run, runLog, runSim } from './sim';

const rows = ['#####', '#_#_#', '#_D_#', '#####'];

describe('run', () => {
  it('steps the requested ticks and returns the events', () => {
    const sim = new Sim(1);
    const r = runSim(sim, 5);
    expect(r.ticks).toBe(5);
    expect(sim.tick).toBe(5);
    expect(run(sim, 3)).toEqual([]);
    expect(sim.tick).toBe(8);
  });

  it('until is checked after each step, stopBefore before it', () => {
    const sim = new Sim(1);
    expect(runSim(sim, 50, { until: (s) => s.tick >= 7 }).ticks).toBe(7);
    expect(runSim(sim, 50, { stopBefore: (s) => s.tick >= 10 }).ticks).toBe(3);
    expect(runSim(sim, 50, { stopBefore: () => true }).ticks).toBe(0);
    expect(sim.tick).toBe(10);
  });

  it('logs rejected commands with their reason', () => {
    const sim = new Sim(1);
    sim.enqueue({ type: 'ship.settle', ship: 999, choice: 'letGo' });
    const log = runLog(sim, 2);
    expect(log.some((l) => l.startsWith('command.rejected:ship.settle:'))).toBe(true);
  });
});

describe('lookups', () => {
  it('fixtureShip stamps an inert ship and nth finds it by ordinal', () => {
    const sim = new Sim(1);
    const a = fixtureShip(sim, { name: 't', rows });
    const b = stampShip(sim, { name: 'u', rows }, { faction: 'player', state: 'prize', x: 60, y: 0 });
    expect(shipIds(sim)).toEqual([a, b]);
    expect(nth(sim, 1)).toBe(a);
    expect(nth(sim, 2)).toBe(b);
  });
});

describe('expectReplayable', () => {
  const build = (): Sim => {
    const sim = new Sim(1);
    fixtureShip(sim, { name: 't', rows });
    return sim;
  };

  it('passes for a deterministic build, with and without a mid-run save', () => {
    expectReplayable(build, 30);
    expectReplayable(build, 30, { every: 5, saveAt: 12 });
  });

  it('names the first diverging tick', () => {
    let n = 0;
    const flaky = (): Sim => {
      const sim = build();
      // The second sim built gets an extra command at tick 3's step: its state differs from tick 3 on.
      if (++n % 2 === 0) sim.rng.setState(sim.rng.getState() + 1);
      return sim;
    };
    expect(() => expectReplayable(flaky, 10, { every: 4 })).toThrow(/diverge.*tick 0/);
  });
});

describe('cachedWorld', () => {
  it('builds once and hands out independent clones', () => {
    let builds = 0;
    const make = (): Sim => {
      builds++;
      return build1();
    };
    const build1 = (): Sim => {
      const sim = new Sim(1);
      fixtureShip(sim, { name: 't', rows });
      return sim;
    };
    const a = cachedWorld('sim.test:one', make);
    run(a, 25);
    stampShip(a, { name: 'u', rows }, { faction: 'player', state: 'prize', x: 60, y: 0 });
    const b = cachedWorld('sim.test:one', make);
    expect(builds).toBe(1);
    expect(b.tick).toBe(0);
    expect(shipIds(b)).toHaveLength(1);
    expect(b).not.toBe(a);
    expect(shipIds(cachedWorld('sim.test:one', make))).toHaveLength(1);
  });
});
