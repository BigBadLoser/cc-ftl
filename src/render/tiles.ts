import { Struct } from "../sim/structure";

export type KindAt = (x: number, y: number) => number;
/** One sprite to draw: the first existing asset id of the chain. */
export type Chain = string[];
/** Wall view mode: up = walls up, auto = cutaway (partitions cut, far hull full), down = shortest (whole hull a ghost rim). */
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
  /** Drawn in the under-floor layer (the hull's belly below the deck), so the deck in front hides it. */
  under?: boolean;
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

/** Wall view level of the art (tools/blender/sprites/walls.py LEVELS) for a cutaway mode. */
export type WallLevel = "up" | "cut" | "low";
export const wallLevel = (mode: CutawayMode): WallLevel => (mode === "up" ? "up" : mode === "down" ? "low" : "cut");
const PRE: Record<WallLevel, string> = { up: "full.", cut: "", low: "low." };

/**
 * Which way a hull tile faces space toward the camera: 1 = space at +y, 2 = at +x, 3 = both (the chamfered outer
 * corner), 4 = only diagonally at (+1, +1) (a concave corner), 0 = none (a far hull tile, or not hull at all).
 */
export function outward(kindAt: KindAt, x: number, y: number): number {
  if (!touchesSpace(kindAt, x, y)) return 0;
  const o = (kindAt(x, y + 1) === Struct.Space ? 1 : 0) | (kindAt(x + 1, y) === Struct.Space ? 2 : 0);
  return o || (kindAt(x + 1, y + 1) === Struct.Space ? 4 : 0);
}

/** True if the hull tile at (x, y) draws as a ghost at this level (the near hull always, every hull side in `low`). */
function ghostAt(kindAt: KindAt, x: number, y: number, level: WallLevel): boolean {
  const k = kindAt(x, y);
  return k === Struct.Wall && touchesSpace(kindAt, x, y) && (outward(kindAt, x, y) > 0 || level === "low");
}

/** True if the hull ghost at (x, y) (the near hull, or any hull side in `down`) replaces the floor plate under it. */
export function replacesFloor(kindAt: KindAt, x: number, y: number, mode: CutawayMode = "auto"): boolean {
  return solidish(kindAt(x, y)) && touchesSpace(kindAt, x, y) && (outward(kindAt, x, y) > 0 || wallLevel(mode) === "low");
}

/**
 * Pieces of the wall, hull or door at (x, y), after walls pass 9 (walls.py / hull.py / envtiles.py; the walls art is
 * not final, keep this the one place that maps the grid to wall sprite ids). Three view levels (`wallLevel`):
 *  - up: full-height partitions and far hull; cut: partitions cut above the skirt, the far hull full; low: partition
 *    stubs, every hull side a ghost rim (`tile.hull.ghost.m*`).
 *  - The near hull (a hull tile with space at +x / +y / the +x+y diagonal) is a ghost in every level:
 *    `tile.hull.o<outward>.m<mask>` (a flat rim with a lit crest), plus its belly below the deck
 *    `tile.hull.belly.o<outward>.m<mask>` (not for concave corners), drawn under the floor layer (`under`).
 *  - A wall or far hull tile butting into a ghost gets an end face (`tile.<fam>.<pre>end.s|e`).
 *  - Doors are never cut (`tile.door.x|y`); a door in the near hull hangs the belly under it (`tile.hull.drop.s|e`, under).
 *  - Hull plating and bellies use the ochre `.v1` variant on every third diagonal.
 * `ghosts` false (blueprints) draws plain blocks instead of ghosts.
 */
export function wallPieces(
  kindAt: KindAt,
  x: number,
  y: number,
  kind: number,
  mode: CutawayMode,
  ghosts = true,
): Piece[] {
  const level = wallLevel(mode);
  const o = outward(kindAt, x, y);
  if (kind === Struct.Door) {
    const ax = solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    const out: Piece[] = [{ chain: [`tile.door.${ax}`], order: 0 }];
    if (o && ghosts) out.push({ chain: [`tile.hull.drop.${o & 1 ? "s" : "e"}`], order: 1, under: true });
    return out;
  }
  const mask = wallMask(kindAt, x, y);
  const hull = touchesSpace(kindAt, x, y);
  const v = hull && (((x + y) % 3) + 3) % 3 === 0 ? ".v1" : "";
  if (ghosts && hull && o) {
    const out: Piece[] = [{ chain: [`tile.hull.o${o}.m${mask}`], order: 0 }];
    if (o < 4) out.push({ chain: [`tile.hull.belly.o${o}.m${mask}${v}`, `tile.hull.belly.o${o}.m${mask}`], order: 1, under: true });
    return out;
  }
  if (ghosts && hull && level === "low") return [{ chain: [`tile.hull.ghost.m${mask}`], order: 0 }];
  const fam = hull ? "hull" : "wall";
  const base = `tile.${fam}.${PRE[level]}m${mask}`;
  const out: Piece[] = [{ chain: [base + v, base], order: 0 }];
  if (ghosts && mask & 4 && ghostAt(kindAt, x, y + 1, level)) out.push({ chain: [`tile.${fam}.${PRE[level]}end.s`], order: 1 });
  if (ghosts && mask & 2 && ghostAt(kindAt, x + 1, y, level)) out.push({ chain: [`tile.${fam}.${PRE[level]}end.e`], order: 1 });
  return out;
}
