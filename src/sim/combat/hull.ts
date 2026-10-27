import type { Grid } from '../grid';
import { Struct, bordersSpace, syncOwner } from '../structure';

const sums = new WeakMap<Grid, { hp: number; struct: number; sum: number }>();

/** Sum of wall and door integrity on a grid. Cached until its `hp` or `struct` revision changes. */
export function hullSum(grid: Grid): number {
  const hpRev = grid.revision('hp');
  const structRev = grid.revision('struct');
  const hit = sums.get(grid);
  if (hit && hit.hp === hpRev && hit.struct === structRev) return hit.sum;
  const struct = grid.load('struct');
  const hp = grid.load('hp');
  let sum = 0;
  for (let i = 0; i < struct.length; i++) {
    if (struct[i] === Struct.Wall || struct[i] === Struct.Door) sum += hp[i] as number;
  }
  sums.set(grid, { hp: hpRev, struct: structRev, sum });
  return sum;
}

/** Structure kinds that make a ship's hull when they face open space: walls and doors, beams, finished rock walls. */
export const isHullKind = (kind: number): boolean => kind === Struct.Wall || kind === Struct.Door || kind === Struct.Beam || kind === Struct.RockWall;

/**
 * The outer hull profile of a tile field: hull-kind tiles with open space (or the field's edge) on a side. `kindAt` reads a tile's struct kind;
 * the box is the area to count in. Interior walls and doors, and floor, never count.
 */
export function outerProfile(kindAt: (x: number, y: number) => number, box: { x: number; y: number; w: number; h: number }): number {
  const open = (x: number, y: number): boolean => x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h || kindAt(x, y) === Struct.Space;
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (isHullKind(kindAt(x, y)) && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) n++;
    }
  }
  return n;
}

/** The outer profile of a ship template's rows ('#' wall, 'D' door, '=' beam face open space '.'): what an enemy's hull count is on the jobs screen. */
export function templateHullTiles(rows: readonly string[]): number {
  const w = Math.max(0, ...rows.map((r) => r.length));
  const kinds: Record<string, number> = { '#': Struct.Wall, D: Struct.Door, '=': Struct.Beam, _: Struct.Floor };
  return outerProfile((x, y) => kinds[rows[y]?.[x] ?? '.'] ?? Struct.Space, { x: 0, y: 0, w, h: rows.length });
}

const tileCounts = new WeakMap<Grid, { struct: number; n: number }>();

/**
 * Hull tiles of a grid: its outer hull profile (`outerProfile`), the one count the ship panel ("Hull N / M"), the engine capacity
 * (ftl/capacity.ts), the yard's price and size cap, and the jobs screen's combat strength all use. Cached until the `struct` revision changes.
 */
export function hullTiles(grid: Grid): number {
  const rev = grid.revision('struct');
  const hit = tileCounts.get(grid);
  if (hit && hit.struct === rev) return hit.n;
  const box = { x: grid.x0, y: grid.y0, w: grid.width, h: grid.height };
  const struct = grid.load('struct', box);
  const n = outerProfile((x, y) => struct[(y - box.y) * box.w + (x - box.x)] as number, box);
  tileCounts.set(grid, { struct: rev, n });
  return n;
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
  if (grid.has('jam')) grid.set('jam', x, y, 0);
  syncOwner(grid, x, y);
  return true;
}

