import { describe, expect, it } from 'vitest';
import { ItemStackC, JobC, ShipC, serialize, type Sim } from '../../src/sim';
import { buildScenario, getScenario, scenarioNames, setupRejections } from './scenarios';
import { dumpBoard, rle, unrle } from './board';

const jobsOf = (sim: Sim, kind: string): number => sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.kind === kind).length;

describe('scenario registry', () => {
  it('lists the planned scenarios', () => {
    expect(scenarioNames()).toEqual(['colony', 'hullplan', 'log', 'hub', 'storm', 'haul', 'multiship']);
    expect(() => getScenario('nope')).toThrow(/Known: colony/);
  });

  it.each(scenarioNames())('builds %s and steps it without throwing', (name) => {
    const sim = buildScenario(name, 1);
    for (let i = 0; i < 20; i++) {
      sim.step();
      sim.events.drain();
    }
    expect(sim.world.query(ShipC).length).toBeGreaterThan(0);
  });

  it('sets each scenario up as described', () => {
    const rej = (sim: Sim, key: string): number => setupRejections.get(sim)?.[key] ?? 0;
    const hull = buildScenario('hullplan', 1);
    expect(rej(hull, 'hull.plan:badValue') + rej(hull, 'hull.plan:narrowHull')).toBe(0);
    expect(Object.keys(setupRejections.get(hull) ?? {}).filter((k) => k.startsWith('yard.order'))).toEqual([]);
    expect(jobsOf(hull, 'build')).toBeGreaterThan(100);
    const storm = buildScenario('storm', 1);
    expect(jobsOf(storm, 'build') + jobsOf(storm, 'moduleDecon')).toBeGreaterThan(100);
    expect(rej(storm, 'crew.draft:noCrew')).toBe(0);
    expect(buildScenario('haul', 1).world.query(ItemStackC).length).toBeGreaterThan(400);
    expect(buildScenario('multiship', 1).world.query(ShipC).length).toBe(3);
    expect(Object.keys(setupRejections.get(buildScenario('multiship', 1)) ?? {})).toEqual([]);
    const log = buildScenario('log', 1);
    expect(log.sector.inCombat).toBe(true);
  });

  it('builds the same sim for the same seed', () => {
    expect(JSON.stringify(serialize(buildScenario('storm', 2)))).toBe(JSON.stringify(serialize(buildScenario('storm', 2))));
  });
});

describe('board recorder', () => {
  it('encodes run lengths both ways', () => {
    const v = [0, 0, 0, 2, 2, 1, 0, 0];
    expect(rle(v)).toEqual([0, 3, 2, 2, 1, 1, 0, 2]);
    expect(unrle(rle(v))).toEqual(v);
    expect(rle([])).toEqual([]);
  });

  it('dumps jobs, crew, nav layers and reservations without touching the sim', () => {
    const sim = buildScenario('storm', 1);
    for (let i = 0; i < 100; i++) {
      sim.step();
      sim.events.drain();
    }
    const before = JSON.stringify(serialize(sim));
    const board = dumpBoard(sim, { scenario: 'storm', seed: 1, tick: sim.tick });
    expect(JSON.stringify(serialize(sim))).toBe(before);
    expect(board.format).toBe('cc-ftl-board/1');
    expect(board.jobs).toHaveLength(sim.world.query(JobC).length);
    const ship = board.ships[0]!;
    expect(unrle(ship.layers.struct)).toHaveLength(ship.w * ship.h);
    expect(unrle(ship.layers.blocked).some((v) => v === 1)).toBe(true);
    expect(board.crew.length).toBeGreaterThan(0);
    expect(board.crew[0]!.priorities).toHaveProperty('construction');
    expect(board.airlocks.length).toBeGreaterThan(0);
    // JSON-safe and deterministic.
    const again = dumpBoard(sim, { scenario: 'storm', seed: 1, tick: sim.tick });
    expect(JSON.stringify(board)).toBe(JSON.stringify(again));
    expect(JSON.parse(JSON.stringify(board))).toEqual(board);
  });
});
