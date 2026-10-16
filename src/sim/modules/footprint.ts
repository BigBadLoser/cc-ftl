import type { ModuleDef } from '../registry';

export interface Tile {
  x: number;
  y: number;
}

/** Footprint [w, h] after `rot` quarter turns. */
export function rotatedSize(def: ModuleDef, rot: number): [number, number] {
  const [w, h] = def.footprint;
  return rot % 2 === 0 ? [w, h] : [h, w];
}

/** Rotate a local offset clockwise by `rot` quarter turns within a w x h box (works outside the box too). */
export function rotateOffset(def: ModuleDef, rot: number, dx: number, dy: number): Tile {
  let h = def.footprint[1];
  let w = def.footprint[0];
  let x = dx;
  let y = dy;
  for (let i = 0; i < rot; i++) {
    [x, y] = [h - 1 - y, x];
    [w, h] = [h, w];
  }
  return { x, y };
}

/** Every tile a module at (x, y) with `rot` covers, row by row. */
export function footprintTiles(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  const [w, h] = rotatedSize(def, rot);
  const out: Tile[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: x + i, y: y + j });
  return out;
}

/** The tile crew stand on to use the module, or null if it has none. */
export function accessTile(def: ModuleDef, x: number, y: number, rot: number): Tile | null {
  if (!def.access) return null;
  const o = rotateOffset(def, rot, def.access[0], def.access[1]);
  return { x: x + o.x, y: y + o.y };
}
