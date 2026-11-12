import type { ModuleDef } from '../registry';

export interface Tile {
  x: number;
  y: number;
}

/**
 * Where a job on a placed module is worked: its top-left tile and its rotated footprint, so crew may stand beside any side of it (crew/helpers.ts
 * `atJob`). Every job aimed at a module posts this, as construction does; the top-left tile alone would need that one corner reachable.
 */
export function moduleSite(def: ModuleDef | undefined, m: { x: number; y: number; rot: number }): { x: number; y: number; size?: [number, number] } {
  return def ? { x: m.x, y: m.y, size: rotatedSize(def, m.rot) } : { x: m.x, y: m.y };
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

/**
 * Every tile crew stand on to use the module: its access tile, then the stand tile of each place at a leisure spot (`leisure.stand`:
 * the game table's two stools, the arcade's front). Placement refuses a module whose use tiles are blocked, and the build ghost marks them.
 */
export function useTiles(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  const out: Tile[] = [];
  const a = accessTile(def, x, y, rot);
  if (a) out.push(a);
  for (const s of standTilesAt(def, x, y, rot)) if (!out.some((t) => t.x === s.x && t.y === s.y)) out.push(s);
  return out;
}

/** World stand tiles of a leisure spot placed at (x, y, rot), in the order of its def's `leisure.stand` (none for other modules). */
export function standTilesAt(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  return (def.leisure?.stand ?? []).map(([dx, dy]) => {
    const o = rotateOffset(def, rot, dx, dy);
    return { x: x + o.x, y: y + o.y };
  });
}

/** World tiles of a module's footprint that crew can walk on (its `openTiles`, rotated). */
export function openTilesOf(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  return (def.openTiles ?? []).map(([ox, oy]) => {
    const o = rotateOffset(def, rot, ox, oy);
    return { x: x + o.x, y: y + o.y };
  });
}

/** True if (tx, ty) is inside the module's footprint. */
export function inFootprint(def: ModuleDef, x: number, y: number, rot: number, tx: number, ty: number): boolean {
  const [w, h] = rotatedSize(def, rot);
  return tx >= x && ty >= y && tx < x + w && ty < y + h;
}

/** Footprint side that lies on the hull line after rotation ('n' | 'e' | 's' | 'w'), or null. */
export function hullSide(def: ModuleDef, rot: number): 'n' | 'e' | 's' | 'w' | null {
  if (!def.hullEdge) return null;
  const order = ['n', 'e', 's', 'w'] as const;
  return order[(order.indexOf(def.hullEdge) + rot) % 4] as 'n' | 'e' | 's' | 'w';
}

/** The footprint tiles on the hull side (the engine's wall row). */
export function hullRow(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  const side = hullSide(def, rot);
  if (!side) return [];
  const [w, h] = rotatedSize(def, rot);
  return footprintTiles(def, x, y, rot).filter((t) =>
    side === 'n' ? t.y === y : side === 's' ? t.y === y + h - 1 : side === 'w' ? t.x === x : t.x === x + w - 1);
}

/** Unit step pointing out of the ship from the hull side. */
export function hullOutward(side: 'n' | 'e' | 's' | 'w'): Tile {
  return side === 'n' ? { x: 0, y: -1 } : side === 's' ? { x: 0, y: 1 } : side === 'w' ? { x: -1, y: 0 } : { x: 1, y: 0 };
}
