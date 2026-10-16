import type { Grid } from '../grid';

/**
 * Which power network a tile belongs to. Today a grid is one network (0 for every on-grid tile). When conduits
 * arrive this is the only function that has to learn to partition tiles into networks.
 */
export function networkOf(grid: Grid, x: number, y: number): number {
  return grid.inBounds(x, y) ? 0 : 1;
}
