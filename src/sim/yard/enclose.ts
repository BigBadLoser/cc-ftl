import type { Rect } from '../grid';
import type { Sim } from '../sim';
import { Struct } from '../structure';

type Tile = { x: number; y: number };

export function boxOf(tiles: readonly Tile[], by: number): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) {
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
  }
  return { x: x0 - by, y: y0 - by, w: x1 - x0 + 1 + 2 * by, h: y1 - y0 + 1 + 2 * by };
}

/** Space tiles the hull tiles (with the ship's own structure) shut in: the floor the yard lays. */
export function enclosedFloor(sim: Sim, hull: readonly Tile[]): Tile[] {
  if (hull.length === 0) return [];
  const grid = sim.sector.grid;
  const box = boxOf(hull, 1);
  const at = (x: number, y: number): number => (y - box.y) * box.w + (x - box.x);
  // 1 = shuts the floor in: a hull tile of this section, other structure (an open truss shuts nothing in), other ships' tiles
  const shut = new Uint8Array(box.w * box.h);
  for (const t of hull) shut[at(t.x, t.y)] = 1;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (shut[at(x, y)]) continue;
      const k = grid.get('struct', x, y);
      if ((k !== Struct.Space && k !== Struct.Beam) || (k === Struct.Space && grid.get('ship', x, y) !== 0)) shut[at(x, y)] = 1;
    }
  }
  const outside = new Uint8Array(box.w * box.h);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h || outside[at(x, y)] || shut[at(x, y)]) return;
    outside[at(x, y)] = 1;
    stack.push(x, y);
  };
  for (let x = box.x; x < box.x + box.w; x++) {
    push(x, box.y);
    push(x, box.y + box.h - 1);
  }
  for (let y = box.y; y < box.y + box.h; y++) {
    push(box.x, y);
    push(box.x + box.w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const out: Tile[] = [];
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) if (!shut[at(x, y)] && !outside[at(x, y)]) out.push({ x, y });
  return out;
}

