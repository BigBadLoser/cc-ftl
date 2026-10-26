import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { WeaponC, type Combat, type Target } from './components';
import { VehicleC } from '../vehicles/components';

import { shipIdOf } from '../regions';
import { shipById } from './ships';

/** True if the ship can still be shot at (exists, not a fled ship or a prize). Wrecks stay targetable but are not worth it for the AI. */
export function targetableShip(sim: Sim, shipId: number): boolean {
  const ship = shipById(sim, shipId);
  return !!ship && ship.state !== 'fled' && ship.state !== 'prize' && !ship.outpost?.hidden;
}

/** True if a shuttle can be shot at: it exists and is out of its bay (flying or docked). */
export function targetableVehicle(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  return !!v && v.state !== 'stowed';
}

/** True if the weapon module carries a weapon that may fire at shuttles. */
export function weaponAntiVehicle(sim: Sim, weaponId: number): boolean {
  const m = sim.world.get(weaponId, ModuleC);
  const w = m && sim.content.modules[m.def]?.weapon;
  return !!w && !!sim.content.weapons?.[w]?.antiVehicle;
}

/** Module ids on a grid, ascending. */
export function modulesOnGrid(sim: Sim, shipId: number): number[] {
  return sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipId) as number[];
}

/**
 * The concrete target a weapon would shoot now: its own target, else the ship-wide one. A target module
 * that no longer exists, or "any" (module 0), is replaced by a random module of the target ship (preferring
 * intact ones) drawn from sim.rng. Null if there is no valid target ship.
 */
export function resolveTarget(sim: Sim, weaponId: number, combat: Combat): Target | null {
  const anti = weaponAntiVehicle(sim, weaponId);
  const own = sim.world.get(weaponId, WeaponC)?.target;
  let t = own && (anti || !own.vehicle) ? own : null; // a weapon's own target wins, but only anti-vehicle weapons may hold a shuttle
  if (!t && anti && combat.vehicleTarget && targetableVehicle(sim, combat.vehicleTarget)) t = { ship: 0, moduleId: 0, vehicle: combat.vehicleTarget };
  t ??= combat.target && (anti || !combat.target.vehicle) ? combat.target : null;
  if (t?.vehicle) return targetableVehicle(sim, t.vehicle) ? t : null;
  const shipId = t ? t.ship : 0;
  if (!t || !targetableShip(sim, shipId)) return null;
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  if (m && shipIdOf(sim, m) === shipId) return t;
  return { ship: t.ship, moduleId: randomModule(sim, shipId) };
}

/** A random module of a grid (intact ones first); 0 if it has none. */
export function randomModule(sim: Sim, shipId: number, filter?: (id: number) => boolean): number {
  const all = modulesOnGrid(sim, shipId).filter((i) => !filter || filter(i));
  const intact = all.filter((i) => (sim.world.get(i, ModuleC)?.hp ?? 0) > 0);
  const pool = intact.length > 0 ? intact : all;
  return pool.length > 0 ? sim.rng.pick(pool) : 0;
}
