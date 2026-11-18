/** Shared setups of the mining-pod tests and their slow tier: the starter ship with one pod bay and a pod, an asteroid field, and readers of its ore and hold. */
import { AsteroidC } from '../../../src/sim/asteroids/components';
import { homeShip } from '../../../src/sim/combat/shipQuery';
import { totalStock } from '../../../src/sim/items/stock';
import { placementError, spawnModule } from '../../../src/sim/modules/spawn';
import { newGame } from '../../../src/sim/newGame';
import { shipGrid } from '../../../src/sim/regions';
import type { Sim } from '../../../src/sim/sim';
import { VehicleC } from '../../../src/sim/vehicles/components';
import { spawnVehicle } from '../../../src/sim/vehicles/lifecycle';
import { content } from '../content';

export const HOLD = content.vehicles['vehicle.mining_pod'].cargo;

/** The starter ship with a pod bay (first spot that fits, scanning rows) and a pod in it, plus an asteroid field. */
export function setup(seed = 1): { sim: Sim; pod: number; asteroid: number } {
  const sim = newGame(seed, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  let bay = 0;
  for (let y = g.y0; y < g.y0 + g.height && !bay; y++) {
    for (let x = g.x0; x < g.x0 + g.width && !bay; x++) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) bay = spawnModule(sim, 'module.pod_bay', x, y, 0);
  }
  const pod = spawnVehicle(sim, 'vehicle.mining_pod', bay);
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  const asteroid = [...sim.world.query(AsteroidC)][0]!;
  return { sim, pod, asteroid };
}

/**
 * The ore tiles of an asteroid, row-major, with their amounts. Energy crystal is left out: the ship's reactors burn what is mined of it (#421), so it is
 * not part of the "every unit cut is in storage" count these tests make.
 */
export function oreTiles(sim: Sim, asteroid: number): { x: number; y: number; amt: number }[] {
  const a = sim.world.get(asteroid, AsteroidC)!;
  const out: { x: number; y: number; amt: number }[] = [];
  for (let y = a.y; y < a.y + a.height; y++) {
    for (let x = a.x; x < a.x + a.width; x++) if (sim.sector.grid.get('ore', x, y) && sim.sector.grid.get('ore', x, y) !== content.ores['ore.crystal'].code) out.push({ x, y, amt: sim.sector.grid.get('oreAmt', x, y) });
  }
  return out;
}

export const ORE_ITEMS = ['item.iron_ore', 'item.ice', 'item.rare_ore'];
export const stock = (sim: Sim) => ORE_ITEMS.reduce((n, i) => n + totalStock(sim, i), 0);
export const hold = (sim: Sim, pod: number) => sim.world.get(pod, VehicleC)!.cargo.reduce((n, q) => n + q.count, 0);

/** Step until `done` (checked every tick) or `max` ticks; returns the event types seen. */
export function until(sim: Sim, max: number, done: (events: string[]) => boolean, watch?: () => void): string[] {
  const log: string[] = [];
  for (let i = 0; i < max; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
    watch?.();
    if (done(log)) break;
  }
  return log;
}

