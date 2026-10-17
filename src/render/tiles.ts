import { Struct } from "../sim/structure";

export type KindAt = (x: number, y: number) => number;
/** One sprite to draw: the first existing asset id of the chain. */
export type Chain = string[];
/** Wall height mode: auto/down = low cutaway blocks, up = full-height walls. Exterior front hull is a ghost in all. */
export type CutawayMode = "auto" | "up" | "down";

const solidish = (k: number) => k === Struct.Wall || k === Struct.Door;

export function touchesSpace(kindAt: KindAt, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && kindAt(x + dx, y + dy) === Struct.Space) return true;
  return false;
}

/** Deterministic per-tile hash (the Blender contact sheet mirrors it). */
export function tileHash(x: number, y: number): number {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** One main plate; two very subtle variants on ~10% of tiles. Grates, hatches and the rest stay unused in the manifest.
 * Keep in sync with contact_sheet.py. */
export function floorChain(x: number, y: number): Chain {
  const r = (tileHash(x, y) >>> 8) % 20;
  const v = r === 0 ? "c" : r === 1 ? "h" : "a";
  return [`tile.floor.${v}`, "tile.floor.a"];
}

/** One sprite of a wall tile: the first existing asset id of the chain, plus its draw order inside the tile. */
export interface Piece {
  chain: Chain;
  order: number;
}

/** Neighbour mask: bit 1 = N (-y), 2 = E (+x), 4 = S (+y), 8 = W (-x). Walls, hull and doors connect. */
export function wallMask(kindAt: KindAt, x: number, y: number): number {
  return (
    (solidish(kindAt(x, y - 1)) ? 1 : 0) |
    (solidish(kindAt(x + 1, y)) ? 2 : 0) |
    (solidish(kindAt(x, y + 1)) ? 4 : 0) |
    (solidish(kindAt(x - 1, y)) ? 8 : 0)
  );
}

/**
 * Pieces of the wall, hull or door at (x, y). A wall is one block piece chosen by its 4-bit neighbour mask (connected
 * sides are cut flush, open sides slope), low (cutaway) or full height by `mode`. Hull walls are walls touching space. A hull tile whose +x or +y neighbour is
 * space faces the camera from outside: with `ghosts` on it draws as a dark translucent silhouette so it never hides
 * the interior (all modes). Visible exterior slopes of hull blocks get a hazard strip overlay. Doors orient along x when walls
 * flank them in x, otherwise along y.
 */
export function wallPieces(
  kindAt: KindAt,
  x: number,
  y: number,
  kind: number,
  mode: CutawayMode,
  ghosts = true,
): Piece[] {
  if (kind === Struct.Door) {
    const o =
      solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    return [{ chain: [`tile.door.${o}`], order: 0 }];
  }
  const mask = wallMask(kindAt, x, y);
  const hull = touchesSpace(kindAt, x, y);
  const spaceS = kindAt(x, y + 1) === Struct.Space;
  const spaceE = kindAt(x + 1, y) === Struct.Space;
  if (hull && ghosts && (spaceS || spaceE))
    return [{ chain: [`tile.hull.ghost.m${mask}`], order: 0 }];
  const fam = hull ? "hull" : "wall";
  const id = `tile.${fam}.m${mask}`;
  const chain: Chain = mode === "up" ? [`tile.${fam}.full.m${mask}`, id] : [id];
  const out: Piece[] = [{ chain, order: 0 }];
  if (hull) {
    if (!(mask & 4) && spaceS)
      out.push({
        chain: [`tile.hull.haz.s.${(mask & 8 ? 1 : 0) | (mask & 2 ? 2 : 0)}`],
        order: 1,
      });
    if (!(mask & 2) && spaceE)
      out.push({
        chain: [`tile.hull.haz.e.${(mask & 1 ? 1 : 0) | (mask & 4 ? 2 : 0)}`],
        order: 1,
      });
  }
  return out;
}
