import type { UiShipCombat } from './api';

export interface ResolvedTarget {
  /** Display name of the effective target. */
  label: string;
  /** Module id, or 0 when the effective target is the whole ship. */
  moduleId: number;
  /** Integrity 0..100 of what is actually being shot at: the module's hp, or hull for the whole ship. */
  pct: number;
  /** True when a weapon's own aim replaces the ship-wide target. */
  override: boolean;
}

/**
 * The effective target of a weapon (or of the ship, when `weaponTarget` is undefined) and its integrity.
 * `shipModuleId` is the ship-wide target module (0 = whole ship); `weaponTarget` is a weapon's own aim (null = inherits it).
 */
export function resolveTarget(enemy: UiShipCombat, shipModuleId: number, weaponTarget?: { moduleId: number; tile?: { x: number; y: number } | null } | null, shipTile?: { x: number; y: number } | null): ResolvedTarget {
  const override = weaponTarget != null;
  const id = override ? weaponTarget.moduleId : shipModuleId;
  const tile = override ? weaponTarget.tile : shipTile;
  const mod = id ? enemy.modules.find((m) => m.id === id) : undefined;
  if (!mod && tile) return { label: `Tile ${tile.x - enemy.x}, ${tile.y - enemy.y}`, moduleId: 0, pct: Math.round((enemy.integrity || 0) * 100), override };
  if (mod) return { label: mod.name, moduleId: mod.id, pct: Math.round((mod.hp / Math.max(1, mod.maxHp)) * 100), override };
  return { label: 'Whole ship', moduleId: 0, pct: Math.round((enemy.integrity || 0) * 100), override };
}
