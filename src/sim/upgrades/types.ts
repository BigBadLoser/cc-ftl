import type { WeaponDef } from '../registry';

/**
 * Module upgrades (DESIGN.md "Weapon upgrades and flak"). An upgrade is an item with `ItemDef.upgrade`. A module def with `ModuleDef.upgradeSlot`
 * has one slot of that kind; the fitted item's id is saved on the module (`Module.upgrade`). Everything an upgrade changes goes through
 * `UpgradeMods`, read in one place (upgrades/stats.ts), so a new upgrade is data.
 */
export interface UpgradeMods {
  /** Multiplies the heat the module adds per volley (weapons). */
  heatMul?: number;
  /** Multiplies the charge time of a weapon. */
  chargeMul?: number;
  /** Multiplies damage the module takes from hits and the seconds an ion hit disables it. */
  damageTakenMul?: number;
  /** Behaviour change: fields laid over the fitted weapon's def (shots, shield rule, effects...). The data path for weapon-specific upgrades. */
  weapon?: Partial<Omit<WeaponDef, 'heat' | 'chargeSec'>>;
}

export interface UpgradeDef {
  /** The slot kind it goes in (`ModuleDef.upgradeSlot`), e.g. 'weapon'. */
  slot: string;
  /** Module def ids or weapon def ids it fits; absent = any module with that slot. */
  fits?: readonly string[];
  mods: UpgradeMods;
  /** One player-facing line on what a behaviour upgrade does and costs (the numbers in `mods.weapon` are not read back into text). */
  blurb?: string;
}
