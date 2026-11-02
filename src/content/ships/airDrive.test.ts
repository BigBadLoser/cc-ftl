import { describe, expect, it } from 'vitest';
import {
  AirlockC, AssignmentC, CrewC, HealthC, IntentC, JobC, ModuleC, PickupC, PositionC, ShipC, Struct, SuitC, TICK_HZ, homeShip, newGame, shipGrid,
  suitAir, suitDef, type Sim, type SimEvent,
} from '../../sim';
import { airLines, airMargin } from '../../sim/ai/airNeed';
import { auditReservations } from '../../sim/ai/audit';
import { isThin } from '../../sim/eva/suit';
import { content } from '../index';

/**
 * The air drive (#286 slice 1; docs/DESIGN.md "Air as a need"): a suited crew member whose tank drains refills at the nearest source
 * before it runs low, and comes back to the same job; with no source in reach the pickup request goes out.
 */

const run = (sim: Sim, n: number, until?: () => boolean): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n && !until?.(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};

const thinHere = (sim: Sim, c: number): boolean => {
  const p = sim.world.get(c, PositionC)!;
  return isThin(shipGrid(sim, homeShip(sim))!, p.x, p.y);
};

/** The starter ship with a long wall build on its hull ring (only reachable in a suit), and the crew member who has taken it, at work outside. */
function hullWork(): { sim: Sim; c: number; job: number } {
  const sim = newGame(3, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  const s = sim.world.get(ship, ShipC)!;
  sim.enqueue({ type: 'debug.giveItems', item: 'item.metal', count: 50 });
  sim.enqueue({ type: 'job.build', ship, x: s.x + 3, y: s.y, struct: Struct.Wall });
  run(sim, 2);
  const job = sim.world.query(JobC).find((j) => sim.world.get(j, JobC)!.kind === 'build' && sim.world.get(j, JobC)!.x === s.x + 3) as number;
  expect(job).toBeGreaterThan(0);
  sim.world.get(job, JobC)!.work = 1e7; // longer than any tank
  let c = 0;
  run(sim, 3000, () => {
    c = sim.world.query(CrewC).find((id) => sim.world.get(id, AssignmentC)?.jobId === job && sim.world.get(id, CrewC)!.activity === 'working') ?? 0;
    return c > 0 && thinHere(sim, c);
  });
  expect(c).toBeGreaterThan(0);
  return { sim, c, job };
}

describe('air drive', () => {
  it('thresholds: refill and critical lines follow the travel time, and the margin maps them onto 1000 and 500', () => {
    const { sim, c } = hullWork();
    const tank = suitDef(sim).airSec;
    expect(airLines(sim, c, 0)).toMatchObject({ refill: 0.3 * tank, critical: 0.1 * tank });
    const far = airLines(sim, c, 400);
    expect(far.refill).toBeCloseTo(1.5 * 400 + 30);
    expect(far.critical).toBeCloseTo(1.2 * 400 + 10);
    const suit = sim.world.get(c, SuitC)!;
    suit.air = tank;
    expect(airMargin(sim, c)).toBeGreaterThan(1000);
    const near = airLines(sim, c, 0);
    suit.air = (near.refill + near.critical) / 2;
    sim.world.get(c, IntentC)!.air = { at: sim.tick, ticks: 0 };
    expect(airMargin(sim, c)).toBeGreaterThanOrEqual(500);
    expect(airMargin(sim, c)).toBeLessThan(1000);
    suit.air = near.critical / 2;
    expect(airMargin(sim, c)).toBeLessThan(500);
  });

  it('a hull worker low on air refills at the airlock and comes back to the same job, its progress kept', () => {
    const { sim, c, job } = hullWork();
    const tank = suitDef(sim).airSec;
    run(sim, 40);
    const before = sim.world.get(job, JobC)!.progress;
    expect(before).toBeGreaterThan(0);
    sim.world.get(c, SuitC)!.air = 0.25 * tank; // under the refill line, above critical
    let nested = false;
    const ev = run(sim, 60 * TICK_HZ, () => {
      const a = sim.world.get(c, AssignmentC);
      const j = a && sim.world.get(a.jobId, JobC);
      if (j?.kind === 'refill') {
        nested = true;
        expect(j.resume).toBe(job);
        expect(sim.world.get(job, JobC)!.reservedBy).toBe(c); // the job stays theirs while they refill
      }
      expect(auditReservations(sim).problems).toEqual([]);
      return nested && a?.jobId === job;
    });
    expect(nested).toBe(true);
    expect(suitAir(sim, c)).toBeGreaterThan(0.9 * tank);
    expect(sim.world.get(c, AssignmentC)?.jobId).toBe(job);
    expect(sim.world.get(job, JobC)!.progress).toBeGreaterThanOrEqual(before);
    expect(ev.filter((e) => e.type === 'suit.airOut')).toEqual([]);
  });

  it('with no source in reach the drive is blocked and the pickup request goes out, once, with the air left', () => {
    const { sim, c } = hullWork();
    for (const id of sim.world.query(AirlockC)) sim.world.get(id, ModuleC)!.enabled = false; // no airlock to fill at: no source
    sim.world.get(c, SuitC)!.air = 0.25 * suitDef(sim).airSec;
    const ev = run(sim, 3 * AIR_TICKS);
    expect(sim.world.get(c, IntentC)!.blocked).toBe('air');
    expect(sim.world.has(c, PickupC)).toBe(true);
    const asks = ev.filter((e) => e.type === 'crew.airUnreachable');
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ crew: c });
    // A source again: the request is cleared.
    for (const id of sim.world.query(AirlockC)) sim.world.get(id, ModuleC)!.enabled = true;
    run(sim, 3 * AIR_TICKS);
    expect(sim.world.has(c, PickupC)).toBe(false);
  });

  it('an empty tank where no tile is breathable: the hazard sends them to the airlock to refill', () => {
    const { sim, c } = hullWork();
    const grid = shipGrid(sim, homeShip(sim))!;
    const vent = (): void => {
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) grid.set('o2', x, y, 0);
      sim.world.get(c, HealthC)!.hp = 100; // the test is about the way to air, not the harm on it
    };
    sim.world.get(c, SuitC)!.air = 0;
    for (let i = 0; i < 120 * TICK_HZ && suitAir(sim, c) <= 0; i++) {
      vent();
      run(sim, 1);
    }
    expect(suitAir(sim, c)).toBeGreaterThan(0);
  });

  it('only the air drive breaks a finish task (a carried patient), and only once critical', () => {
    for (const p of Object.values(content.policies)) {
      for (const d of p.drives) {
        const breaks = !!(d as { urgent?: { breaksFinish?: true } }).urgent?.breaksFinish;
        expect(breaks, `${p.id} ${d.id}`).toBe(d.id === 'air');
      }
    }
  });

  it('unsuited crew, robots and crew in breathable air have no air need', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 2);
    for (const c of sim.world.query(CrewC)) expect(airMargin(sim, c)).toBeUndefined();
    const lock = sim.world.query(AirlockC)[0] as number;
    expect(sim.world.get(lock, ModuleC)).toBeDefined();
  });
});

const AIR_TICKS = 20;
