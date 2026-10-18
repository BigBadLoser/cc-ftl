import type { Grid } from '../grid';
import { Struct, bordersSpace } from '../structure';

/** Sum of wall and door integrity on a grid. */
export function hullSum(grid: Grid): number {
  const struct = grid.raw('struct');
  const hp = grid.raw('hp');
  let sum = 0;
  for (let i = 0; i < struct.length; i++) {
    if (struct[i] === Struct.Wall || struct[i] === Struct.Door) sum += hp[i] as number;
  }
  return sum;
}

/** Reduce a wall/door tile's integrity. At 0 it breaches: Space if it borders space, else open Floor. Returns true on breach. */
export function damageStruct(grid: Grid, x: number, y: number, amount: number): boolean {
  const kind = grid.get('struct', x, y);
  if (kind !== Struct.Wall && kind !== Struct.Door) return false;
  const left = Math.max(0, Math.round(grid.get('hp', x, y) - amount));
  if (left > 0) {
    grid.set('hp', x, y, left);
    return false;
  }
  grid.set('hp', x, y, 0);
  grid.set('struct', x, y, bordersSpace(grid, x, y) ? Struct.Space : Struct.Floor);
  grid.set('door', x, y, 0);
  return true;
}

