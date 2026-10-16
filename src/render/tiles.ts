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

/** One sprite of a wall tile: the first existing asset id of the chain, plus its draw order inside the tile. */
export interface Piece {
  chain: Chain;
  order: number;
}

type Dir = "n" | "e" | "s" | "w";
const ARMS: readonly [Dir, number, number, number][] = [
  ["n", 0, -1, 0],
  ["w", -1, 0, 1],
  ["s", 0, 1, 3],
  ["e", 1, 0, 4],
];
const CENTRE_ORDER = 2;
/** Upper pieces draw after every base piece of the tile. */
const UPPER = 10;
const DOOR_ORDER = UPPER + CENTRE_ORDER;

/**
 * Pieces of the wall, hull or door at (x, y), drawn in `order` ascending with the tile. A wall is a low sloped base
 * plus a thin upper wall, both built from a centre piece and one arm toward each connected (wall or door) neighbour:
 * back arms (n, w), centre, front arms (s, e). Cutaway (`low`) swaps only the upper wall for a short stub and
 * leaves the base. Doors draw no wall base: a threshold sill plus a slim frame that stands whatever the cutaway; the frame runs along x when
 * walls flank it in x, otherwise along y. Hull walls are walls touching space.
 */
export function wallPieces(
  kindAt: KindAt,
  x: number,
  y: number,
  kind: number,
  low: boolean,
): Piece[] {
  const fam = touchesSpace(kindAt, x, y) ? "hull" : "wall";
  const arms = ARMS.filter(([, dx, dy]) => solidish(kindAt(x + dx, y + dy)));
  const part = (layer: string, id: string): Chain => [
    `tile.${fam}.${layer}.${id}`,
    `tile.wall.${layer}.${id}`,
  ];
  const out: Piece[] = [];
  const add = (layer: string, base: number): void => {
    out.push({ chain: part(layer, "c"), order: base + CENTRE_ORDER });
    for (const [d, , , o] of arms)
      out.push({ chain: part(layer, `arm.${d}`), order: base + o });
  };
  if (kind === Struct.Door) {
    // No wall base through the opening: a threshold sill (with feet that meet the neighbouring wall bases) and the frame.
    const o =
      solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    out.push({ chain: [`tile.door.sill.${o}`], order: 0 });
    out.push({ chain: [`tile.door.${o}`], order: DOOR_ORDER });
    return out;
  }
  add("base", 0);
  add(low ? "upper.low" : "upper", UPPER);
  return out;
}
