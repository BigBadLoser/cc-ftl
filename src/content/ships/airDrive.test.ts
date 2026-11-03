import { describe, expect, it } from 'vitest';
import {
  VehicleC, destroyVehicle,
  AirlockC, AssignmentC, CarriedC, CrewC, DownedC, HealthC, NeedsC, IntentC, JobC, ModuleC, PickupC, PositionC, ShipC, Struct, SuitC, TICK_HZ, homeShip, newGame, shipGrid,
  suitAir, suitDef, type Sim, type SimEvent,
} from '../../sim';
import { airLines, airMargin } from '../../sim/ai/airNeed';
import { auditReservations } from '../../sim/ai/audit';
import { claimedBed } from '../../sim/ai/task';
import { isThin } from '../../sim/eva/suit';
import { content } from '../index';
import { NEST_HOLD_SEC } from '../../sim/tuning';

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

  it('critical air interrupts a meal even when hunger is urgent too: the tank runs dry first (#278)', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 5);
    const crew = sim.world.query(CrewC);
    for (const m of crew) sim.world.get(m, NeedsC)!.hunger = 100;
    const c = crew[0] as number;
    sim.world.get(c, NeedsC)!.hunger = 7;
    run(sim, 30 * TICK_HZ, () => sim.world.get(c, CrewC)!.activity === 'eating');
    expect(sim.world.get(c, CrewC)!.activity).toBe('eating');
    // The room loses its air and their suit holds one second.
    const grid = shipGrid(sim, homeShip(sim))!;
    const p = sim.world.get(c, PositionC)!;
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 1);
    sim.world.get(c, SuitC)!.air = 1;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.inBounds(p.x + dx, p.y + dy)) grid.set('o2', p.x + dx, p.y + dy, 0);
    const ev: SimEvent[] = [];
    let left = false, refilled = false;
    for (let i = 0; i < 60 * TICK_HZ && !refilled; i++) {
      ev.push(...run(sim, 1));
      left ||= sim.world.get(c, CrewC)!.activity !== 'eating';
      refilled ||= left && suitAir(sim, c) > 0.5 * suitDef(sim).airSec;
    }
    expect(left).toBe(true);
    expect(refilled).toBe(true);
    expect(ev.filter((e) => e.type === 'suit.airOut')).toEqual([]);
  });

  it('a job parked by a refill is let go after NEST_HOLD_SEC (#294 follow-up)', () => {
    const { sim, c, job } = hullWork();
    sim.world.get(c, SuitC)!.air = 0.25 * suitDef(sim).airSec;
    run(sim, 10 * TICK_HZ, () => sim.world.get(sim.world.get(c, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'refill');
    const refill = sim.world.get(c, AssignmentC)!.jobId;
    expect(sim.world.get(refill, JobC)).toMatchObject({ kind: 'refill', resume: job });
    sim.world.get(refill, JobC)!.heldSince = sim.tick - NEST_HOLD_SEC * TICK_HZ - 1; // as if the way to the source had been long
    run(sim, 1);
    expect(sim.world.get(refill, JobC)?.resume).toBeUndefined();
    expect(sim.world.get(job, JobC)!.reservedBy).not.toBe(c); // free for anyone (or taken by someone else already)
    expect(auditReservations(sim).problems).toEqual([]);
  });

  it('a refill whose way crosses breathable air: no false pickup request, and a competing need does not take it over', () => {
    const { sim, c, job } = hullWork();
    sim.world.get(c, SuitC)!.air = 0.25 * suitDef(sim).airSec;
    let inside = false;
    let tired = false;
    const ev = run(sim, 90 * TICK_HZ, () => {
      const a = sim.world.get(c, AssignmentC);
      const kind = a && sim.world.get(a.jobId, JobC)?.kind;
      if (kind === 'refill' && !thinHere(sim, c)) {
        inside = true;
        if (!tired) {
          sim.world.get(c, NeedsC)!.rest = 5; // tired enough to drop anything else for bed
          tired = true;
        }
      }
      expect(sim.world.has(c, PickupC)).toBe(false);
      if (inside) expect(kind === 'refill' || a?.jobId === job).toBe(true); // the refill keeps them until it hands the job back
      return inside && a?.jobId === job;
    });
    expect(inside).toBe(true); // the way to the airlock's suit tile is through pressurized air
    expect(ev.filter((e) => e.type === 'crew.airUnreachable')).toEqual([]);
    expect(sim.world.get(c, AssignmentC)?.jobId).toBe(job);
    expect(suitAir(sim, c)).toBeGreaterThan(0.9 * suitDef(sim).airSec);
  });

  it('a suited sleeper whose room loses its air wakes at critical and refills before the tank runs dry', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 2);
    const c = sim.world.query(CrewC)[1] as number;
    sim.world.get(c, NeedsC)!.rest = 5;
    run(sim, 600, () => sim.world.get(c, CrewC)!.activity === 'sleeping');
    expect(sim.world.get(c, CrewC)!.activity).toBe('sleeping');
    sim.world.add(c, SuitC, { worn: true, air: 0.2 * suitDef(sim).airSec });
    const grid = shipGrid(sim, homeShip(sim))!;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 150 * TICK_HZ && !(suitAir(sim, c) > 0.9 * suitDef(sim).airSec); i++) {
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) grid.set('o2', x, y, 0);
      if (sim.world.get(c, CrewC)!.activity === 'sleeping') sim.world.get(c, NeedsC)!.rest = 5; // a long sleep: only the air can end it
      ev.push(...run(sim, 1));
    }
    expect(suitAir(sim, c)).toBeGreaterThan(0.9 * suitDef(sim).airSec);
    expect(ev.filter((e) => e.type === 'suit.airOut' && e.crew === c)).toEqual([]);
    expect(claimedBed(sim, c)).toBe(0);
    expect(auditReservations(sim).problems).toEqual([]);
  });

  it('with no source in reach the drive is blocked and the pickup request goes out, once, with the air left', () => {
    const { sim, c } = hullWork();
    for (const id of sim.world.query(AirlockC)) sim.world.get(id, ModuleC)!.enabled = false; // no airlock to fill at: no source
    for (const v of [...sim.world.query(VehicleC)]) destroyVehicle(sim, v); // and no shuttle to fetch them (pickup runs: awayCrew.test.ts)
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

  it('a suited sleeper with no source in reach still raises the pickup request (#278)', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 2);
    const c = sim.world.query(CrewC)[1] as number;
    sim.world.get(c, NeedsC)!.rest = 5;
    run(sim, 600, () => sim.world.get(c, CrewC)!.activity === 'sleeping');
    expect(sim.world.get(c, CrewC)!.activity).toBe('sleeping');
    for (const id of sim.world.query(AirlockC)) sim.world.get(id, ModuleC)!.enabled = false;
    for (const v of [...sim.world.query(VehicleC)]) destroyVehicle(sim, v);
    sim.world.add(c, SuitC, { worn: true, air: 0.1 * suitDef(sim).airSec });
    const ev: SimEvent[] = [];
    const grid = shipGrid(sim, homeShip(sim))!;
    for (let i = 0; i < 3 * AIR_TICKS; i++) {
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) grid.set('o2', x, y, 0);
      if (sim.world.get(c, CrewC)!.activity === 'sleeping') sim.world.get(c, NeedsC)!.rest = 5;
      ev.push(...run(sim, 1));
    }
    expect(sim.world.get(c, IntentC)!.blocked).toBe('air');
    expect(sim.world.has(c, PickupC)).toBe(true);
    expect(ev.filter((e) => e.type === 'crew.airUnreachable')).toHaveLength(1);
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

  it('a rescuer at critical air sets the patient down on a safe tile nearby, keeping their bed, and goes to refill', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 2);
    const crew = sim.world.query(CrewC);
    const patient = crew[2] as number;
    sim.world.get(patient, HealthC)!.hp = 0;
    let rescuer = 0;
    run(sim, 1500, () => {
      rescuer = sim.world.get(patient, CarriedC)?.carrier ?? 0;
      return rescuer > 0;
    });
    expect(rescuer).toBeGreaterThan(0);
    const bed = sim.world.get(patient, DownedC)!.bed;
    expect(bed).toBeGreaterThan(0);
    const job = sim.world.get(rescuer, AssignmentC)!.jobId;
    // The rescuer is suited with a nearly empty tank, and the air is gone from the tiles around them (and kept gone).
    sim.world.add(rescuer, SuitC, { worn: true, air: 0.03 * suitDef(sim).airSec });
    const grid = shipGrid(sim, homeShip(sim))!;
    const p = sim.world.get(rescuer, PositionC)!;
    const vented: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) vented.push([p.x + dx, p.y + dy]);
    const vent = (): void => vented.forEach(([x, y]) => grid.set('o2', x, y, 0));
    vent();
    run(sim, 1);
    expect(sim.world.has(patient, CarriedC)).toBe(false);
    const at = sim.world.get(patient, PositionC)!;
    expect(vented.some(([x, y]) => x === at.x && y === at.y)).toBe(false); // off the airless tiles
    expect(Math.abs(at.x - p.x) + Math.abs(at.y - p.y)).toBeLessThanOrEqual(4);
    expect(sim.world.get(patient, DownedC)!.bed).toBe(bed);
    expect(sim.world.get(bed, ModuleC)!.reservedBy).toBe(patient);
    expect(sim.world.get(job, JobC)).toMatchObject({ x: at.x, y: at.y });
    expect(sim.world.get(job, JobC)!.reservedBy).not.toBe(rescuer);
    const errand = sim.world.get(sim.world.get(rescuer, AssignmentC)?.jobId ?? 0, JobC);
    expect(errand?.kind).toBe('refill');
    expect(errand?.resume).toBeUndefined(); // the rescue was given up, not parked
    expect(auditReservations(sim).problems).toEqual([]);
    // Another rescuer (or the same one, refilled) picks the patient up where they lie and lays them in their bed.
    run(sim, 4000, () => !!sim.world.get(patient, DownedC)?.stabilized);
    expect(sim.world.get(patient, DownedC)?.stabilized).toBe(true);
    const b = sim.world.get(bed, ModuleC)!;
    expect(sim.world.get(patient, PositionC)).toMatchObject({ x: b.x, y: b.y });
  });

  it('a crew member walking to a claimed bed who must refill gives the bed back', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    run(sim, 2);
    const c = sim.world.query(CrewC)[1] as number;
    sim.world.get(c, NeedsC)!.rest = 5;
    run(sim, 200, () => claimedBed(sim, c) > 0 && sim.world.get(c, CrewC)!.activity !== 'sleeping');
    const bed = claimedBed(sim, c);
    expect(bed).toBeGreaterThan(0);
    sim.world.add(c, SuitC, { worn: true, air: 0.03 * suitDef(sim).airSec });
    const grid = shipGrid(sim, homeShip(sim))!;
    const p = sim.world.get(c, PositionC)!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) grid.set('o2', p.x + dx, p.y + dy, 0);
    run(sim, 1);
    expect(sim.world.get(sim.world.get(c, AssignmentC)?.jobId ?? 0, JobC)?.kind).toBe('refill');
    expect(claimedBed(sim, c)).toBe(0);
    expect(sim.world.get(bed, ModuleC)!.reservedBy).not.toBe(c);
    expect(auditReservations(sim).problems).toEqual([]);
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
