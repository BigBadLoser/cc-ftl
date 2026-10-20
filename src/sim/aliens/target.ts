import type { Position } from '../crew/components';
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
