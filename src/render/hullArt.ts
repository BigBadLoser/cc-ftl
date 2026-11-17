import type { World } from "../sim/ecs";
import type { Grid } from "../sim/grid";
import { ModuleC } from "../sim/modules/components";
import { hullRow } from "../sim/modules/footprint";
import type { ModuleDef } from "../sim/registry";
import { Struct } from "../sim/structure";
import { windowPiece, type WindowTile } from "../sim/windows";
import { hullKey, hullKeyGeneric, hullKeyName, hullOutline, type Front } from "./hullKey";
import { engineBlock } from "./moduleArt";
import { motifColours, SCHEMES } from "./roofArt";
import { tileHash, type KindAt } from "./tiles";

/**
 * The hull from outside and its belly (the `hull` sprite family, tools/blender/sprites/hulltiles.py), picked per tile by
 * its hull key (hullKey.ts). A tile whose key has no art keeps the old hull art (the caller's fallback): the catalog
 * covers the outlines ships are built to (3 tiles wide at least), damage and odd shapes can make others.
 */

/** The ship's tiles: the outline runs round them. */
const shipTile = (k: number) => k === Struct.Floor || k === Struct.Wall || k === Struct.Door;
/** Tiles that make a region a base in rock, not a ship: no exterior hull there. */
// MOCK (#524): levelled ground (a prefab base's site) no longer blocks the hull: the base stands on it in the station hull.
const rocky = (k: number) => k === Struct.Rock || k === Struct.RockWall;

/** The belly's bay looks (wall3d_belly_run), plain first; a tile takes one by `tileLook`. */
export const BELLY_LOOKS = [20, 21, 22, 26, 27, 28] as const;

export interface HullKeys {
  /** The tile's hull key, "" for none (region-local). */
  at(x: number, y: number): string;
  ship(x: number, y: number): boolean;
  /** MOCK (#524): the region stands on levelled ground (a prefab base): the station hull, no belly. */
  ground?: boolean;
}

/** The hull keys of a W x H region, or null if it is not a ship (rock round it, or no ship tiles). */
export function hullKeys(kindAt: KindAt, W: number, H: number): HullKeys | null {
  const tiles: [number, number][] = [];
  let ground = false;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = kindAt(x, y);
      if (rocky(k)) return null;
      if (k === Struct.Ground) ground = true;
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
  return { at: (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? (keys.get(y * W + x) ?? "") : ""), ship, ground };
}

const memo = new WeakMap<Grid, { rev: number; keys: HullKeys | null }>();

/** `hullKeys` of a grid's region, kept until its struct changes (the tile and roof views share it). */
export function gridHullKeys(grid: Grid, kindAt: KindAt, W: number, H: number): HullKeys | null {
  const rev = grid.revision("struct");
  const m = memo.get(grid);
  if (m && m.rev === rev) return m.keys;
  const keys = hullKeys(kindAt, W, H);
  // MOCK (#524): the region's tile art sees asteroid ground as space (regionTiles.kindAt), so look at the grid itself.
  if (keys && !keys.ground) {
    scan: for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (grid.inBounds(grid.x0 + x, grid.y0 + y) && grid.get("struct", grid.x0 + x, grid.y0 + y) === Struct.Ground) { keys.ground = true; break scan; }
  }
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
 * The exterior piece of a window tile on a straight near run (w1 the lower-coordinate end, w3 the higher, w2 the middles), or null for
 * any other tile or window (a corner, a far run, art missing): those keep their other pieces. `win` must match the run's axis.
 */
export function windowExteriorId(h: HullKeys, x: number, y: number, has: (id: string) => boolean, win: WindowTile | null): string | null {
  const k = h.at(x, y);
  if (!win || !k || hullKeyGeneric(k)) return null;
  const id = runSetId(h, x, y);
  if (!STRAIGHT.has(id) || id !== (win.axis === "x" ? "tile.hull.ext.o1.m10" : "tile.hull.ext.o2.m5")) return null;
  const w = `${id}.w${{ l: 1, m: 2, r: 3 }[windowPiece(win)]}`;
  return has(w) ? w : null;
}

/**
 * The exterior sprites of a hull tile (the ship roofed), back to front: a near run or corner the run set's piece (a
 * straight run in one of its designs), anything else the generic piece and its roof over the rest of the tile. Null
 * for no key (plain roof) or no art. `win`: the tile's window (sim/windows.ts), drawn instead of the design on a straight near run.
 */
export function exteriorIds(h: HullKeys, x: number, y: number, has: (id: string) => boolean, base = false, win: WindowTile | null = null): string[] | null {
  if (h.ground) {
    // MOCK (#524): the station look's piece where it has one (tile.hull.station.ext.*, tile.roof.station.g.*), else the ship's.
    const st = (id: string) => id.replace("tile.hull.ext.", "tile.hull.station.ext.").replace("tile.roof.g.", "tile.roof.station.g.");
    const ids = shipExteriorIds(h, x, y, (id) => has(st(id)), base, win);
    if (ids) return ids.map(st);
  }
  return shipExteriorIds(h, x, y, has, base, win);
}

function shipExteriorIds(h: HullKeys, x: number, y: number, has: (id: string) => boolean, base = false, win: WindowTile | null = null): string[] | null {
  const k = h.at(x, y);
  if (!k) return null;
  if (!hullKeyGeneric(k)) {
    const id = runSetId(h, x, y);
    // A window tile of a straight near run: its window piece, else the design pick.
    const w = base ? null : windowExteriorId(h, x, y, has, win);
    if (w) return [w];
    const v = STRAIGHT.has(id) && !base ? ["", ".a1", ".a2", ".a3"][pickDesign(x, y, 4, 1)] : "";
    for (const c of [id + v, id]) if (has(c)) return [c];
  }
  const n = hullKeyName(k);
  return has(`tile.hull.ext.g.${n}`) ? [`tile.hull.ext.g.${n}`, `tile.roof.g.${n}`].filter(has) : null;
}

/** MOCK (#524): the rock berm heaped against a ground base's station hull on this tile, or null. */
export function bermId(h: HullKeys, x: number, y: number, has: (id: string) => boolean): string | null {
  const k = h.ground ? h.at(x, y) : "";
  if (!k) return null;
  const name = hullKeyName(k);
  const hash = (a: number, b: number, salt: number) => tileHash(a + salt * 7919, b - salt * 104729) >>> 8;
  const nameAt = (ax: number, ay: number) => { const n = h.at(ax, ay); return n ? hullKeyName(n) : ""; };
  // a straight run (one front along x or y): station_berm.RUN variants, 0-3 with a rock clump on one tile in every three
  // along it, 4-7 bare, an even tile taking from one half of each set and an odd one from the other (no two neighbours
  // alike); its two tile boundaries a heap or not (1 in 10 x 4), only between two tiles of the same run
  const run = /^(0_m?1|m?1_0)_[0-9]+$/.test(name) ? (name.startsWith("0_") ? "x" : "y") : null;
  if (run) {
    const [u, l] = run === "x" ? [x, y] : [y, x];
    const cell = Math.floor(u / 3);
    const rocky = u - 3 * cell === hash(cell, l, 7) % 3;
    const v = (rocky ? 0 : 4) + (u & 1 ? 2 : 0) + (hash(x, y, 3) % 2);
    const [dx, dy] = run === "x" ? [1, 0] : [0, 1];
    const edge = (bx: number, by: number, ox: number, oy: number, salt: number) =>
      nameAt(ox, oy) === name && hash(bx, by, salt) % 10 < 4 ? 1 : 0;
    const salt = run === "x" ? 5 : 6;
    const ends = `.e${edge(x, y, x - dx, y - dy, salt)}${edge(x + dx, y + dy, x + dx, y + dy, salt)}`;
    const id = `tile.hull.station.berm.${name}.v${v}${ends}`;
    return has(id) ? id : null;
  }
  const v = hash(x, y, 3) % 3;
  // a single diagonal front: where it meets a straight wall at the tile's edge the drift turns the corner with it
  // (station_berm._turns: e<top or bottom vertex><side vertex>, 1 where the neighbour across it has that wall)
  const m = /^(m?1)_(m?1)_(m?[0-9]+)$/.exec(name);
  let ends = "";
  if (m) {
    const num = (t: string) => (t.startsWith("m") ? -Number(t.slice(1)) : Number(t));
    const [sx, sy, c] = [num(m[1]!), num(m[2]!), num(m[3]!) / 32];
    let e0 = 0, e1 = 0;
    for (const Y of [-0.5, 0.5]) {
      const vx = (c - sy * Y) / sx;
      if (Math.abs(vx) <= 0.5 && nameAt(x, y + Math.sign(Y)).split("~").includes(`${sx > 0 ? "" : "m"}1_0_15`)) e0 = 1;
    }
    for (const X of [-0.5, 0.5]) {
      const vy = (c - sx * X) / sy;
      if (Math.abs(vy) <= 0.5 && nameAt(x + Math.sign(X), y).split("~").includes(`0_${sy > 0 ? "" : "m"}1_15`)) e1 = 1;
    }
    ends = `.e${e0}${e1}`;
  }
  const id = `tile.hull.station.berm.${name}.v${v}${ends}`;
  return has(id) ? id : null;
}

/** The bay look a tile's belly takes. */
export const tileLook = (x: number, y: number) => BELLY_LOOKS[pickDesign(x, y, BELLY_LOOKS.length, 2)]!;

/**
 * The belly sprites of a tile: below the deck (`under`) and its cut top over it (`low`, cutaway views), in the tile's
 * look where that differs from the plain one. A near hull wall or door (`hull`) whose key has no art takes the catch-all
 * (`fallbackBelly`); a floor never does (its edge on a breach has no belly). Null if the tile shows no belly.
 */
export function bellyIds(h: HullKeys, x: number, y: number, has: (id: string) => boolean, hull = false): { under?: string; low?: string } | null {
  if (h.ground) return null; // MOCK (#524): on the ground, no belly
  if (!h.ship(x, y)) return null;
  const k = h.at(x, y);
  return (k ? keyBelly(hullKeyName(k), x, y, has) : null) ?? (hull ? keyBelly(fallbackBelly(h, x, y), x, y, has) : null);
}

/** The belly pieces of key name `n` in the tile's look, or null if the art has neither. */
function keyBelly(n: string | undefined, x: number, y: number, has: (id: string) => boolean): { under?: string; low?: string } | null {
  if (!n) return null;
  const look = tileLook(x, y);
  const pick = (layer: string) => {
    const base = `tile.hull.belly.${layer}.${n}`;
    return look !== BELLY_LOOKS[0] && has(`${base}.l${look}`) ? `${base}.l${look}` : has(base) ? base : undefined;
  };
  const under = pick("under");
  const low = pick("low");
  return under || low ? { under, low } : null;
}

/**
 * The catch-all belly of a tile whose key the catalog has no art for, or that has none (outlines thinner than ships are
 * built to: damage, wrecks):
 * the straight run's or the convex corner's, by which way the tile faces space toward the camera, so it never falls
 * back to the old hull's belly. Undefined where no belly shows (space toward the camera on neither side).
 */
function fallbackBelly(h: HullKeys, x: number, y: number): string | undefined {
  const o = (h.ship(x, y + 1) ? 0 : 1) | (h.ship(x + 1, y) ? 0 : 2);
  return o ? FALLBACK_BELLY[o] : undefined;
}
const FALLBACK_BELLY: Record<number, string> = { 1: hullKeyName("0,1,15"), 2: hullKeyName("1,0,15"), 3: hullKeyName("1,0,15;0,1,15") };

/** A ship's hull colours, multiplied over its hull pieces: the armour over the piece, the deco over its deco layer. */
export interface HullPaint {
  armour: number;
  deco: number;
  /** The ship's carpet paint (`carpetPaintFor`); absent (a debug override) = the plain ship's. */
  carpet?: number;
  /** The walkway line's paint (deck marks, deckMarks.ts): absent = cream. A faction or district colour goes here. */
  walkway?: number;
}



/** The roof plating's own blue (palette_extra cB1): the main colour of a roof without a coat. */
const PLATE_BLUE = 0x4a6788;
/** The armour (seams, belly, under-armour) is the main colour this dark. */
const ARMOUR_SHADE = 0.55;

const shade = (c: number, k: number): number => [16, 8, 0].reduce((out, sh) => out | (Math.round(((c >> sh) & 255) * k) << sh), 0);

/** The carpet's lightness (HLS) and the saturation it is capped at: a calm, dark floor whatever the livery. */
const CARPET_LIGHTNESS = 0.3;
const CARPET_SATURATION = 0.45;
/** Below this saturation the livery colour counts as grey (black, white, steel) and the carpet is a plain grey. */
const CARPET_GREY_BELOW = 0.12;

/**
 * A ship's carpet paint from its roof livery: the scheme's main colour P (SCHEMES, any scheme, coat or not), muted. The
 * hue of P is kept, the lightness is fixed at CARPET_LIGHTNESS and the saturation capped at CARPET_SATURATION; a P with
 * less saturation than CARPET_GREY_BELOW gives a grey. No livery: the roof plating's blue, muted like the rest. The art is
 * recoloured by the hull-paint step with its own reference tone (carpetPaint.ts), so its mid tone lands on this colour.
 */
export function carpetPaintFor(scheme: string): number {
  const p = SCHEMES[scheme]?.P ?? PLATE_BLUE;
  const [r, g, b] = [16, 8, 0].map((sh) => ((p >> sh) & 255) / 255) as [number, number, number];
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const l = (hi + lo) / 2;
  const d = hi - lo;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : hi === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  const sat = s < CARPET_GREY_BELOW ? 0 : Math.min(s, CARPET_SATURATION);
  const c = (1 - Math.abs(2 * CARPET_LIGHTNESS - 1)) * sat;
  const ch = (n: number): number => {
    const k = (n + h * 12) % 12;
    return CARPET_LIGHTNESS - (c / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [ch(0), ch(8), ch(4)].reduce((out, v) => (out << 8) | Math.round(v * 255), 0);
}

/**
 * A ship's hull paint from its roof livery: the deco takes the roof's main colour (a faction scheme's coat, else the
 * plating's blue), the armour a dark tone of it. The pieces are recoloured with it (hullPaint.ts), their mid faces
 * landing on the roof's colour.
 */
export function hullPaintFor(scheme: string): HullPaint {
  const main = SCHEMES[scheme]?.motifs.includes("coat") ? motifColours(scheme, "coat")[0] : PLATE_BLUE;
  return { armour: shade(main, ARMOUR_SHADE), deco: main, carpet: carpetPaintFor(scheme) };
}

/** A ship without a livery: the plating's blue. */
export const PLAIN_PAINT: HullPaint = hullPaintFor("");

/** `?hullPaint=<armour hex>,<deco hex>` (debug): every ship painted so, e.g. `377d87,6ed7cd`. */
export function hullPaintParam(search: string): HullPaint | null {
  const v = new URLSearchParams(search).get("hullPaint");
  const m = v?.match(/^([0-9a-f]{6}),([0-9a-f]{6})$/i);
  return m ? { armour: parseInt(m[1]!, 16), deco: parseInt(m[2]!, 16) } : null;
}

/**
 * Hull tiles an engine's bulkhead stands on: its hull row's inner tiles (the two end tiles keep their hull wall, the
 * sprite stops inside them). Global tiles; `inside` limits the engines to one region. `block`: the engine stands behind
 * the hull's thruster block (`engineBlock`), its own hull sprite there in every view without a roof.
 */
export function engineHullTiles(world: World, defs: Readonly<Record<string, ModuleDef>>, inside: (x: number, y: number) => boolean): { x: number; y: number; block: boolean }[] {
  const out: { x: number; y: number; block: boolean }[] = [];
  for (const id of world.query(ModuleC)) {
    const m = world.get(id, ModuleC);
    const def = m && defs[m.def];
    if (!m || !def?.hullEdge || !inside(m.x, m.y)) continue;
    const row = hullRow(def, m.x, m.y, m.rot).sort((a, b) => a.x + a.y - (b.x + b.y));
    const block = engineBlock(def, m.rot);
    out.push(...row.slice(1, -1).map((t) => ({ ...t, block })));
  }
  return out;
}

