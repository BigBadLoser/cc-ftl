import { AsteroidC } from '../asteroids/components';
import type { Sim } from '../sim';
import { BodyC } from '../body';
import { isAsteroidRock, Struct } from '../structure';
import { DIRS, STANDOFF } from './geometry';
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

/**
 * Headings (sprite directions, `DIRS`) in the order a pod tries them. The pod faces the ore, so it sits at the ore's centre minus
 * `STANDOFF` along the heading: heading d0 puts it at grid -x of the ore and d2 at grid -y (screen up-left and up-right, behind the
 * ore, facing down-right and down-left toward the camera), then d4 and d6 (in front), then the four grid diagonals.
 */
const HEADINGS: readonly (readonly number[])[] = [[0, 2], [4, 6], [1, 3, 5, 7]];

/**
 * Where a pod hovers to cut `target`: on one of the eight heading rays out from the tile's centre, `STANDOFF` away, so its laser
 * barrel's axis ends on the tile (geometry.ts). The first heading (in `HEADINGS` order, nearest the pod first within a group, ties
 * in list order) whose spot is over open space or ground (not rock mass) and at least `size` from every other pod's spot wins;
 * with none, the same ignoring the open-space rule (the pod flies above rock), then ignoring the separation. Deterministic.
 */
export function hoverSpot(sim: Sim, pod: number, target: { x: number; y: number }, size: number): { x: number; y: number } {
  const others: { x: number; y: number }[] = [];
  for (const id of sim.world.query(MiningPodC)) {
    const s = id !== pod ? sim.world.get(id, MiningPodC)?.spot : null;
    if (s) others.push(s);
  }
  const cx = target.x + 0.5, cy = target.y + 0.5;
  const clear = (x: number, y: number) => others.every((o) => (o.x - x) ** 2 + (o.y - y) ** 2 >= size * size - 1e-9);
  const g = sim.sector.grid;
  const open = (x: number, y: number) => {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= sim.sector.width || ty >= sim.sector.height) return false;
    const k = g.get('struct', tx, ty);
    return k === Struct.Space || k === Struct.Ground;
  };
  const at = sim.world.get(pod, BodyC) ?? { x: cx, y: cy };
  const spots = HEADINGS.map((group) =>
    group
      .map((k, i) => ({ x: cx - (DIRS[k] as readonly [number, number])[0] * STANDOFF, y: cy - (DIRS[k] as readonly [number, number])[1] * STANDOFF, i }))
      .sort((a, b) => (a.x - at.x) ** 2 + (a.y - at.y) ** 2 - ((b.x - at.x) ** 2 + (b.y - at.y) ** 2) || a.i - b.i),
  ).flat();
  const hit = spots.find((c) => open(c.x, c.y) && clear(c.x, c.y)) ?? spots.find((c) => clear(c.x, c.y)) ?? spots[0];
  return hit ? { x: hit.x, y: hit.y } : { x: cx, y: cy };
}
