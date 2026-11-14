import { Struct } from "../sim/structure";
import { bellyIds, hullKeys, type HullKeys } from "./hullArt";
import { HullSide, hullSide, type KindAt } from "./tiles";

/** The hull pieces a pending build tile shows in place of the old wall art (null: the tile has no hull art). */
export interface PendingHull {
  under?: string;
  low?: string;
  /** The tile is near hull: the hull's cut piece stands in for its wall pieces. */
  replacesWall: boolean;
}

/**
 * The hull of the ship as it will be once every pending build is done, for the blueprint ghosts: the same keys and belly
 * pieces the finished tiles draw (hullArt), so a ghost matches what is built. `kindAt` has the pending structs merged in.
 */
export function pendingHullKeys(kindAt: KindAt, W: number, H: number): HullKeys | null {
  return hullKeys(kindAt, W, H);
}

/** The hull ghost for the pending tile (x, y) of struct `kind`, or null to draw it as before (floor, partition, far hull). */
export function pendingHull(h: HullKeys | null, kindAt: KindAt, x: number, y: number, kind: number, has: (id: string) => boolean): PendingHull | null {
  if (!h) return null;
  if (kind !== Struct.Floor && hullSide(kindAt, x, y) !== HullSide.Near) return null;
  const b = bellyIds(h, x, y, has);
  return b ? { ...b, replacesWall: kind !== Struct.Floor } : null;
}

/**
 * Whether an old wall piece of a tile stays once the new hull art is drawn there (cutaway views): none of a wall's, and a door
 * keeps its own pieces without the old belly under it. The one rule of the finished tiles (gridView) and the blueprint ghosts.
 */
export function keepsOldPiece(kind: number, ghosts: boolean, under: boolean | undefined): boolean {
  return kind === Struct.Door && ghosts && !under;
}
