import type { Rect } from '../grid';
import { shipAt } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';

type Tile = { x: number; y: number };

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * How many rows out from the ship a tile is: the distance (steps in any of eight directions) to the nearest tile of the ship's own structure. A
 * contractor crew works rows, lowest first, so the ship they leave behind is as regular as the work allows.
 */
export function rowRanks(sim: Sim, ship: number, box: Rect): (x: number, y: number) => number {
  const rank = new Int32Array(box.w * box.h).fill(-1);
  const at = (x: number, y: number): number => (y - box.y) * box.w + (x - box.x);
  const inBox = (x: number, y: number): boolean => x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;
  let queue: number[] = [];
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (sim.sector.grid.get('struct', x, y) !== Struct.Space && shipAt(sim, x, y) === ship) {
        rank[at(x, y)] = 0;
        queue.push(x, y);
      }
    }
  }
  for (let d = 1; queue.length; d++) {
    const next: number[] = [];
    for (let i = 0; i < queue.length; i += 2) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = (queue[i] as number) + dx, y = (queue[i + 1] as number) + dy;
          if (inBox(x, y) && rank[at(x, y)] === -1) {
            rank[at(x, y)] = d;
            next.push(x, y);
          }
        }
      }
    }
    queue = next;
  }
  return (x, y) => (inBox(x, y) ? Math.max(1, rank[at(x, y)] as number) : 1);
}

/** Tiles in build order: nearest row first, then reading order. */
export const inRowOrder = (tiles: readonly Tile[], rank: (x: number, y: number) => number): Tile[] =>
  [...tiles].sort((a, b) => rank(a.x, a.y) - rank(b.x, b.y) || a.y - b.y || a.x - b.x);

/**
 * What one visit builds of the reachable plan. When all of it fits the cap, all of it. Otherwise the part nearest the ship: every planned tile up to
 * some row, plus a cross wall (tiles of the plan's own floor, one row) that shuts that part in, so the ship left behind is closed and rectangular
 * rather than two spurs. The deepest such cut that fits the cap wins; if none does, the largest closed rectangle of the floor against the ship with its own rim
 * (`closedRect`).
 * `shut` tells the floor a set of walls would enclose.
 */
export function pickSection(
  connected: readonly Tile[], fullFloor: readonly Tile[], cap: number, rank: (x: number, y: number) => number, edge: (x: number, y: number) => Rim,
  shut: (walls: readonly Tile[]) => Tile[],
): { walls: Tile[]; floor: Tile[] } {
  const ordered = inRowOrder(connected, rank);
  if (ordered.length <= cap) return { walls: ordered, floor: shut(ordered) };
  const top = Math.max(0, ...fullFloor.map((t) => rank(t.x, t.y)));
  const planned = new Set(connected.map((t) => key(t.x, t.y)));
  for (let k = top; k >= 1; k--) {
    const cross = fullFloor.filter((t) => rank(t.x, t.y) === k && !planned.has(key(t.x, t.y)));
    const near = ordered.filter((t) => rank(t.x, t.y) <= k);
    if (cross.length === 0 || near.length + cross.length > cap) continue;
    const walls = inRowOrder([...near, ...cross], rank);
    const floor = shut(walls);
    if (floor.length > 0) return { walls, floor };
  }
  return closedRect(fullFloor, cap, rank, edge, shut) ?? (() => {
    const walls = ordered.slice(0, cap); // an open outline shuts nothing in: nothing to seal, so just the nearest tiles
    return { walls, floor: shut(walls) };
  })();
}

/** What a tile on the rim of a section is: 'wall' (open space, to build), 'ship' (the ship's own structure, free) or 'no' (in the way: another ship, a dock approach). */
export type Rim = 'wall' | 'ship' | 'no';

/**
 * The largest closed rectangle of the plan's floor that a cap pays for: a w x h block of the floor against the existing ship, shut in by a rim of
 * new walls (corners included) wherever the ship's own structure is not already the rim. Most floor wins, then the cheaper, then the nearer.
 */
function closedRect(
  floor: readonly Tile[], cap: number, rank: (x: number, y: number) => number, edge: (x: number, y: number) => Rim, shut: (walls: readonly Tile[]) => Tile[],
): { walls: Tile[]; floor: Tile[] } | null {
  if (floor.length === 0) return null;
  const inFloor = new Set(floor.map((t) => key(t.x, t.y)));
  const x0 = Math.min(...floor.map((t) => t.x)), x1 = Math.max(...floor.map((t) => t.x));
  const y0 = Math.min(...floor.map((t) => t.y)), y1 = Math.max(...floor.map((t) => t.y));
  let best: { walls: Tile[]; area: number; near: number } | null = null;
  for (let w = 1; w <= x1 - x0 + 1; w++) {
    for (let h = 1; h <= y1 - y0 + 1; h++) {
      for (let y = y0; y + h - 1 <= y1; y++) {
        for (let x = x0; x + w - 1 <= x1; x++) {
          const cand = rectSection(x, y, w, h, inFloor, edge, rank, cap);
          if (cand && (!best || cand.area > best.area || (cand.area === best.area && (cand.walls.length < best.walls.length || (cand.walls.length === best.walls.length && cand.near < best.near))))) best = cand;
        }
      }
    }
  }
  if (!best) return null;
  const walls = inRowOrder(best.walls, rank);
  return { walls, floor: shut(walls) };
}

function rectSection(
  x: number, y: number, w: number, h: number, inFloor: ReadonlySet<string>, edge: (x: number, y: number) => Rim, rank: (x: number, y: number) => number, cap: number,
): { walls: Tile[]; area: number; near: number } | null {
  if (2 * (w + h) + 4 - (w + 2) - 2 > cap) return null; // even with a whole side shared with the ship it cannot fit
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!inFloor.has(key(x + i, y + j))) return null;
  const walls: Tile[] = [];
  let ship = 0;
  for (let j = -1; j <= h; j++) {
    for (let i = -1; i <= w; i++) {
      if (i >= 0 && i < w && j >= 0 && j < h) continue;
      const e = edge(x + i, y + j);
      if (e === 'no') return null;
      if (e === 'ship') ship++;
      else walls.push({ x: x + i, y: y + j });
      if (walls.length > cap) return null;
    }
  }
  if (ship === 0 && !walls.some((t) => rank(t.x, t.y) <= 1)) return null; // not against the ship: it would float
  let near = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) near += rank(x + i, y + j);
  return { walls, area: w * h, near };
}
