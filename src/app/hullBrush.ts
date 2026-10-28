import type { Tile } from './input';

/**
 * Brush geometry for the hull plan: pure functions from a drag to the tiles a stroke covers. A stroke is only a tile list, so a freehand
 * brush (vertices snapped to 0, 45 and 90 degrees) can later be one more source of tiles; the plan check and the preview take it as it is.
 */

/** A drag's rectangle never has a side under this many tiles: the 3-wide rule starts at the brush. */
export const MIN_SIDE = 3;

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

/** A 45 degree line has at least this many steps (the hull art turns a staircase into a diagonal from 2 steps). */
export const MIN_DIAG_STEPS = 2;

/**
 * The slopes a line can take, as |rise| / |run|: 0 is flat, 1 is 45 degrees, Infinity is straight up. This one list is the whole angle rule: a drag snaps to the nearest
 * of these, so allowing 1:2 or 1:3 staircases later means adding 0.5 or 1 / 3 here. A slope under 1 must be at most 1/2 (its staircase runs are at least 2 tiles
 * long), and one over 1 at least 2, the same seen from the other axis.
 */
export const LINE_SLOPES: readonly number[] = [0, 1, Infinity];

/**
 * The straight line of a drag from `a` to `b`, snapped to the nearest of `slopes` by angle, as long as the drag: both end tiles are in it. A shallow
 * line is drawn run by run (a slope of 1/2 steps down every second tile), cut short so its last run is whole; a 45 degree line has at least `MIN_DIAG_STEPS` steps.
 */
export function lineTiles(a: Tile, b: Tile, slopes: readonly number[] = LINE_SLOPES): Tile[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const sx = sign(dx), sy = sign(dy);
  const drag = Math.atan2(ay, ax);
  const angle = (s: number): number => (s === Infinity ? Math.PI / 2 : Math.atan(s));
  const slope = [...slopes].sort((p, q) => Math.abs(angle(p) - drag) - Math.abs(angle(q) - drag))[0] ?? 0;
  const steep = slope > 1; // run along y instead of x
  const t = slope === Infinity ? Infinity : steep ? 1 / slope : slope; // minor tiles per major tile, at most 1
  const major = steep || slope === Infinity ? ay : ax;
  const out: Tile[] = [];
  const put = (i: number, j: number): void => void out.push(steep || slope === Infinity ? { x: a.x + j * sx, y: a.y + i * sy } : { x: a.x + i * sx, y: a.y + j * sy });
  if (slope === Infinity) {
    for (let i = 0; i <= ay; i++) put(i, 0);
    return out;
  }
  if (t === 0) for (let i = 0; i <= major; i++) put(i, 0);
  else if (t === 1) {
    const n = Math.max(MIN_DIAG_STEPS, Math.round((ax + ay) / 2));
    for (let i = 0; i <= n; i++) put(i, i);
  } else {
    const run = Math.max(2, Math.round(1 / t));
    const count = Math.max(2 * run, Math.floor((major + 1) / run) * run);
    for (let i = 0; i < count; i++) put(i, Math.floor(i * t + 1e-9));
  }
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
