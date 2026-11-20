import { hullKeyName } from "./hullKey";
import type { HullKeys, HullLook } from "./hullArt";
import type { Piece } from "./tiles";

/**
 * The far hull's diagonal walls with the walls up (#561; tools/blender/sprites/wall_diag.py): a staircase on the far side
 * (its hull front (-1, -1)) draws a wall on the diagonal, one piece per step tile, with its cap.
 */

/** A step tile's piece: "a" the end meeting the run along y, "b" the end meeting the run along x, "m" a step between. */
export type DiagRole = "a" | "m" | "b";

const names = (h: HullKeys, x: number, y: number): string[] => {
  const k = h.at(x, y);
  return k ? hullKeyName(k).split("~") : [];
};

/** The tile's role on a far diagonal (its hull key the diagonal's front through the tile), or null. */
export function diagRole(h: HullKeys, x: number, y: number): DiagRole | null {
  if (!names(h, x, y).includes("m1_m1_m1")) return null;
  if (names(h, x, y + 1).some((n) => n.startsWith("m1_0_"))) return "a";
  if (names(h, x + 1, y).some((n) => n.startsWith("0_m1_"))) return "b";
  return "m";
}

/** The tile's diagonal wall and cap (the station's, falling back to the ship's), or null. A ground base's only for now:
 * a ship keeps its cut hull pieces there. */
export function diagWallPieces(h: HullKeys, x: number, y: number, look: HullLook): Piece[] | null {
  const r = look === "station" ? diagRole(h, x, y) : null;
  if (!r) return null;
  return [{ chain: [`tile.wall.diag.${r}`], order: 0 }, { chain: [`tile.hull.station.cap.diag.${r}`, `tile.hull.cap.diag.${r}`], order: 1 }];
}
