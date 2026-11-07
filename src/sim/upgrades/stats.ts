import { ModuleC } from '../modules/components';
import type { WeaponDef } from '../registry';
import type { Sim } from '../sim';
import type { UpgradeDef } from './types';

/**
 * The one place a fitted upgrade's modifiers are read ("effective stats"). Callers ask for the effective value of a stat and never test
 * for a particular upgrade; a new upgrade is an item def with `mods`.
 * Read a weapon module's def through `weaponDefOf` (or a shot's through `firedWeapon`), never `sim.content.weapons` directly: the base def
 * misses the fitted upgrade (a countdown, a heat check or a flag would read the unupgraded weapon).
 */

/** The upgrade fitted in a module's slot, if any. */
export function upgradeOf(sim: Sim, moduleId: number): UpgradeDef | undefined {
  const item = sim.world.get(moduleId, ModuleC)?.upgrade;
  return item ? sim.content.items[item]?.upgrade : undefined;
}

/** A weapon's def as the module fires it: the base def with the fitted upgrade's behaviour patch, heat and charge applied. */
export function effectiveWeapon(sim: Sim, moduleId: number, base: WeaponDef): WeaponDef {
  const mods = upgradeOf(sim, moduleId)?.mods;
  if (!mods) return base;
  return {
    ...base, ...mods.weapon,
    heat: base.heat * (mods.heatMul ?? 1),
    chargeSec: base.chargeSec * (mods.chargeMul ?? 1),
  };
}

/** The weapon def a module fires now (effective), or undefined if it is no weapon. */
export function weaponDefOf(sim: Sim, moduleId: number): WeaponDef | undefined {
  const m = sim.world.get(moduleId, ModuleC);
  const base = m && sim.content.weapons?.[sim.content.modules[m.def]?.weapon ?? ''];
  return base ? effectiveWeapon(sim, moduleId, base) : undefined;
}

/** The def of a shot in flight: its firing module's effective def while that module still fires this weapon (behaviour upgrades ride on it), else the base def. */
export function firedWeapon(sim: Sim, moduleId: number, weapon: string): WeaponDef | undefined {
  const m = sim.world.get(moduleId, ModuleC);
  const base = sim.content.weapons?.[weapon];
  return base && m && sim.content.modules[m.def]?.weapon === weapon ? effectiveWeapon(sim, moduleId, base) : base;
}

/** Multiplier on damage the module takes from hits and on the seconds an ion hit disables it (1 = none). */
export function damageTakenMul(sim: Sim, moduleId: number): number {
  return upgradeOf(sim, moduleId)?.mods.damageTakenMul ?? 1;
}
