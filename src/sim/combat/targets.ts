import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { WeaponC, type Combat, type Target } from './components';
import { VehicleC } from '../vehicles/components';
import { gridOfShip, shipOf } from './ships';
import { gridIdOf } from '../regions';

/** True if the ship can still be shot at (exists, not a fled ship or a prize). Wrecks stay targetable but are not worth it for the AI. */
export function targetableShip(sim: Sim, gridId: number): boolean {
  const ship = shipOf(sim, gridId);
  return !!ship && ship.state !== 'fled' && ship.state !== 'prize';
}

/** True if a shuttle can be shot at: it exists and is out of its bay (flying or docked). */
export function targetableVehicle(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  return !!v && v.state !== 'stowed';
}

/** Module ids on a grid, ascending. */
export function modulesOnGrid(sim: Sim, gridId: number): number[] {
  return sim.world.query(ModuleC).filter((i) => gridIdOf(sim, sim.world.get(i, ModuleC)) === gridId) as number[];
}

/**
 * The concrete target a weapon would shoot now: its own target, else the ship-wide one. A target module
 * that no longer exists, or "any" (module 0), is replaced by a random module of the target ship (preferring
 * intact ones) drawn from sim.rng. Null if there is no valid target ship.
 */
export function resolveTarget(sim: Sim, weaponId: number, combat: Combat): Target | null {
  const t = sim.world.get(weaponId, WeaponC)?.target ?? combat.target;
  if (t?.vehicle) return targetableVehicle(sim, t.vehicle) ? t : null;
  const gridId = t ? gridOfShip(sim, t.ship) : 0;
  if (!t || !targetableShip(sim, gridId)) return null;
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  if (m && gridIdOf(sim, m) === gridId) return t;
  return { ship: t.ship, moduleId: randomModule(sim, gridId) };
}

/** A random module of a grid (intact ones first); 0 if it has none. */
export function randomModule(sim: Sim, gridId: number, filter?: (id: number) => boolean): number {
  const all = modulesOnGrid(sim, gridId).filter((i) => !filter || filter(i));
  const intact = all.filter((i) => (sim.world.get(i, ModuleC)?.hp ?? 0) > 0);
  const pool = intact.length > 0 ? intact : all;
  return pool.length > 0 ? sim.rng.pick(pool) : 0;
}
