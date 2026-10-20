import type { Ship } from '../sim/combat/components';
import { CombatC, ShipC, WeaponC } from '../sim/combat/components';
import { CrewC, PositionC } from '../sim/crew/components';
import type { World } from '../sim/ecs';
import { AllegianceC } from '../sim/fight/components';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { Struct } from '../sim/structure';

/**
 * Roofing and visibility per region (ARCHITECTURE "Sector grid" §5), read from ShipC and the tiles. Renderer only.
 */

/** True while any of the player's crew stand in this region's frame (boarders, or EVA crew on its hull). */
export function boarded(world: World, gridId: number): boolean {
  for (const id of world.query(CrewC, PositionC)) {
    if (world.get(id, PositionC)?.gridId === gridId && world.get(id, AllegianceC)?.faction === 'player') return true;
  }
  return false;
}

/** A hostile region is roofed (when enemy roofs are on) unless player crew are in its frame, or it is a wreck. */
export const wantsRoof = (world: World, s: Ship, roofEnemies: boolean): boolean =>
  roofEnemies && s.faction === 'hostile' && s.state !== 'wreck' && !boarded(world, s.gridId);

/** An interior tile: floor, door, or under a module. Crew on one of a roofed region are hidden under its roof. */
export function isInterior(grid: Grid, x: number, y: number): boolean {
  if (!grid.inBounds(x, y)) return false;
  const st = grid.get('struct', x, y);
  return st === Struct.Floor || st === Struct.Door || grid.get('module', x, y) !== 0;
}

/** Crew are drawn unless they stand on an interior tile of a roofed region (so crew outside a hull always are). */
export const crewHidden = (grid: Grid, roofed: boolean, x: number, y: number): boolean => roofed && isInterior(grid, Math.round(x), Math.round(y));

/** True if the sector tile of `at` lies inside the ship's rectangle (the ship it stands on: ships never overlap). */
export function onShip(ship: Ship, at: { x: number; y: number }): boolean {
  return at.x >= ship.x && at.x < ship.x + ship.width && at.y >= ship.y && at.y < ship.y + ship.height;
}

/** Module ids on `gridId` that the camera ship (or one of its weapons) is aiming at: the panel's amber marks. */
export function targetedModules(world: World, refId: number, gridId: number): Set<number> {
  const out = new Set<number>();
  for (const id of world.query(ShipC, CombatC)) {
    if (world.get(id, ShipC)?.gridId !== refId) continue;
    const t = world.get(id, CombatC)?.target;
    if (t?.gridId === gridId && t.moduleId) out.add(t.moduleId);
  }
  const ref = [...world.query(ShipC)].map((id) => world.get(id, ShipC)).find((s) => s?.gridId === refId);
  for (const id of world.query(WeaponC, ModuleC)) {
    const t = world.get(id, WeaponC)?.target;
    const m = world.get(id, ModuleC);
    if (ref && m && t?.gridId === gridId && t.moduleId && onShip(ref, m)) out.add(t.moduleId);
  }
  return out;
}
