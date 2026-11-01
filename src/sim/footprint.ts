import type { GridLike } from './grid';
import { Struct } from './structure';

/**
 * Ship footprint width rule: no part of a ship may be narrower than 3 tiles. The footprint (every non-Space struct tile)
 * must equal its morphological opening by a 3x3 square (erode, then dilate). That removes 1-2 wide spines and stubs and
 * keeps straight edges and 45 degree staircases. Pure and allocation-light (flat byte masks), so it is cheap enough for a
 * live drag preview and for generator validators.
 */

/** A tile coordinate. */
export interface TileXY {
  readonly x: number;
  readonly y: number;
}

/** A set of tiles as a dense byte mask over a bounding box: `data[(y - y0) * w + (x - x0)]` is 1 when the tile is in. */
export interface Footprint {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
}

/** Tiles added to and/or removed from a footprint. Removal wins over addition for a tile named in both. */
export interface FootprintChange {
  readonly add?: Iterable<TileXY>;
  readonly remove?: Iterable<TileXY>;
}

const EMPTY: Footprint = { x0: 0, y0: 0, w: 0, h: 0, data: new Uint8Array(0) };

/** True if (x, y) is in the footprint. */
export function footprintHas(f: Footprint, x: number, y: number): boolean {
  const lx = x - f.x0;
  const ly = y - f.y0;
  return lx >= 0 && ly >= 0 && lx < f.w && ly < f.h && f.data[ly * f.w + lx] === 1;
}

/** Number of tiles in the footprint. */
export function footprintSize(f: Footprint): number {
  let n = 0;
  for (let i = 0; i < f.data.length; i++) n += f.data[i]!;
  return n;
}

/** The footprint's tiles in row-major order. */
export function footprintTiles(f: Footprint): TileXY[] {
  const out: TileXY[] = [];
  for (let i = 0; i < f.data.length; i++) if (f.data[i]) out.push({ x: f.x0 + (i % f.w), y: f.y0 + Math.floor(i / f.w) });
  return out;
}

/** Footprint of a plain tile set (e.g. a shipgen template). */
export function footprintFromTiles(tiles: Iterable<TileXY>): Footprint {
  const list = [...tiles];
  if (list.length === 0) return EMPTY;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of list) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const data = new Uint8Array(w * h);
  for (const t of list) data[(t.y - minY) * w + (t.x - minX)] = 1;
  return { x0: minX, y0: minY, w, h, data };
}

/**
 * Footprint of a ship read from the sim grid: every `struct` tile except Space and `Struct.Beam`. Struts (including the yard's scaffolding
 * trusses) are exempt from the width rule, so only hull counts. When `shipId` is given and the grid has a
 * `ship` layer, only tiles owned by that ship count (a sector view holds several ships).
 */
export function footprintFromGrid(grid: GridLike, shipId?: number): Footprint {
  const useOwner = shipId !== undefined && grid.has('ship');
  const tiles: TileXY[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const kind = grid.get('struct', x, y);
      if (kind === Struct.Space || kind === Struct.Beam) continue;
      if (useOwner && grid.get('ship', x, y) !== shipId) continue;
      tiles.push({ x, y });
    }
  }
  return footprintFromTiles(tiles);
}

/** The footprint with a change applied. The bounding box grows to fit added tiles. */
export function applyChange(f: Footprint, change: FootprintChange): Footprint {
  const add = change.add ? [...change.add] : [];
  const remove = change.remove ? new Set([...change.remove].map((t) => `${t.x},${t.y}`)) : null;
  if (add.length === 0 && !remove) return f;
  const tiles = footprintTiles(f);
  for (const t of add) tiles.push(t);
  return footprintFromTiles(remove ? tiles.filter((t) => !remove.has(`${t.x},${t.y}`)) : tiles);
}

/** Morphological opening by a 3x3 square: erode then dilate. Always a subset of `f`, on the same bounding box. */
export function openingOf(f: Footprint): Footprint {
  const { w, h, data } = f;
  if (w < 3 || h < 3) return { ...f, data: new Uint8Array(w * h) };
  // Erode: a tile survives when its whole 3x3 neighbourhood is in (outside the box counts as out). Separable: rows then columns.
  const rowRun = new Uint8Array(w * h); // 1 where x-1, x, x+1 are all in
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 1; x < w - 1; x++) rowRun[r + x] = data[r + x - 1]! & data[r + x]! & data[r + x + 1]!;
  }
  const eroded = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const r = y * w;
    for (let x = 1; x < w - 1; x++) eroded[r + x] = rowRun[r - w + x]! & rowRun[r + x]! & rowRun[r + w + x]!;
  }
  // Dilate: a tile is in when any tile of its 3x3 neighbourhood is eroded. Separable again.
  const rowAny = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      rowAny[r + x] = eroded[r + x]! | (x > 0 ? eroded[r + x - 1]! : 0) | (x < w - 1 ? eroded[r + x + 1]! : 0);
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      out[r + x] = rowAny[r + x]! | (y > 0 ? rowAny[r - w + x]! : 0) | (y < h - 1 ? rowAny[r + w + x]! : 0);
    }
  }
  return { x0: f.x0, y0: f.y0, w, h, data: out };
}

/**
 * Tiles of the resulting footprint (after `change`) that the 3x3 opening drops: the parts narrower than 3 tiles.
 * Row-major order; empty means the width rule holds.
 */
export function widthViolations(footprint: Footprint, change?: FootprintChange): TileXY[] {
  const f = change ? applyChange(footprint, change) : footprint;
  const open = openingOf(f);
  const out: TileXY[] = [];
  for (let i = 0; i < f.data.length; i++) {
    if (f.data[i] && !open.data[i]) out.push({ x: f.x0 + (i % f.w), y: f.y0 + Math.floor(i / f.w) });
  }
  return out;
}

/** True if the footprint (after `change`) satisfies the width rule. */
export function widthOk(footprint: Footprint, change?: FootprintChange): boolean {
  return widthViolations(footprint, change).length === 0;
}
