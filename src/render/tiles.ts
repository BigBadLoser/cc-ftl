import { Struct } from "../sim/structure";

export type KindAt = (x: number, y: number) => number;
/** One sprite to draw: the first existing asset id of the chain. */
export type Chain = string[];

const solidish = (k: number) => k === Struct.Wall || k === Struct.Door;
const interior = (k: number) => k === Struct.Floor || k === Struct.Door;

export function touchesSpace(kindAt: KindAt, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && kindAt(x + dx, y + dy) === Struct.Space) return true;
  return false;
}

/** The camera looks toward -x/-y, so interior behind a tile (lower x/y) means the tile is near the camera and gets cut. */
export function isLowered(
  kindAt: KindAt,
  x: number,
  y: number,
  mode: "auto" | "up" | "down",
): boolean {
  if (mode === "up") return false;
  if (mode === "down") return true;
  return (
    interior(kindAt(x - 1, y)) ||
    interior(kindAt(x, y - 1)) ||
    interior(kindAt(x - 1, y - 1))
  );
}

const FLOORS = ["a", "b", "a", "a", "c"];
export function floorChain(x: number, y: number): Chain {
  const v = FLOORS[(x * 7 + y * 13 + ((x ^ y) & 3)) % FLOORS.length] as string;
  return [`tile.floor.${v}`, "tile.floor.a"];
}

/**
 * Sprite chain for the wall, hull or door block at (x, y). Walls are full-tile blocks, so there is exactly one per
 * tile and no stacking at corners or junctions. Hull walls are walls touching space. Doors run along x when walls
 * flank them in x, otherwise along y; `low` picks the cutaway block.
 */
export function wallChain(
  kindAt: KindAt,
  x: number,
  y: number,
  kind: number,
  low: boolean,
): Chain {
  if (kind === Struct.Door) {
    const o =
      solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    return low
      ? [`tile.door.low.${o}`, `tile.door.${o}`, "tile.wall.low"]
      : [`tile.door.${o}`, "tile.wall"];
  }
  const base = touchesSpace(kindAt, x, y) ? "tile.hull" : "tile.wall";
  return low
    ? [`${base}.low`, "tile.wall.low", base, "tile.wall"]
    : [base, "tile.wall"];
}
