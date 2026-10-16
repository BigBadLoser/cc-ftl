import { Struct } from '../sim/structure';

export type KindAt = (x: number, y: number) => number;
/** One sprite to draw: the first existing asset id of the chain. */
export type Chain = string[];

const solidish = (k: number) => k === Struct.Wall || k === Struct.Door;
const interior = (k: number) => k === Struct.Floor || k === Struct.Door;

export function touchesSpace(kindAt: KindAt, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && kindAt(x + dx, y + dy) === Struct.Space) return true;
  return false;
}

/** The camera looks toward -x/-y, so interior behind a tile (lower x/y) means the tile is near the camera and gets cut. */
export function isLowered(kindAt: KindAt, x: number, y: number, mode: 'auto' | 'up' | 'down'): boolean {
  if (mode === 'up') return false;
  if (mode === 'down') return true;
  return interior(kindAt(x - 1, y)) || interior(kindAt(x, y - 1)) || interior(kindAt(x - 1, y - 1));
}

const FLOORS = ['a', 'b', 'a', 'a', 'c'];
export function floorChain(x: number, y: number): Chain {
  const v = FLOORS[(x * 7 + y * 13 + ((x ^ y) & 3)) % FLOORS.length] as string;
  return [`tile.floor.${v}`, 'tile.floor.a'];
}

const orient = (base: string, o: 'x' | 'y', low: boolean): Chain =>
  low ? [`${base}.low.${o}`, `tile.wall.low.${o}`, `${base}.${o}`, `tile.wall.${o}`] : [`${base}.${o}`, `tile.wall.${o}`];

/**
 * Sprite chains for a wall or door of `kind` at (x, y). Walls are slabs through the tile centre, so a wall
 * with neighbours along x draws the x slab, along y the y slab, both for corners and junctions.
 * Doors run along x when walls flank them in x. Hull walls are walls touching space.
 */
export function wallChains(kindAt: KindAt, x: number, y: number, kind: number, low: boolean): Chain[] {
  const alongX = solidish(kindAt(x - 1, y)) || solidish(kindAt(x + 1, y));
  const alongY = solidish(kindAt(x, y - 1)) || solidish(kindAt(x, y + 1));
  if (kind === Struct.Door) {
    const flank = solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y));
    return [orient('tile.door', flank ? 'x' : 'y', low)];
  }
  const base = touchesSpace(kindAt, x, y) ? 'tile.hull' : 'tile.wall';
  const out: Chain[] = [];
  if (alongX || !alongY) out.push(orient(base, 'x', low));
  if (alongY) out.push(orient(base, 'y', low));
  return out;
}
