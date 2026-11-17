import type { GridLike } from './grid';
import type { ShipTemplate } from './registry';
import { Struct } from './structure';

/**
 * Prefab base tubes (#508): the short glass tubes that join a prefab base's modules across open ground. In the sim a tube is
 * plain structure, a run of floor tiles one wide between two rows of wall with a door at each end where it meets a module's
 * wall: air, sealing, paths and integrity treat it as any corridor. The `tube` grid field marks its floor tiles (1, else 0),
 * looks only: the renderer draws the run as a glass tube with a port at each end (render/tubeArt.ts) instead of floor and walls.
 * Only the base generator lays tubes (shipgen/assembly/prefab.ts); a tube tile whose floor is lost stops being one.
 *
 * This module is the one owner of the questions "is this tile a tube's" and "which runs and doors make up the tubes".
 */

/** Template `tubes` rows: this character marks a tube's floor tile (anything else is none). */
export const TUBE_CHAR = 'o';

/** A tube's floor by the tile's fields: the `tube` layer set on a floor tile. */
export const tubeFloor = (struct: number, tube: number): boolean => tube !== 0 && struct === Struct.Floor;

/** True if the tile is a tube's floor. */
export function isTube(grid: GridLike, x: number, y: number): boolean {
  return grid.has('tube') && grid.inBounds(x, y) && tubeFloor(grid.get('struct', x, y), grid.get('tube', x, y));
}

/**
 * True if the tile is a tube's own (its floor, or a wall beside it), by the tile's fields and whether a 4-neighbour is a tube's
 * floor: the renderer draws these as the glass tube, not as floor and walls. The doors at its ends are the modules'.
 */
export function tubeOwn(struct: number, tube: number, floorBeside: () => boolean): boolean {
  return tubeFloor(struct, tube) || (struct === Struct.Wall && floorBeside());
}

/** A tube as the renderer draws it: its floor tiles from (x, y) running `len` along `axis`, and the door tiles at its two ends. */
export interface TubeRun {
  axis: 'x' | 'y';
  /** The first floor tile (lowest coordinate along the axis). */
  x: number;
  y: number;
  len: number;
  /** The end tile before the first floor tile (the module wall facing +x or +y: toward the camera) and the one after the last. */
  far: { x: number; y: number };
  near: { x: number; y: number };
}

/**
 * The run along which a tube tile lies: along x when the tiles either side of it across y are not tube floor (its walls),
 * else along y. A one-tile tube between two doors reads its axis from the doors.
 */
function axisAt(grid: GridLike, x: number, y: number): 'x' | 'y' {
  const along = (dx: number, dy: number): boolean => isTube(grid, x + dx, y + dy) || (grid.inBounds(x + dx, y + dy) && grid.get('struct', x + dx, y + dy) === Struct.Door);
  if (isTube(grid, x + 1, y) || isTube(grid, x - 1, y)) return 'x';
  if (isTube(grid, x, y + 1) || isTube(grid, x, y - 1)) return 'y';
  return along(1, 0) || along(-1, 0) ? 'x' : 'y';
}

/** Every tube run whose first floor tile lies in the rectangle [x0, x0 + w) x [y0, y0 + h), in row order. */
export function tubeRuns(grid: GridLike, x0 = grid.x0, y0 = grid.y0, w = grid.width, h = grid.height): TubeRun[] {
  const out: TubeRun[] = [];
  if (!grid.has('tube')) return out;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!isTube(grid, x, y)) continue;
      const axis = axisAt(grid, x, y), dx = axis === 'x' ? 1 : 0, dy = 1 - dx;
      if (isTube(grid, x - dx, y - dy) && axisAt(grid, x - dx, y - dy) === axis) continue; // not the run's first tile
      let len = 1;
      while (isTube(grid, x + dx * len, y + dy * len) && axisAt(grid, x + dx * len, y + dy * len) === axis) len++;
      out.push({ axis, x, y, len, far: { x: x - dx, y: y - dy }, near: { x: x + dx * len, y: y + dy * len } });
    }
  return out;
}

/** The template's tube floor tiles (local coordinates), row by row. */
export function templateTubes(t: Pick<ShipTemplate, 'tubes'>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  (t.tubes ?? []).forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === TUBE_CHAR) out.push({ x, y }); });
  return out;
}

/** Template tube rows (`w` x `h`) marking the tiles of `tubes` (row-major indices over a `w`-wide layout). */
export function tubeRows(w: number, h: number, tubes: ReadonlySet<number>): string[] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (tubes.has(y * w + x) ? TUBE_CHAR : '.')).join(''));
}
