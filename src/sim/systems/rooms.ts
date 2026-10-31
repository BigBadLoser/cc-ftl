import { ShipC } from '../combat/components';
import { Struct } from '../structure';
import type { Grid } from '../grid';
import { ROOM_TEMP_EPSILON } from '../roomTemp';
import { NORMAL_TEMP } from '../tuning';
import { regions } from '../regions';
import type { Sim } from '../sim';

/**
 * Last `struct` revision each grid was analysed at. Module-level and never serialized: after a
 * load (new Grid objects) everything recomputes. Weak keys, so dropped grids are collected.
 */
const seen = new WeakMap<Grid, number>();

/** Flood-fill Floor tiles (4-neighbour) into rooms. Walls/doors separate rooms; doors get room 0. */
export function roomsSystem(sim: Sim): void {
  for (const { grid, ship } of regions(sim)) {
    if (!grid.has('struct') || !grid.has('room')) continue;
    const rev = grid.revision('struct');
    if (seen.get(grid) === rev) continue;
    recomputeRooms(grid, sim.world.get(ship, ShipC));
    seen.set(grid, rev);
  }
}

/**
 * Relabel the rooms of `grid` from its structure. When labels change, the ship's per-room temperatures follow the tiles: each new
 * room takes the mean of the old values under its tiles (a tile in no old room counts as NORMAL_TEMP), so a split keeps both halves'
 * temperature and a merge averages by size. Exported for the derelict pass, which labels a freshly stamped wreck before setting air.
 */
export function recomputeRooms(grid: Grid, ship?: { roomTemp?: Record<number, number>; roomVacuum?: number[] }): void {
  const { width, height } = grid;
  const struct = grid.load('struct');
  const before = grid.load('room');
  const labels = new Uint16Array(width * height);
  let next = 0;
  const stack: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (struct[start] !== Struct.Floor || labels[start] !== 0) continue;
      next++;
      labels[start] = next;
      stack.push(start);
      while (stack.length > 0) {
        const i = stack.pop() as number;
        const cx = i % width;
        const cy = (i - cx) / width;
        if (cx > 0) visit(i - 1);
        if (cx < width - 1) visit(i + 1);
        if (cy > 0) visit(i - width);
        if (cy < height - 1) visit(i + width);
      }
    }
  }
  function visit(i: number): void {
    if (struct[i] === Struct.Floor && labels[i] === 0) {
      labels[i] = next;
      stack.push(i);
    }
  }
  const old = ship?.roomTemp;
  const sum = old ? new Map<number, number>() : undefined;
  const count = new Map<number, number>();
  let changed = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = labels[i] as number;
      if (before[i] !== v) {
        grid.set('room', grid.x0 + x, grid.y0 + y, v);
        changed = true;
      }
      if (sum && v !== 0) {
        sum.set(v, (sum.get(v) ?? 0) + (old?.[before[i] as number] ?? NORMAL_TEMP));
        count.set(v, (count.get(v) ?? 0) + 1);
      }
    }
  }
  if (changed && ship) delete ship.roomVacuum; // ids moved: the vacuum scan finds them again
  if (!ship || !old || !sum || !changed) return;
  const temps: Record<number, number> = {};
  for (const [v, s] of sum) {
    const mean = s / (count.get(v) as number);
    if (Math.abs(mean - NORMAL_TEMP) > ROOM_TEMP_EPSILON) temps[v] = mean;
  }
  ship.roomTemp = temps;
}
