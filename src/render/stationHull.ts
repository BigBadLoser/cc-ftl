import { hullKeyName } from "./hullKey";
import type { HullKeys } from "./hullArt";
import { tileHash } from "./tiles";

/**
 * The rock berm heaped against a ground base's station hull (#524; the `station_hull` sprite family's
 * `tile.hull.station.berm.<key>.v<n>[.e<a><b>]`, tools/blender/sprites/station_berm.py), picked per tile by its hull key.
 * Only a base standing on asteroid ground has one (hullArt `HullLook` "station").
 */

/** Variants of a straight run's berm (station_berm.RUN_CHARACTER): 0-3 with a rock clump, 4-7 bare. */
export const BERM_RUN = 8;
/** Variants of any other key's berm (station_berm.CHARACTER). */
export const BERM_OTHER = 3;

const hash = (a: number, b: number, salt: number): number => tileHash(a + salt * 7919, b - salt * 104729) >>> 8;
const num = (t: string): number => (t.startsWith("m") ? -Number(t.slice(1)) : Number(t));

/**
 * The berm sprite on this tile, or null (no key, or no art for it). `roofed` false (the hull cut down: every unroofed view) takes
 * its low version (`.low`, flattened under the hull's cut), none where that has no art.
 */
export function bermId(h: HullKeys, x: number, y: number, has: (id: string) => boolean, roofed = true): string | null {
  const k = h.at(x, y);
  if (!k) return null;
  const name = hullKeyName(k);
  const id = `tile.hull.station.berm.${name}.v${runVariant(h, x, y, name) ?? hash(x, y, 3) % BERM_OTHER}${ends(h, x, y, name)}${roofed ? "" : ".low"}`;
  return has(id) ? id : null;
}

/**
 * The near hull's foot on this tile with the walls up (`tile.hull.station.low.<key>`, station_hull_walls: the station's piece
 * cut down under its groove, in place of the ship's cut top and belly), or null where the art has none.
 */
export function lowId(h: HullKeys, x: number, y: number, has: (id: string) => boolean): string | null {
  const k = h.at(x, y);
  const id = k ? `tile.hull.station.low.${hullKeyName(k)}` : null;
  return id && has(id) ? id : null;
}

const nameAt = (h: HullKeys, x: number, y: number): string => {
  const k = h.at(x, y);
  return k ? hullKeyName(k) : "";
};

/** A straight run (one front along x or y): "x" or "y", else null. */
const runAxis = (name: string): "x" | "y" | null => (/^(0_m?1|m?1_0)_[0-9]+$/.test(name) ? (name.startsWith("0_") ? "x" : "y") : null);

/**
 * A straight run's variant: one tile in every three along it a rock clump (0-3), the rest bare (4-7); an even tile takes from
 * one half of its set and an odd one from the other, so no two neighbours are alike. Null for any other key.
 */
function runVariant(h: HullKeys, x: number, y: number, name: string): number | null {
  const axis = runAxis(name);
  if (!axis) return null;
  const [u, l] = axis === "x" ? [x, y] : [y, x];
  const cell = Math.floor(u / 3);
  const rocky = u - 3 * cell === hash(cell, l, 7) % 3;
  return (rocky ? 0 : 4) + (u & 1 ? 2 : 0) + (hash(x, y, 3) % 2);
}

/**
 * The berm's end types (`.e<a><b>`), "" for a key with none. A straight run: each tile boundary a heap or not (4 in 10), only
 * between two tiles of the same run (a boundary's two tiles agree). A single diagonal front: where it meets a straight wall at
 * the tile's edge the drift turns the corner with it (station_berm._turns: a, the vertex on the tile's top or bottom edge; b,
 * the one on its side edge; 1 where the neighbour across it has that wall).
 */
function ends(h: HullKeys, x: number, y: number, name: string): string {
  const axis = runAxis(name);
  if (axis) {
    const [dx, dy] = axis === "x" ? [1, 0] : [0, 1];
    const salt = axis === "x" ? 5 : 6;
    const edge = (bx: number, by: number, ox: number, oy: number) => (nameAt(h, ox, oy) === name && hash(bx, by, salt) % 10 < 4 ? 1 : 0);
    return `.e${edge(x, y, x - dx, y - dy)}${edge(x + dx, y + dy, x + dx, y + dy)}`;
  }
  const m = /^(m?1)_(m?1)_(m?[0-9]+)$/.exec(name);
  if (!m) return "";
  const [sx, sy, c] = [num(m[1]!), num(m[2]!), num(m[3]!) / 32];
  let a = 0, b = 0;
  for (const Y of [-0.5, 0.5])
    if (Math.abs((c - sy * Y) / sx) <= 0.5 && nameAt(h, x, y + Math.sign(Y)).split("~").includes(`${sx > 0 ? "" : "m"}1_0_15`)) a = 1;
  for (const X of [-0.5, 0.5])
    if (Math.abs((c - sx * X) / sy) <= 0.5 && nameAt(h, x + Math.sign(X), y).split("~").includes(`0_${sy > 0 ? "" : "m"}1_15`)) b = 1;
  return `.e${a}${b}`;
}
