import type { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import { hullKey, hullKeyGeneric, hullKeyName, hullOutline, type Front } from "./hullKey";
import { tileHash, type KindAt } from "./tiles";

/**
 * The hull from outside and its belly (the `hull` sprite family, tools/blender/sprites/hulltiles.py), picked per tile by
 * its hull key (hullKey.ts). A tile whose key has no art keeps the old hull art (the caller's fallback): the catalog
 * covers the outlines ships are built to (3 tiles wide at least), damage and odd shapes can make others.
 */

/** The ship's tiles: the outline runs round them. */
const shipTile = (k: number) => k === Struct.Floor || k === Struct.Wall || k === Struct.Door;
/** Tiles that make a region a base in rock, not a ship: no exterior hull there. */
const rocky = (k: number) => k === Struct.Rock || k === Struct.Ground || k === Struct.RockWall;

/** The belly's bay looks (wall3d_belly_run), plain first; a tile takes one by `tileLook`. */
export const BELLY_LOOKS = [20, 21, 22, 26, 27, 28] as const;

export interface HullKeys {
  /** The tile's hull key, "" for none (region-local). */
  at(x: number, y: number): string;
  ship(x: number, y: number): boolean;
}

/** The hull keys of a W x H region, or null if it is not a ship (rock round it, or no ship tiles). */
export function hullKeys(kindAt: KindAt, W: number, H: number): HullKeys | null {
  const tiles: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = kindAt(x, y);
      if (rocky(k)) return null;
      if (shipTile(k)) tiles.push([x, y]);
    }
  if (!tiles.length) return null;
  const loops: Front[][] = hullOutline(tiles);
  const keys = new Map<number, string>();
  for (const [x, y] of tiles) {
    const k = hullKey(loops, x, y);
    if (k) keys.set(y * W + x, k);
  }
  const ship = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && shipTile(kindAt(x, y));
  return { at: (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? (keys.get(y * W + x) ?? "") : ""), ship };
}

const memo = new WeakMap<Grid, { rev: number; keys: HullKeys | null }>();

/** `hullKeys` of a grid's region, kept until its struct changes (the tile and roof views share it). */
export function gridHullKeys(grid: Grid, kindAt: KindAt, W: number, H: number): HullKeys | null {
  const rev = grid.revision("struct");
  const m = memo.get(grid);
  if (m && m.rev === rev) return m.keys;
  const keys = hullKeys(kindAt, W, H);
  memo.set(grid, { rev, keys });
  return keys;
}

/** The straight runs, drawn in one of their designs (.a1 .. .a3) by a hash of the tile. */
const STRAIGHT = new Set(["tile.hull.ext.o1.m10", "tile.hull.ext.o2.m5"]);

/** A run set piece's id (wall3d_ext: near runs and corners by the hull ring's neighbour mask and the open sides). */
function runSetId(h: HullKeys, x: number, y: number): string {
  const ring = (i: number, j: number) => {
    if (!h.ship(i, j)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!h.ship(i + dx, j + dy)) return true;
    return false;
  };
  const m = (ring(x, y - 1) ? 1 : 0) | (ring(x + 1, y) ? 2 : 0) | (ring(x, y + 1) ? 4 : 0) | (ring(x - 1, y) ? 8 : 0);
  const ox = !h.ship(x + 1, y);
  const oy = !h.ship(x, y + 1);
  return `tile.hull.ext.${ox && oy ? "o3" : oy ? "o1" : "o2"}.m${m}`;
}

/**
 * Which of n designs a tile takes (0 the default): the default on half the tiles, one of the others, alike, on
 * the rest; by a hash of the tile (`salt` keeps the exterior's and the belly's picks apart).
 */
export function pickDesign(x: number, y: number, n: number, salt: number): number {
  const h = tileHash(x + salt * 7919, y - salt * 104729);
  return n < 2 || h % 2 === 0 ? 0 : 1 + ((h >>> 8) % (n - 1));
}

/**
 * The exterior sprites of a hull tile (the ship roofed), back to front: a near run or corner the run set's piece (a
 * straight run in one of its designs), anything else the generic piece and its roof over the rest of the tile. Null
 * for no key (plain roof) or no art.
 */
export function exteriorIds(h: HullKeys, x: number, y: number, has: (id: string) => boolean): string[] | null {
  const k = h.at(x, y);
  if (!k) return null;
  if (!hullKeyGeneric(k)) {
    const id = runSetId(h, x, y);
    const v = STRAIGHT.has(id) ? ["", ".a1", ".a2", ".a3"][pickDesign(x, y, 4, 1)] : "";
    for (const c of [id + v, id]) if (has(c)) return [c];
  }
  const n = hullKeyName(k);
  return has(`tile.hull.ext.g.${n}`) ? [`tile.hull.ext.g.${n}`, `tile.roof.g.${n}`].filter(has) : null;
}

/** The bay look a tile's belly takes. */
export const tileLook = (x: number, y: number) => BELLY_LOOKS[pickDesign(x, y, BELLY_LOOKS.length, 2)]!;

/**
 * The belly sprites of a tile: below the deck (`under`) and its cut top over it (`low`, cutaway views), in the tile's
 * look where that differs from the plain one. Null if the key has neither.
 */
export function bellyIds(h: HullKeys, x: number, y: number, has: (id: string) => boolean): { under?: string; low?: string } | null {
  const k = h.at(x, y);
  if (!k) return null;
  const n = hullKeyName(k);
  const look = tileLook(x, y);
  const pick = (layer: string) => {
    const base = `tile.hull.belly.${layer}.${n}`;
    return look !== BELLY_LOOKS[0] && has(`${base}.l${look}`) ? `${base}.l${look}` : has(base) ? base : undefined;
  };
  const under = pick("under");
  const low = pick("low");
  return under || low ? { under, low } : null;
}

/** A ship's hull colours, multiplied over its hull pieces: the armour over the piece, the deco over its deco layer. */
export interface HullPaint {
  armour: number;
  deco: number;
}

/** Unpainted: the art's own colours. */
export const PLAIN_PAINT: HullPaint = { armour: 0xffffff, deco: 0xffffff };

/** `?hullPaint=<armour hex>,<deco hex>` (debug): every ship painted so, e.g. `377d87,6ed7cd`. */
export function hullPaintParam(search: string): HullPaint | null {
  const v = new URLSearchParams(search).get("hullPaint");
  const m = v?.match(/^([0-9a-f]{6}),([0-9a-f]{6})$/i);
  return m ? { armour: parseInt(m[1]!, 16), deco: parseInt(m[2]!, 16) } : null;
}
