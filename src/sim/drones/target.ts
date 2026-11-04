import { ALT, BodyC } from '../body';
import type { Faction } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { shipById } from '../combat/ships';
import type { Position } from '../crew/components';
import { sightLine } from '../fight/los';
import type { Grid } from '../grid';
import type { HandWeaponDef } from '../registry';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { DroneC } from './components';

/**
 * A drone as a crew member's target (DESIGN.md "Drones": hand weapons hit drones inside a ship). The nearest drone flying or docked inside
 * ship `shipId` whose side is at war with `faction`, that `weapon` can hit from `from` without moving: a ranged weapon within range and with
 * a clear line to its tile, a melee one adjacent. Null if none. Crew shoot such drones only when no crew foe is around.
 */
export function droneInReach(
  sim: Sim, grid: Grid, faction: Faction | undefined, shipId: number, from: Position, weapon: HandWeaponDef,
): { id: number; pos: Position } | null {
  let best: { id: number; pos: Position } | null = null;
  let bestD = Infinity;
  for (const id of sim.world.query(DroneC, BodyC)) {
    const d = sim.world.get(id, DroneC);
    const b = sim.world.get(id, BodyC);
    if (!d || !b || d.hp <= 0 || d.space || b.alt > ALT.roof || !factionsHostile(faction, shipById(sim, d.ship)?.faction)) continue;
    const x = Math.floor(b.x), y = Math.floor(b.y);
    if (!grid.inBounds(x, y) || shipIdOf(sim, { x, y }) !== shipId) continue;
    const pos: Position = { x, y, toX: x, toY: y, progress: 0, facing: 0 };
    const dist = Math.hypot(x - from.x, y - from.y);
    if (dist >= bestD) continue;
    const reach = weapon.kind === 'ranged'
      ? dist <= weapon.range && sightLine(sim, grid, from, pos).visible
      : Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) <= 1;
    if (!reach) continue;
    best = { id, pos };
    bestD = dist;
  }
  return best;
}
