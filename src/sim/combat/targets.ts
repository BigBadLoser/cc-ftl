import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { WeaponC, type Combat, type Faction, type Target } from './components';
import { factionsHostile, rogueAlly } from './factions';
import { VehicleC } from '../vehicles/components';

import { shipIdOf } from '../regions';
import { shipById } from './ships';
import { shipWideAim } from './shipAim';

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

/** True if a shuttle is targetable and its home ship's faction is at war with `faction` (a captured home ship makes it friendly). */
export function hostileVehicle(sim: Sim, id: number, faction: Faction): boolean {
  const v = sim.world.get(id, VehicleC);
  if (faction === 'rogue' && rogueAlly(sim, v?.homeShip ?? 0)) return false;
  return !!v && targetableVehicle(sim, id) && factionsHostile(faction, shipById(sim, v.homeShip)?.faction ?? 'neutral');
}

/** Module ids on a grid, ascending. */
export function modulesOnGrid(sim: Sim, shipId: number): number[] {
  return sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipId) as number[];
}

/** True if the ship is gone as a target for the player: destroyed (wreck), captured (prize) or fled. */
function targetGone(sim: Sim, shipId: number): boolean {
  const ship = shipById(sim, shipId);
  return !ship || ship.state === 'wreck' || !targetableShip(sim, shipId);
}

/** The module to switch to when `deadId` is destroyed: an intact one of the same kind, else a weapon, else any intact one; 0 (hull) if none. */
export function nextModule(sim: Sim, shipId: number, deadId: number): number {
  const intact = modulesOnGrid(sim, shipId).filter((i) => i !== deadId && (sim.world.get(i, ModuleC)?.hp ?? 0) > 0);
  const def = sim.world.get(deadId, ModuleC)?.def;
  const weaponOf = (i: number): boolean => !!sim.content.modules[sim.world.get(i, ModuleC)?.def ?? '']?.weapon;
  return intact.find((i) => sim.world.get(i, ModuleC)?.def === def) ?? intact.find(weaponOf) ?? intact[0] ?? 0;
}

/**
 * The concrete target a weapon would shoot now: its own target, else the ship-wide one. A target ship that is
 * destroyed or captured clears the stored target. A target module that is destroyed is replaced (and the stored
 * target updated) by the next sensible module of the same ship, see `nextModule`. A module that no longer
 * exists, or "any" (module 0), is replaced by a part of the target ship that still stands, module or wall, picked with odds by its share of
 * the remaining integrity (`shipWideAim`, sim.rng). Null if there is no valid target ship.
 */
export function resolveTarget(sim: Sim, weaponId: number, combat: Combat): Target | null {
  const anti = weaponAntiVehicle(sim, weaponId);
  const weapon = sim.world.get(weaponId, WeaponC);
  // A weapon's own target wins, but only anti-vehicle weapons may hold a shuttle; then the ship's shuttle target (anti-vehicle only), then its ship-wide one.
  const own = weapon?.target && (anti || !weapon.target.vehicle) ? weapon.target : null;
  let t = own;
  if (!t && anti && combat.vehicleTarget && targetableVehicle(sim, combat.vehicleTarget)) t = { ship: 0, moduleId: 0, vehicle: combat.vehicleTarget };
  t ??= combat.target && (anti || !combat.target.vehicle) ? combat.target : null;
  const store = (v: Target | null): void => {
    if (own && weapon) weapon.target = v;
    else combat.target = v;
  };
  if (t?.vehicle) return targetableVehicle(sim, t.vehicle) ? t : null;
  const shipId = t ? t.ship : 0;
  if (!t) return null;
  if (targetGone(sim, shipId)) {
    store(null);
    return null;
  }
  if (t.tile) return t; // a blind tile aim stays as set, whatever the modules do
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  if (m && shipIdOf(sim, m) === shipId) {
    if (m.hp > 0) return t;
    const next: Target = { ship: shipId, moduleId: nextModule(sim, shipId, t.moduleId) };
    store(next);
    return next;
  }
  // The whole ship (module 0, or a module that no longer exists): a part that still stands, weighted by what it holds of the integrity (issue #225).
  const part = shipWideAim(sim, shipId);
  if (part && 'tile' in part) return { ship: t.ship, moduleId: 0, tile: part.tile };
  return { ship: t.ship, moduleId: part?.moduleId ?? randomModule(sim, shipId) };
}

/** A random module of a grid (intact ones first); 0 if it has none. */
export function randomModule(sim: Sim, shipId: number, filter?: (id: number) => boolean): number {
  const all = modulesOnGrid(sim, shipId).filter((i) => !filter || filter(i));
  const intact = all.filter((i) => (sim.world.get(i, ModuleC)?.hp ?? 0) > 0);
  const pool = intact.length > 0 ? intact : all;
  return pool.length > 0 ? sim.rng.pick(pool) : 0;
}
