import { ModuleC } from '../modules/components';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { WALL_WEIGHT } from '../tuning';

/**
 * What a volley at a whole ship aims at (issue #225): something that still stands. A standing module or wall tile is picked with odds by its
 * share of what is left of the ship's integrity (module hp, wall integrity x WALL_WEIGHT, as `shipStateSystem` scores it): big intact modules
 * draw most of the fire, so leaving the guns on the ship wears its integrity down to the wreck line instead of chipping crates and lights or
 * hammering dead wreckage. A module comes back as its id, a wall as its tile. Deterministic: one `sim.rng` draw. Null when nothing stands.
 */
export function shipWideAim(sim: Sim, shipId: number): { moduleId: number } | { tile: { x: number; y: number } } | null {
  const parts: { at: { x: number; y: number } | number; w: number }[] = [];
  let total = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || m.hp <= 0 || shipIdOf(sim, m) !== shipId) continue;
    parts.push({ at: id, w: m.hp });
    total += m.hp;
  }
  const grid = shipGrid(sim, shipId);
  if (grid?.has('hp')) {
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
        const s = grid.get('struct', x, y);
        if (s !== Struct.Wall && s !== Struct.Door) continue;
        const hp = grid.get('hp', x, y);
        if (hp <= 0) continue;
        parts.push({ at: { x, y }, w: hp * WALL_WEIGHT });
        total += hp * WALL_WEIGHT;
      }
    }
  }
  if (total <= 0) return null;
  let r = sim.rng.next() * total;
  let pick = parts[parts.length - 1]!;
  for (const p of parts) {
    r -= p.w;
    if (r < 0) {
      pick = p;
      break;
    }
  }
  return typeof pick.at === 'number' ? { moduleId: pick.at } : { tile: pick.at };
}
