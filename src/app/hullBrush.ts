import type { Tile } from './input';

/**
 * Brush geometry for the hull plan: pure functions from a drag to the tiles a stroke covers. A stroke is only a tile list, so a freehand
 * brush (vertices snapped to 0, 45 and 90 degrees) can later be one more source of tiles; the plan check and the preview take it as it is.
 */

/** A drag's rectangle never has a side under this many tiles: the 3-wide rule starts at the brush. */
export const MIN_SIDE = 3;
/** A staircase brush has at least this many tiles on each leg (a one-tile cut reads as a broken corner in the hull art). */
export const MIN_LEG = 2;

const sign = (n: number): 1 | -1 => (n < 0 ? -1 : 1);

export interface BrushRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The dragged rectangle from `a` to `b`: it keeps `a` as its anchor corner and grows towards `b`, up to at least 3 x 3 (the drag snaps up). */
export function dragRect(a: Tile, b: Tile): BrushRect {
  const w = Math.max(MIN_SIDE, Math.abs(b.x - a.x) + 1);
  const h = Math.max(MIN_SIDE, Math.abs(b.y - a.y) + 1);
  return { x: sign(b.x - a.x) > 0 ? a.x : a.x - w + 1, y: sign(b.y - a.y) > 0 ? a.y : a.y - h + 1, w, h };
}

export function rectTiles(r: BrushRect): Tile[] {
  const out: Tile[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
  return out;
}

/** Legs of the staircase a drag from `a` to `b` stamps: the longer side of the drag, at least 2. */
export function stairSize(a: Tile, b: Tile): number {
  return Math.max(MIN_LEG, Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) + 1);
}

/**
 * The 45 degree staircase of a drag: a right triangle with its square corner on `a`, both legs `stairSize` tiles, pointing the way the drag goes (so
 * a drag inward from a rectangle's corner cuts that corner, and the same drag in add mode fills a notch).
 */
export function stairTiles(a: Tile, b: Tile): Tile[] {
  const n = stairSize(a, b);
  const sx = sign(b.x - a.x), sy = sign(b.y - a.y);
  const out: Tile[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) out.push({ x: a.x + i * sx, y: a.y + j * sy });
  return out;
}

/** The ship's long axis for mirroring: strokes are reflected across the line through the middle of the ship's rectangle that runs along its longer side. */
export function mirrorTiles(tiles: readonly Tile[], ship: { x: number; y: number; width: number; height: number }): Tile[] {
  const alongX = ship.width >= ship.height; // long axis runs left to right: reflect rows
  const sum = alongX ? 2 * ship.y + ship.height - 1 : 2 * ship.x + ship.width - 1;
  return tiles.map((t) => (alongX ? { x: t.x, y: sum - t.y } : { x: sum - t.x, y: t.y }));
}

/** Tiles of a stroke with its mirror image (each tile once). */
export function withMirror(tiles: readonly Tile[], ship: { x: number; y: number; width: number; height: number }): Tile[] {
  const seen = new Set(tiles.map((t) => `${t.x},${t.y}`));
  return [...tiles, ...mirrorTiles(tiles, ship).filter((t) => !seen.has(`${t.x},${t.y}`))];
}
