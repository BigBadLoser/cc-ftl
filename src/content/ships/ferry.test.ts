import { describe, expect, it } from 'vitest';
import {
  AboardC, CrewC, FerryC, ModuleC, PositionC, SuitC, VehicleC, deserialize, homeShip, newGame, serialize, spawnCrew,
} from '../../sim';
import { done, outpostRegion, run, shuttleOf, stockOn } from './ferryFixture';
import { shipIdOf } from '../../sim/regions';
import { content } from '../index';

describe('base logistics: shuttle cargo runs', () => {
  it('carries items home -> a base with no airlock (hover), and back again', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, false);
    run(sim, 5);
    const metal0 = stockOn(sim, home, 'item.metal');
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.metal', count: 25 }] });
    const log = run(sim, 6000, done);
    expect(log).toContain('ferry.started');
    expect(log).toContain('ferry.delivered');
    expect(log).toContain('ferry.done');
    expect(stockOn(sim, base, 'item.metal')).toBe(25);
    expect(stockOn(sim, home, 'item.metal')).toBe(metal0 - 25);
    const v = shuttleOf(sim);
    expect(sim.world.get(v, VehicleC)).toMatchObject({ state: 'stowed', autopilot: false, cargo: [] });
    expect(sim.world.has(v, FerryC)).toBe(false);
    // and back: the base holds it, the shuttle fetches it by hover (no airlock) and docks at the home airlock
    sim.enqueue({ type: 'ferry.order', from: base, to: home, items: [{ item: 'item.metal', count: 25 }] });
    const back = run(sim, 8000, done);
    expect(back).toContain('ferry.done');
    expect(stockOn(sim, base, 'item.metal')).toBe(0);
    expect(stockOn(sim, home, 'item.metal')).toBe(metal0);
  });

  it('docks at a base airlock when it has one and crew haul the cargo through the unloaders', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, true);
    run(sim, 5);
    spawnCrew(sim, base, ['role.engineer', 'role.engineer']);
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.polymer', count: 12 }] });
    let docked = false;
    const log = run(sim, 9000, (l) => {
      const v = sim.world.get(shuttleOf(sim), VehicleC)!;
      if (v.state === 'docked' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === base) docked = true;
      return done(l);
    });
    expect(docked).toBe(true);
    expect(log.some((e) => e === 'ferry.done')).toBe(true);
    expect(stockOn(sim, base, 'item.polymer')).toBe(12);
  });

  it('rejects empty, same-region and busy orders, and a base with no airlock reached from its own home', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, false);
    run(sim, 5);
    sim.enqueue({ type: 'ferry.order', from: home, to: home, items: [{ item: 'item.metal', count: 1 }] });
    sim.enqueue({ type: 'ferry.order', from: home, to: base });
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.metal', count: 1 }] });
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.metal', count: 1 }] });
    expect(run(sim, 1).filter((e) => e.startsWith('rejected'))).toEqual([
      'rejected:ferry.order:sameRegion', 'rejected:ferry.order:nothing', 'rejected:ferry.order:noShuttle',
    ]);
    sim.enqueue({ type: 'ferry.cancel', vehicle: shuttleOf(sim) });
    expect(run(sim, 3000, done).filter((e) => e.startsWith('ferry.done'))).toEqual(['ferry.done:cancelled']);
  });

  it('survives a save and load mid-run', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, false);
    run(sim, 5);
    sim.enqueue({ type: 'ferry.order', from: home, to: base, items: [{ item: 'item.metal', count: 10 }] });
    run(sim, 330);
    const b = deserialize(serialize(sim), content);
    expect(b.world.has(shuttleOf(b), FerryC)).toBe(true);
    expect(run(b, 8000, done)).toContain('ferry.done');
    expect(stockOn(b, base, 'item.metal')).toBe(10);
  });
});

describe('base logistics: crew go to the base and back', () => {
  it('ferries crew by shuttle and EVA to a base with no airlock; they work there; then come home', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, false);
    run(sim, 5);
    const crew = [...sim.world.query(CrewC)].sort((a, b) => a - b).slice(0, 2);
    sim.enqueue({ type: 'ferry.order', from: home, to: base, crew });
    const log = run(sim, 9000, done);
    expect(log).toContain('ferry.delivered');
    for (const c of crew) {
      expect(sim.world.has(c, AboardC)).toBe(false);
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(base);
      expect(sim.world.has(c, SuitC)).toBe(true);
      expect(sim.world.get(c, SuitC)!.vehicle).toBeUndefined();
    }
    expect(sim.world.get(shuttleOf(sim), VehicleC)!.state).toBe('stowed');
    // They are free (not drafted) crew of the base region now.
    run(sim, 200);
    expect(sim.world.has(crew[0]!, 'drafted' as never)).toBe(false);
    // Back: they float to the hovering shuttle and ride home.
    sim.enqueue({ type: 'ferry.order', from: base, to: home, crew });
    expect(run(sim, 12000, done)).toContain('ferry.delivered');
    for (const c of crew) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
  });

  it('ferries crew through a base airlock with no suits: they walk off the shuttle and are idle crew of the base', () => {
    const sim = newGame(3, content);
    const home = homeShip(sim);
    const base = outpostRegion(sim, 70, 30, true);
    run(sim, 5);
    const crew = [...sim.world.query(CrewC)].sort((a, b) => a - b).slice(0, 2);
    sim.enqueue({ type: 'ferry.order', from: home, to: base, crew });
    expect(run(sim, 9000, done)).toContain('ferry.delivered');
    for (const c of crew) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(base);
      expect(sim.world.has(c, SuitC)).toBe(false);
    }
  });
});
