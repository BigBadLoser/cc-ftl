import { describe, expect, it } from 'vitest';
import {
  AboardC, CrewC, FerryC, ModuleC, PositionC, ShipC, Sim, StorageC, SuitC, VehicleC, deserialize, homeShip, newGame, placementError, serialize,
  shipGrid, spawnCrew, spawnModule, stampShip, 
} from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { content } from '../index';

type Log = string[];
function run(sim: Sim, n: number, until?: (l: Log) => boolean): Log {
  const log: Log = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type === 'ferry.done' ? `ferry.done${e.reason ? `:${e.reason}` : ''}` : e.type);
    if (until?.(log)) break;
  }
  return log;
}

/** A 14x12 player region far from the home ship (a stand-in for a claimed base: an immobile player ShipC) with a storage crate. */
function outpostRegion(sim: Sim, x: number, y: number, airlock: boolean): number {
  const rows = ['.'.repeat(14)];
  rows.push('.' + '#'.repeat(12) + '.');
  for (let i = 0; i < 8; i++) rows.push('.#' + '_'.repeat(10) + '#.');
  rows.push('.' + '#'.repeat(12) + '.');
  rows.push('.'.repeat(14));
  const ship = stampShip(sim, { name: 'base', rows }, { faction: 'player', state: 'active', x, y });
  (sim.world.get(ship, ShipC) as { immobile?: boolean }).immobile = true;
  const g = shipGrid(sim, ship)!;
  let crate = 0;
  for (let yy = g.y0; yy < g.y0 + g.height && !crate; yy++) {
    for (let xx = g.x0; xx < g.x0 + g.width && !crate; xx++) if (!placementError(sim, ship, 'module.storage', xx, yy, 0)) crate = spawnModule(sim, 'module.storage', xx, yy, 0);
  }
  expect(crate).not.toBe(0);
  if (airlock) {
    let power = 0;
    for (let yy = g.y0; yy < g.y0 + g.height && !power; yy++) {
      for (let xx = g.x0; xx < g.x0 + g.width && !power; xx++) if (!placementError(sim, ship, 'module.reactor', xx, yy, 0)) power = spawnModule(sim, 'module.reactor', xx, yy, 0);
    }
    expect(power).not.toBe(0);
    let placed = 0;
    for (let rot = 0; rot < 4 && !placed; rot++) {
      for (let yy = g.y0; yy < g.y0 + g.height && !placed; yy++) {
        for (let xx = g.x0; xx < g.x0 + g.width && !placed; xx++) if (!placementError(sim, ship, 'module.airlock', xx, yy, rot)) placed = spawnModule(sim, 'module.airlock', xx, yy, rot);
      }
    }
    expect(placed).not.toBe(0);
  }
  return ship;
}

const storages = (sim: Sim, ship: number): number[] =>
  [...sim.world.query(StorageC, ModuleC)].filter((s) => shipIdOf(sim, sim.world.get(s, ModuleC)) === ship);
const stockOn = (sim: Sim, ship: number, item: string): number =>
  storages(sim, ship).reduce((n, s) => n + (sim.world.get(s, StorageC)?.stacks.filter((st) => st.item === item).reduce((m, st) => m + st.count, 0) ?? 0), 0);
const shuttleOf = (sim: Sim): number => [...sim.world.query(VehicleC)].find((v) => sim.world.get(v, VehicleC)?.def === 'vehicle.shuttle')!;
const done = (l: Log): boolean => l.some((e) => e.startsWith('ferry.done'));

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
