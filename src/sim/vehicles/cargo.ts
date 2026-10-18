import type { Sim } from '../sim';
import { VehicleC, type Vehicle } from './components';
import { vehicleDefOf } from './lifecycle';

/** Item units aboard. */
export function cargoCount(v: Vehicle): number {
  return v.cargo.reduce((n, q) => n + q.count, 0);
}

/** Item units of room left in the hold (0 for a vehicle without one). */
export function cargoSpace(sim: Sim, v: Vehicle): number {
  return Math.max(0, (vehicleDefOf(sim, v)?.cargo ?? 0) - cargoCount(v));
}

/** Load up to `n` units; returns how many fit. */
export function cargoAdd(sim: Sim, vehicle: number, item: string, n: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 0;
  const moved = Math.min(n, cargoSpace(sim, v));
  if (moved <= 0) return 0;
  const q = v.cargo.find((c) => c.item === item);
  if (q) q.count += moved;
  else v.cargo.push({ item, count: moved });
  return moved;
}

/** Unload up to `n` units of an item; returns how many came out. */
export function cargoTake(sim: Sim, vehicle: number, item: string, n: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  const q = v?.cargo.find((c) => c.item === item);
  if (!v || !q) return 0;
  const taken = Math.min(n, q.count);
  q.count -= taken;
  if (q.count <= 0) v.cargo = v.cargo.filter((c) => c !== q);
  return taken;
}

/** Units of an item in the hold. */
export function cargoOf(sim: Sim, vehicle: number, item: string): number {
  return sim.world.get(vehicle, VehicleC)?.cargo.find((c) => c.item === item)?.count ?? 0;
}
