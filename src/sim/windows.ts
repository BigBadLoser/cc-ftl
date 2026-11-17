import type { GridLike } from './grid';
import { Struct } from './structure';

/**
 * Player-built windows (#516). A window is a per-tile code in the `window` grid field of a Wall tile (0 = none); the tile
 * stays `Struct.Wall`, so every system treats it as the wall it is. The code names the piece:
 *   bit 7 = axis (0 along x, 1 along y), bits 4-6 = the window's size (2..4), bits 0-3 = the tile's index along the run
 *   from the lower coordinate (0 .. size-1). A code is never 0 (size >= 2). Pieces: size 2 = l,r; 3 = l,m,r; 4 = l,m,m,r.
 * A breached tile leaves its neighbours' codes as they are (the rest of the window stays window).
 */
export const WINDOW_SIZES = [2, 3, 4] as const;
export type WindowSize = (typeof WINDOW_SIZES)[number];
export type WindowAxis = 'x' | 'y';
export type WindowPiece = 'l' | 'm' | 'r';
export interface WindowTile { axis: WindowAxis; size: number; index: number }

export function windowCode(axis: WindowAxis, size: number, index: number): number {
  return (axis === 'y' ? 128 : 0) | (size << 4) | index;
}

export function decodeWindow(code: number): WindowTile | null {
  if (!code) return null;
  return { axis: code & 128 ? 'y' : 'x', size: (code >> 4) & 7, index: code & 15 };
}

export const windowPiece = (w: WindowTile): WindowPiece => (w.index === 0 ? 'l' : w.index >= w.size - 1 ? 'r' : 'm');

/** The window state of a tile, or null (also for a grid without the field). */
export function windowAt(grid: GridLike, x: number, y: number): WindowTile | null {
  return grid.has('window') && grid.inBounds(x, y) ? decodeWindow(grid.get('window', x, y)) : null;
}

/** The tiles of a run from its lower-coordinate end (x, y). */
export function windowRun(x: number, y: number, axis: WindowAxis, size: number): { x: number; y: number; index: number }[] {
  return Array.from({ length: size }, (_, i) => ({ x: axis === 'x' ? x + i : x, y: axis === 'y' ? y + i : y, index: i }));
}

const solid = (k: number) => k === Struct.Wall || k === Struct.Door || k === Struct.RockWall;

/**
 * Why a window cannot go on the run, or null when it can. Every tile must be a plain Wall (hull or partition) with no
 * window yet and no module standing on it, and a straight piece: connected to the wall along the axis on both sides, and to nothing across it (no
 * corner, T-junction or thick block). `busy(x, y)` says whether a job already stands on a tile (the command passes it).
 */
export function windowRunError(grid: GridLike, x: number, y: number, axis: WindowAxis, size: number, busy: (x: number, y: number) => boolean = () => false): string | null {
  if (!grid.has('struct') || !grid.has('window')) return 'badGrid';
  if (!(WINDOW_SIZES as readonly number[]).includes(size)) return 'badSize';
  const kindAt = (tx: number, ty: number) => (grid.inBounds(tx, ty) ? grid.get('struct', tx, ty) : Struct.Space);
  const [ax, ay] = axis === 'x' ? [1, 0] : [0, 1];
  for (const t of windowRun(x, y, axis, size)) {
    if (!grid.inBounds(t.x, t.y)) return 'outOfBounds';
    if (kindAt(t.x, t.y) !== Struct.Wall) return 'notWall';
    if (grid.get('window', t.x, t.y)) return 'hasWindow';
    if (grid.has('module') && grid.get('module', t.x, t.y)) return 'moduleHere'; // a module's own art stands there (an engine's hull row)
    if (busy(t.x, t.y)) return 'jobExists';
    if (!solid(kindAt(t.x - ax, t.y - ay)) || !solid(kindAt(t.x + ax, t.y + ay))) return 'notStraight';
    if (solid(kindAt(t.x - ay, t.y - ax)) || solid(kindAt(t.x + ay, t.y + ax))) return 'notStraight';
  }
  return null;
}
