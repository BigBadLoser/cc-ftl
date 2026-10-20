import { Struct } from '../structure';
import type { Grid } from '../grid';
import { regions } from '../regions';
import type { Sim } from '../sim';

/**
 * Last `struct` revision each grid was analysed at. Module-level and never serialized: after a
 * load (new Grid objects) everything recomputes. Weak keys, so dropped grids are collected.
 */
const seen = new WeakMap<Grid, number>();

/** Flood-fill Floor tiles (4-neighbour) into rooms. Walls/doors separate rooms; doors get room 0. */
export function roomsSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('struct') || !grid.has('room')) continue;
    const rev = grid.revision('struct');
    if (seen.get(grid) === rev) continue;
    recompute(grid);
    seen.set(grid, rev);
  }
}

function recompute(grid: Grid): void {
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = labels[y * width + x] as number;
      if (before[y * width + x] !== v) grid.set('room', grid.x0 + x, grid.y0 + y, v);
    }
  }
}
