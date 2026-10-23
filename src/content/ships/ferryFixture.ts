/** Shared setup for the ferry and logistics tests: a stand-in base region and small run/inspect helpers. */
import { expect } from 'vitest';
import { ModuleC, ShipC, Sim, StorageC, VehicleC, placementError, shipGrid, spawnModule, stampShip } from '../../sim';
import { shipIdOf } from '../../sim/regions';

export type Log = string[];
export function run(sim: Sim, n: number, until?: (l: Log) => boolean): Log {
  const log: Log = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type === 'ferry.done' ? `ferry.done${e.reason ? `:${e.reason}` : ''}` : e.type);
    if (until?.(log)) break;
  }
  return log;
}

/** A 14x12 player region far from the home ship (a stand-in for a claimed base: an immobile player ShipC) with a storage crate. */
export function outpostRegion(sim: Sim, x: number, y: number, airlock: boolean): number {
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

export const storages = (sim: Sim, ship: number): number[] =>
  [...sim.world.query(StorageC, ModuleC)].filter((s) => shipIdOf(sim, sim.world.get(s, ModuleC)) === ship);
export const stockOn = (sim: Sim, ship: number, item: string): number =>
  storages(sim, ship).reduce((n, s) => n + (sim.world.get(s, StorageC)?.stacks.filter((st) => st.item === item).reduce((m, st) => m + st.count, 0) ?? 0), 0);
export const shuttleOf = (sim: Sim): number => [...sim.world.query(VehicleC)].find((v) => sim.world.get(v, VehicleC)?.def === 'vehicle.shuttle')!;
export const done = (l: Log): boolean => l.some((e) => e.startsWith('ferry.done'));

