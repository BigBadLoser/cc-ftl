import { describe, expect, it } from 'vitest';
import { AirlockC } from '../modules/airlock';
import { DraftedC, PositionC } from '../crew/components';
import { VehicleC } from '../vehicles/components';
import { EvaFloatC, SuitC } from './components';
import { airlockAir, airlockAirCap, vehicleAir, vehicleAirCap } from './air';
import { airlockOf, crew, run, shuttle, world } from './airFixture';
import { startRefillFloat } from './refillFloat';
import { airSources } from './sources';
import { airStoresSystem } from '../systems/airStores';
import { suitAir, suitDef, suitTile } from './suit';
import { TICK_HZ } from '../time';

const suited = (sim: ReturnType<typeof world>, c: number, air?: number): void => {
  sim.world.add(c, SuitC, { worn: true, ...(air === undefined ? {} : { air }) });
};
const tank = (sim: ReturnType<typeof world>): number => suitDef(sim).airSec;
const rejected = (ev: { type: string }[]): string[] => ev.filter((e) => e.type === 'command.rejected').map((e) => (e as unknown as { reason: string }).reason);

describe('air stores', () => {
  it('an airlock holds 3 tanks and a shuttle 6 by default, full when the field is absent', () => {
    const sim = world();
    const lock = airlockOf(sim);
    expect(airlockAirCap(sim, lock)).toBe(3 * tank(sim));
    expect(airlockAir(sim, lock)).toBe(3 * tank(sim));
    const v = shuttle(sim);
    const veh = sim.world.get(v, VehicleC)!;
    expect(vehicleAirCap(sim, veh)).toBe(6 * tank(sim));
    expect(vehicleAir(sim, veh)).toBe(6 * tank(sim));
  });

  it('an airlock store refills one tank per 5 minutes on a ship with working life support', () => {
    const sim = world({ lifeSupport: true });
    const lock = airlockOf(sim);
    sim.world.get(lock, AirlockC)!.air = 0;
    run(sim, 150 * TICK_HZ);
    expect(airlockAir(sim, lock)).toBeCloseTo(tank(sim) / 2, 0);
    run(sim, 150 * TICK_HZ);
    expect(airlockAir(sim, lock)).toBeCloseTo(tank(sim), 0);
  });

  it('never refills without life support, nor on a derelict', () => {
    const none = world();
    const lock = airlockOf(none);
    none.world.get(lock, AirlockC)!.air = 100;
    run(none, 400 * TICK_HZ);
    expect(airlockAir(none, lock)).toBe(100);
    const wreck = world({ lifeSupport: true, state: 'wreck', faction: 'neutral' });
    const wl = airlockOf(wreck);
    wreck.world.get(wl, AirlockC)!.air = 100;
    run(wreck, 400 * TICK_HZ);
    expect(airlockAir(wreck, wl)).toBe(100);
  });

  it('a shuttle is filled in its bay, and while docked draws from the airlock it is docked at', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const bay = shuttle(sim, 'stowed');
    sim.world.get(bay, VehicleC)!.air = 0;
    const dock = shuttle(sim, 'docked');
    sim.world.get(dock, VehicleC)!.air = 0;
    const before = airlockAir(sim, lock);
    const second = (): void => {
      sim.tick += TICK_HZ - (sim.tick % TICK_HZ);
      airStoresSystem(sim);
    };
    second();
    expect(vehicleAir(sim, sim.world.get(bay, VehicleC)!)).toBe(6 * tank(sim));
    const drawn = vehicleAir(sim, sim.world.get(dock, VehicleC)!);
    expect(drawn).toBeGreaterThan(0);
    expect(airlockAir(sim, lock)).toBeCloseTo(before - drawn, 5);
    for (let i = 0; i < 600; i++) second();
    expect(airlockAir(sim, lock)).toBe(0); // the airlock had 3 tanks and gives only what it has
    expect(vehicleAir(sim, sim.world.get(dock, VehicleC)!)).toBe(3 * tank(sim));
  });
});

describe('air sources', () => {
  it('finds the airlock suit tile with the walk time, and an empty store is no source', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const c = crew(sim, 4, 4, { drafted: true });
    suited(sim, c);
    const all = airSources(sim, c);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ kind: 'airlock', id: lock, tile: suitTile(sim, lock) });
    const at = suitTile(sim, lock)!;
    const steps = Math.max(Math.abs(at.x - 4), Math.abs(at.y - 4));
    expect(all[0]!.ticks).toBeGreaterThanOrEqual(steps * (TICK_HZ / 2.5) * 0.8); // suited speed is 0.8 of 2.5
    expect(all[0]!.fillTicks).toBe(3 * TICK_HZ);
    sim.world.get(lock, AirlockC)!.air = 0;
    expect(airSources(sim, c)).toHaveLength(0);
  });

  it('a hovering player shuttle with a tank is a source at its hatch spot; one with less than a tank is not, nor a foreign one', () => {
    const sim = world();
    sim.world.get(airlockOf(sim), AirlockC)!.air = 0;
    const c = crew(sim, 2, 6, { drafted: true });
    suited(sim, c);
    const v = shuttle(sim);
    const found = airSources(sim, c);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'vehicle', id: v });
    expect(found[0]!.fillTicks).toBeGreaterThan(3 * TICK_HZ); // the swap plus the drift back
    expect(airSources(sim, c, { without: v })).toHaveLength(0);
    sim.world.get(v, VehicleC)!.air = tank(sim) - 1;
    expect(airSources(sim, c)).toHaveLength(0);
    sim.world.get(v, VehicleC)!.air = tank(sim);
    expect(airSources(sim, c)).toHaveLength(1);
    sim.world.get(v, VehicleC)!.hover = 0;
    expect(airSources(sim, c)).toHaveLength(0);
  });

  it('a shuttle docked at the airlock counts through the airlock tile when the airlock itself is empty', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const v = shuttle(sim, 'docked');
    const c = crew(sim, 4, 4, { drafted: true });
    suited(sim, c);
    sim.world.get(lock, AirlockC)!.air = 0;
    sim.world.get(v, VehicleC)!.air = 2 * tank(sim);
    expect(airSources(sim, c).map((s) => [s.kind, s.id])).toEqual([['airlock', lock]]);
    expect(airSources(sim, c, { without: v })).toHaveLength(0);
  });
});

describe('eva.refill', () => {
  it('a drafted, suited crew member walks to the airlock and fills the tank from its store', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const c = crew(sim, 4, 4, { drafted: true });
    suited(sim, c, 100);
    sim.enqueue({ type: 'eva.refill', crew: c });
    const ev = run(sim, 20 * TICK_HZ);
    expect(rejected(ev)).toEqual([]);
    expect(suitAir(sim, c)).toBe(tank(sim));
    expect(airlockAir(sim, lock)).toBe(3 * tank(sim) - (tank(sim) - 100));
    expect(sim.world.has(c, SuitC)).toBe(true);
  });

  it('draws only what the store has left, and nothing from an empty airlock', () => {
    const sim = world();
    const lock = airlockOf(sim);
    sim.world.get(lock, AirlockC)!.air = 50;
    const c = crew(sim, 4, 4, { drafted: true });
    suited(sim, c, 100);
    sim.enqueue({ type: 'eva.refill', crew: c, airlock: lock });
    run(sim, 20 * TICK_HZ);
    expect(suitAir(sim, c)).toBe(150);
    expect(airlockAir(sim, lock)).toBe(0);
    sim.enqueue({ type: 'eva.refill', crew: c });
    expect(rejected(run(sim, 2))).toEqual(['noSource']);
  });

  it('refuses the unsuited, the undrafted and a source that is not there', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const a = crew(sim, 4, 4, { drafted: true });
    const b = crew(sim, 5, 4);
    suited(sim, b, 10);
    sim.enqueue({ type: 'eva.refill', crew: a });
    sim.enqueue({ type: 'eva.refill', crew: b });
    const first = rejected(run(sim, 1));
    suited(sim, a, 10);
    sim.enqueue({ type: 'eva.refill', crew: a, vehicle: 99 });
    sim.world.get(lock, AirlockC)!.air = 0;
    sim.enqueue({ type: 'eva.refill', crew: a, airlock: lock });
    expect([...first, ...rejected(run(sim, 1))]).toEqual(['notSuited', 'notDrafted', 'noSource', 'noSource']);
  });

  it('at a hovering shuttle the crew member walks to the hatch spot, drifts out and back, and swaps tanks at the turn', () => {
    const sim = world();
    sim.world.get(airlockOf(sim), AirlockC)!.air = 0;
    const v = shuttle(sim);
    const c = crew(sim, 2, 6, { drafted: true });
    suited(sim, c, 100);
    sim.enqueue({ type: 'eva.refill', crew: c, vehicle: v });
    let floated = 0;
    let swapped = -1;
    for (let i = 0; i < 40 * TICK_HZ; i++) {
      const ev = run(sim, 1);
      expect(rejected(ev)).toEqual([]);
      const f = sim.world.get(c, EvaFloatC);
      if (f) {
        floated++;
        expect(f.mode).toBe('refill');
        if (swapped < 0 && suitAir(sim, c) > 100) swapped = f.ticks;
      }
    }
    expect(floated).toBeGreaterThan(2);
    expect(swapped).toBeGreaterThan(0); // the tank was swapped while still drifting: at the turn, not at the end
    expect(suitAir(sim, c)).toBeGreaterThan(tank(sim) - 30); // full at the turn, a few seconds of thin air since
    expect(sim.world.has(c, EvaFloatC)).toBe(false);
    const drawn = 6 * tank(sim) - sim.world.get(v, VehicleC)!.air!;
    expect(drawn).toBeGreaterThanOrEqual(tank(sim) - 100); // a tank swap: the shortfall at the turn comes out of the shuttle's store
    expect(drawn).toBeLessThan(tank(sim) - 100 + 30);
    expect(sim.world.has(c, DraftedC)).toBe(true);
    const p = sim.world.get(c, PositionC)!; // back where it floated from: the hull tile of the hatch spot
    expect(p.x).toBeLessThan(2);
  });
  it('cancels the swap at the turn when the shuttle has left: no air moves', () => {
    const sim = world();
    const v = shuttle(sim);
    const c = crew(sim, 1, 6, { drafted: true });
    suited(sim, c, 100);
    expect(startRefillFloat(sim, c, v)).toBe(true);
    const air = sim.world.get(v, VehicleC)!.air;
    sim.world.get(v, VehicleC)!.hover = 0; // it flies off while the crew member drifts out
    run(sim, 40 * TICK_HZ);
    expect(sim.world.has(c, EvaFloatC)).toBe(false);
    expect(suitAir(sim, c)).toBeLessThan(100);
    expect(sim.world.get(v, VehicleC)!.air).toBe(air);
  });
  it('plans the walk by the suit worn, not the air in it: an empty tank on the hull still reaches the shuttle hatch', () => {
    for (const air of [100, 0]) {
      const sim = world();
      sim.world.get(airlockOf(sim), AirlockC)!.air = 0;
      const v = shuttle(sim);
      const c = crew(sim, 0, 3, { drafted: true }); // out on the hull ring
      suited(sim, c, air);
      sim.enqueue({ type: 'eva.refill', crew: c, vehicle: v });
      expect(rejected(run(sim, 1))).toEqual([]);
    }
  });
});

