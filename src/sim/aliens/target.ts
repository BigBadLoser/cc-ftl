import type { Position } from '../crew/components';
import { sightLine } from '../fight/los';
import type { Grid } from '../grid';
import type { HandWeaponDef } from '../registry';
import type { Sim } from '../sim';
import { EggSacC, type EggSac } from './components';

/** True while an egg sac can still be attacked: not burst, hp left. */
export function sacAlive(sac: EggSac): boolean {
  return sac.state !== 'burst' && sac.hp > 0;
}

/** The footprint tiles of a sac (sector tiles), row by row. */
export function sacTiles(sac: EggSac): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < sac.size; dy++) for (let dx = 0; dx < sac.size; dx++) out.push({ x: sac.x + dx, y: sac.y + dy });
  return out;
}

/**
 * Entity `id` as an attack target: a live egg sac on ship `shipId`, as a position on its footprint tile nearest to
 * `from` (ties: first in row order). Null if it is not one.
 */
export function sacTile(sim: Sim, id: number, shipId: number, from: { x: number; y: number }): Position | null {
  const sac = sim.world.get(id, EggSacC);
  if (!sac || sac.ship !== shipId || !sacAlive(sac)) return null;
  let best = sac.x, bestY = sac.y, bestD = Infinity;
  for (const t of sacTiles(sac)) {
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = t.x;
      bestY = t.y;
    }
  }
  return { x: best, y: bestY, toX: best, toY: bestY, progress: 0, facing: 0 };
}

/**
 * The nearest live egg sac on ship `shipId` that `weapon` can hit from `from` without moving: a ranged weapon within
 * range and with a clear line, a melee one adjacent. Null if none. (Drafted, armed crew shoot such sacs on their own.)
 */
export function sacInReach(sim: Sim, grid: Grid, shipId: number, from: Position, weapon: HandWeaponDef): { id: number; pos: Position } | null {
  let best: { id: number; pos: Position } | null = null;
  let bestD = Infinity;
  for (const id of sim.world.query(EggSacC)) {
    const pos = sacTile(sim, id, shipId, from);
    if (!pos) continue;
    const d = Math.hypot(pos.x - from.x, pos.y - from.y);
    if (d >= bestD) continue;
    const reach = weapon.kind === 'ranged'
      ? d <= weapon.range && sightLine(sim, grid, from, pos).visible
      : Math.max(Math.abs(pos.x - from.x), Math.abs(pos.y - from.y)) <= 1;
    if (!reach) continue;
    best = { id, pos };
    bestD = d;
  }
  return best;
}
