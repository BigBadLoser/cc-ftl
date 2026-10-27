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

/**
 * The size of a tile field: every tile the outer hull profile encloses (the ring itself is not interior). Interior walls, doors, modules and
 * floor all count as area. A tile is interior when open space cannot reach it from outside the box and it is not an outer-profile hull tile.
 */
export function interiorArea(kindAt: (x: number, y: number) => number, box: { x: number; y: number; w: number; h: number }): number {
  const key = (x: number, y: number): number => (y - box.y) * box.w + (x - box.x);
  const outside = new Uint8Array(box.w * box.h);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h || outside[key(x, y)] || kindAt(x, y) !== Struct.Space) return;
    outside[key(x, y)] = 1;
    stack.push(x, y);
  };
  for (let x = box.x; x < box.x + box.w; x++) {
    push(x, box.y);
    push(x, box.y + box.h - 1);
  }
  for (let y = box.y; y < box.y + box.h; y++) {
    push(box.x, y);
    push(box.x + box.w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  const open = (x: number, y: number): boolean => x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h || kindAt(x, y) === Struct.Space;
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (outside[key(x, y)]) continue;
      const kind = kindAt(x, y);
      if (kind === Struct.Space) {
        n++; // a pocket of space shut inside the hull
        continue;
      }
      if (!(isHullKind(kind) && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)))) n++;
    }
  }
  return n;
}

const TEMPLATE_KINDS: Record<string, number> = { '#': Struct.Wall, D: Struct.Door, '=': Struct.Beam, _: Struct.Floor };
const templateKind = (rows: readonly string[]) => (x: number, y: number): number => TEMPLATE_KINDS[rows[y]?.[x] ?? '.'] ?? Struct.Space;
const templateBox = (rows: readonly string[]) => ({ x: 0, y: 0, w: Math.max(0, ...rows.map((r) => r.length)), h: rows.length });

/** The outer profile of a ship template's rows ('#' wall, 'D' door, '=' beam face open space '.'). */
export function templateHullTiles(rows: readonly string[]): number {
  return outerProfile(templateKind(rows), templateBox(rows));
}

/** The size of a ship template (`interiorArea`): what an enemy's size is on the jobs screen. */
export function templateHullArea(rows: readonly string[]): number {
  return interiorArea(templateKind(rows), templateBox(rows));
}

const tileCounts = new WeakMap<Grid, { struct: number; n: number; area: number }>();

function counts(grid: Grid): { n: number; area: number } {
  const rev = grid.revision('struct');
  const hit = tileCounts.get(grid);
  if (hit && hit.struct === rev) return hit;
  const box = { x: grid.x0, y: grid.y0, w: grid.width, h: grid.height };
  const struct = grid.load('struct', box);
  const kindAt = (x: number, y: number): number => struct[(y - box.y) * box.w + (x - box.x)] as number;
  const out = { struct: rev, n: outerProfile(kindAt, box), area: interiorArea(kindAt, box) };
  tileCounts.set(grid, out);
  return out;
}

/** Hull tiles of a grid: its outer hull profile (`outerProfile`). What the yard prices and caps. Cached until the `struct` revision changes. */
export const hullTiles = (grid: Grid): number => counts(grid).n;

/**
 * The ship's size: every tile its outer hull encloses (`interiorArea`). What engine capacity, the ship panel's readout, the yard's overall ship
 * maximum and the jobs screen's combat strength measure. Cached with `hullTiles`.
 */
export const hullArea = (grid: Grid): number => counts(grid).area;

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

