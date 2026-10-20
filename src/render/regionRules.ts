import type { Ship } from '../sim/combat/components';
import { CombatC, ShipC, WeaponC } from '../sim/combat/components';
import { CrewC, PositionC } from '../sim/crew/components';
import type { World } from '../sim/ecs';
import { AllegianceC } from '../sim/fight/components';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { Struct } from '../sim/structure';
import { REGION_PAD } from '../sim/tuning';

/**
 * Roofing and visibility per region (ARCHITECTURE "Sector grid" §5), read from ShipC and the tiles. Renderer only.
 */

/** True while any of the player's crew stand in this region's frame (boarders, or EVA crew on its hull). */
export function boarded(world: World, shipId: number): boolean {
  for (const id of world.query(CrewC, PositionC)) {
    if ((p => !!p && shipIdAtTile(world, p.x, p.y) === shipId)(world.get(id, PositionC)) && world.get(id, AllegianceC)?.faction === 'player') return true;
  }
  return false;
}

/** A hostile region is roofed (when enemy roofs are on) unless player crew are in its frame, or it is a wreck. */
export const wantsRoof = (world: World, shipId: number, s: Ship, roofEnemies: boolean): boolean =>
  roofEnemies && s.faction === 'hostile' && s.state !== 'wreck' && !boarded(world, shipId);

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

/** Module ids on ship `shipId` that the camera ship (or one of its weapons) is aiming at: the panel's amber marks. */
export function targetedModules(world: World, refId: number, shipId: number): Set<number> {
  const out = new Set<number>();
  const ref = world.get(refId, ShipC);
  const t = world.get(refId, CombatC)?.target;
  if (t && t.ship === shipId && t.moduleId) out.add(t.moduleId);
  for (const id of world.query(WeaponC, ModuleC)) {
    const wt = world.get(id, WeaponC)?.target;
    const m = world.get(id, ModuleC);
    if (ref && m && wt && wt.ship === shipId && wt.moduleId && onShip(ref, m)) out.add(wt.moduleId);
  }
  return out;
}

/**
 * The ship id of the ship a placed thing stands on, from the ShipC rectangles (renderer twin of the sim's `shipIdAt`; it has no
 * `Sim`): the lowest-id ship whose rectangle holds the tile, else the ship whose padded frame (the EVA ring) does, else 0.
 */
export function shipIdAtTile(world: World, x: number, y: number): number {
  let rect = 0;
  let ring = 0;
  for (const sid of world.query(ShipC)) {
    const s = world.get(sid, ShipC);
    if (!s) continue;
    if (x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height) {
      if (rect === 0 || sid < rect) rect = sid;
    } else if (x >= s.x - REGION_PAD && x < s.x + s.width + REGION_PAD && y >= s.y - REGION_PAD && y < s.y + s.height + REGION_PAD) {
      if (ring === 0 || sid < ring) ring = sid;
    }
  }
  return rect !== 0 ? rect : ring;
}
