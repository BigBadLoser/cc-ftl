import { AsteroidC } from '../asteroids/components';
import type { Sim } from '../sim';
import { isAsteroidRock } from '../structure';
import { MiningPodC, type MiningPod } from './components';

/** True if the sector tile is ore-bearing rock owned by `asteroid`. */
export function isOreTile(sim: Sim, asteroid: number, x: number, y: number): boolean {
  const g = sim.sector.grid;
  return g.get('ship', x, y) === asteroid && isAsteroidRock(g.get('struct', x, y)) && g.get('ore', x, y) !== 0 && g.get('oreAmt', x, y) > 0;
}

/** Tiles other pods are heading for or mining, as "x,y" keys. */
function claimed(sim: Sim, pod: number): Set<string> {
  const out = new Set<string>();
  for (const id of sim.world.query(MiningPodC)) {
    const t = id !== pod ? sim.world.get(id, MiningPodC)?.target : null;
    if (t) out.add(`${t.x},${t.y}`);
  }
  return out;
}

/** The ore tiles an order may still mine, row-major from the asteroid's top-left (or the order's list, in its order). */
export function orderTiles(sim: Sim, order: MiningPod): { x: number; y: number }[] {
  const a = sim.world.get(order.asteroid, AsteroidC);
  if (!a) return [];
  if (order.tiles) return order.tiles.filter((t) => isOreTile(sim, order.asteroid, t.x, t.y));
  const out: { x: number; y: number }[] = [];
  for (const p of a.parts) {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (isOreTile(sim, order.asteroid, x, y)) out.push({ x, y });
  }
  return out;
}

/**
 * The next tile for a pod at `from`: the nearest ore tile of its order that no other pod is working (squared distance from
 * `from` to the tile centre), ties to the lower y, then the lower x; with every tile taken, the nearest one anyway, so pods
 * share an order's last tiles instead of idling. Deterministic; null only when no ore is left.
 */
export function pickTile(sim: Sim, pod: number, order: MiningPod, from: { x: number; y: number }): { x: number; y: number } | null {
  const taken = claimed(sim, pod);
  const nearest = (tiles: { x: number; y: number }[]): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const t of tiles) {
      const d = (t.x + 0.5 - from.x) ** 2 + (t.y + 0.5 - from.y) ** 2;
      if (d < bestD || (d === bestD && best && (t.y < best.y || (t.y === best.y && t.x < best.x)))) {
        best = t;
        bestD = d;
      }
    }
    return best;
  };
  const tiles = orderTiles(sim, order);
  return nearest(tiles.filter((t) => !taken.has(`${t.x},${t.y}`))) ?? nearest(tiles);
}
