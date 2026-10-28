/**
 * A ship's roof battle damage as painted so far: one canvas per damaged roof tile, kept per grid across scene rebuilds
 * (a ship's scene is torn down and rebuilt whenever streamed art arrives; the paints are slow, so they outlive it).
 * A new hit (or one whose plating wore further, or one dropped from the record) repaints only the area its marks reach,
 * in a window with a pad of context round it, so tears agree across repaints; a chunk whose structure changed (a
 * breach) repaints where hits reach it, and a reloaded roof sheet repaints everything. Paints run on a worker
 * (painter.ts), one at a time per ship.
 */
import { HullHitsC } from '../../sim/combat/components';
import type { World } from '../../sim/ecs';
import type { Grid } from '../../sim/grid';
import type { Atlas, StaticSprite } from '../assets/loader';
import { pixelsOf } from '../assets/sheetPixels';
import type { ChunkRef, RegionTiles } from '../regionTiles';
import { roofCovers } from '../roofArt';
import { roofBase } from '../roofPlating';
import { reachOf, type RoofHit } from './hits';
import { paintLater } from './painter';

const HW = 32;                                  // art px: half a tile across and half a tile down (64 x 32 tiles)
const HH = 16;
const PAD = 80;                                 // art px of context round a repainted area (tears there agree)
const MAX_AREA = 1400 * 900;                    // art px: queued areas merge into one paint up to this size

/** One roof tile's overlay: its px of the paints, a box of region art px at (left, top). */
export interface DamageTile {
  x: number;
  y: number;
  left: number;
  top: number;
  img: ImageData;
  canvas: HTMLCanvasElement;
}

/** The view showing a store's tiles: told when one is made or repainted, and when one is dropped. */
export interface DamageWatcher {
  painted(idx: number, t: DamageTile): void;
  dropped(idx: number): void;
}

export interface DamageStore {
  readonly tiles: ReadonlyMap<number, DamageTile>;
  /** Show the store through this view from now on (null: none; the paints carry on, kept for the next one). */
  watch(w: DamageWatcher | null): void;
  /** Queue the repaints the ship's changes call for and start the next one (each frame its roof shows). */
  update(tiles: RegionTiles, atlas: Atlas, world: World): void;
}

/** A hit in region art px, with how far its marks reach. */
interface RegionHit extends RoofHit {
  reach: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const area = (r: Rect): number => (r.x1 - r.x0) * (r.y1 - r.y0);
const meets = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const union = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const within = (a: Rect, b: Rect): Rect => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const around = (h: RegionHit): Rect => ({ x0: h.x - h.reach, y0: h.y - h.reach, x1: h.x + h.reach, y1: h.y + h.reach });
const as32 = (a: Uint8ClampedArray): Uint32Array => new Uint32Array(a.buffer, a.byteOffset, a.length >> 2);

/** A number per roof sheet load (a reload or an eviction repaints everything; other sheets streaming do not). */
const sheetIds = new WeakMap<object, number>();
let sheetCount = 0;
const sheetId = (src: object | undefined): number => (src ? (sheetIds.get(src) ?? (sheetIds.set(src, ++sheetCount), sheetCount)) : 0);

const stores = new WeakMap<Grid, DamageStore>();

/** The grid's damage store (made on first use; it goes with the grid). */
export function damageStore(grid: Grid): DamageStore {
  let s = stores.get(grid);
  if (!s) stores.set(grid, (s = createStore(grid)));
  return s;
}

function createStore(grid: Grid): DamageStore {
  const damaged = new Map<number, DamageTile>();
  const queue: Rect[] = [];
  const structKeys = new Map<string, string>();
  let known = new Map<number, RegionHit>();
  let hits: RegionHit[] = [];
  let watcher: DamageWatcher | null = null;
  let structRev = -1;
  let sheet = -1;
  let key = '';
  let busy = false;
  let gen = 0;
  // The latest view's tiles and atlas (a paint that lands after its view is gone is written with the next one's).
  let tiles: RegionTiles;
  let atlas: Atlas;

  /** Tile (x, y)'s plating sprite and its box in region art px. */
  function frameOf(x: number, y: number): { base: StaticSprite; left: number; top: number; fw: number; fh: number } | null {
    if (!tiles.inside(x, y) || !roofCovers(tiles.kindAt, x, y)) return null;
    const found = roofBase(atlas, tiles.kindAt, x, y);
    if (!found) return null;
    const b = found.base;
    return { base: b, left: Math.round((x - y) * HW - b.ax / 2), top: Math.round((x + y) * HH - b.ay / 2), fw: Math.round(b.tex.frame.width / 2), fh: Math.round(b.tex.frame.height / 2) };
  }

  /** The tiles whose plating can fall in a box of region art px, back to front (a nearer piece overlaps a farther). */
  function* tilesIn(r: Rect): Generator<[number, number]> {
    const ux0 = Math.floor((r.x0 / HW + r.y0 / HH) / 2) - 4;
    const ux1 = Math.ceil((r.x1 / HW + r.y1 / HH) / 2) + 6;
    const vy0 = Math.floor((r.y0 / HH - r.x1 / HW) / 2) - 4;
    const vy1 = Math.ceil((r.y1 / HH - r.x0 / HW) / 2) + 6;
    for (let s = ux0 + vy0; s <= ux1 + vy1; s++) for (let x = ux0; x <= ux1; x++) if (s - x >= vy0 && s - x <= vy1) yield [x, s - x];
  }

  function regionHits(world: World): RegionHit[] {
    const list = world.get(grid.id, HullHitsC)?.hits ?? [];
    const probe = atlas.stat('roof.c0b.00');
    if (!probe) return [];
    const lift = probe.ay / 2 - probe.tex.frame.height / 4;                // (the roof plane's height over the floor)
    return list.map((h) => {
      const tx = h.x - tiles.ox;
      const ty = h.y - tiles.oy;
      const fx = tx + (h.ox + 0.5) / 16 - 0.5;
      const fy = ty + (h.oy + 0.5) / 16 - 0.5;
      const wear = tiles.inside(tx, ty) ? tiles.get('wear', tx, ty) / 255 : 0;
      return { x: (fx - fy) * HW, y: (fx + fy) * HH - lift, power: h.power, seed: h.seed, wear, reach: reachOf(h.power) };
    });
  }

  /** A chunk's box of region art px, wide enough for its tiles' plating (lifted to the roof) whatever their cut. */
  function chunkBox(c: ChunkRef): Rect {
    const r = tiles.chunkRect(c);
    return { x0: (r.x0 - r.y1) * HW - HW, x1: (r.x1 - r.y0) * HW + HW, y0: (r.x0 + r.y0) * HH - 4 * HH, y1: (r.x1 + r.y1) * HH + HH };
  }

  /** Queue a chunk's area where hits reach it. */
  function queueChunk(c: ChunkRef, list: readonly RegionHit[]): void {
    const box = chunkBox(c);
    const near = list.map(around).filter((a) => meets(box, a));
    if (near.length) queue.push(within(box, near.reduce(union)));
  }

  function refresh(world: World): void {
    const next = regionHits(world);
    const sk = sheetId(atlas.stat('roof.c0b.00')?.tex.source);
    if (sk !== sheet) {
      sheet = sk;
      reset();
      for (const c of tiles.chunks()) {
        structKeys.set(`${c.cx},${c.cy}`, tiles.key('struct', c, 1));
        queueChunk(c, next);
      }
    } else {
      const now = new Set(next.map((h) => h.seed));
      for (const h of next) {
        const was = known.get(h.seed);
        if (!was || was.wear !== h.wear) queue.push(around(h));
      }
      for (const h of known.values()) if (!now.has(h.seed)) queue.push(around(h));
      if (grid.revision('struct') !== structRev) {
        for (const c of tiles.chunks()) {
          const k = tiles.key('struct', c, 1);
          if (structKeys.get(`${c.cx},${c.cy}`) === k) continue;
          structKeys.set(`${c.cx},${c.cy}`, k);
          queueChunk(c, [...next, ...known.values()]);
        }
      }
    }
    structRev = grid.revision('struct');
    hits = next;
    known = new Map(next.map((h) => [h.seed, h]));
  }

  /** Start the next paint: the first queued area with every queued area it meets (while the paint stays small enough). */
  function pump(): void {
    if (busy || !queue.length) return;
    let r = queue.shift() as Rect;
    for (let grew = true; grew; ) {
      grew = false;
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i] as Rect;
        if (meets(r, q) && area(union(r, q)) <= MAX_AREA) {
          r = union(r, q);
          queue.splice(i, 1);
          grew = true;
        }
      }
    }
    const rr = { x0: Math.floor(r.x0), y0: Math.floor(r.y0), x1: Math.ceil(r.x1), y1: Math.ceil(r.y1) };
    const gx = rr.x0 - PAD;
    const gy = rr.y0 - PAD;
    const w = rr.x1 - rr.x0 + 2 * PAD;
    const h = rr.y1 - rr.y0 + 2 * PAD;
    const mine = hits.filter((q) => meets(rr, around(q))).map((q) => ({ ...q, x: q.x - gx, y: q.y - gy }));
    const n = w * h;
    const owner = new Int32Array(n).fill(-1);
    const roof = new Uint8Array(n);
    const plate = new Uint8ClampedArray(n * 4);
    const struct = new Uint8ClampedArray(n * 4);
    const bare = new Uint8ClampedArray(n * 4);
    for (const [x, y] of tilesIn({ x0: gx, y0: gy, x1: gx + w, y1: gy + h })) {
      const f = frameOf(x, y);
      if (!f) continue;
      const cx = (x - y) * HW - gx;
      const cy = (x + y) * HH - gy;
      blit(f.base, cx, cy, w, h, as32(plate), { roof, owner, idx: y * tiles.width + x });
      if (!mine.length) continue;
      const st = atlas.stat(`roof.struct.s.${x & 3}${y & 3}`);
      const nb = atlas.stat(`roof.struct.n.${x & 3}${y & 3}`);
      if (st) blit(st, cx, cy, w, h, as32(struct));
      if (nb) blit(nb, cx, cy, w, h, as32(bare));
    }
    if (!mine.length) {                                                 // (the last hits here dropped from the record)
      apply(rr, gx, gy, w, owner, new Uint8ClampedArray(n * 4));
      return;
    }
    busy = true;
    const at = gen;
    paintLater({ win: { w, h, gx, gy, roof }, layers: { plate, struct, bare }, hits: mine }, (out) => {
      if (at !== gen) return;
      busy = false;
      if (out) apply(rr, gx, gy, w, owner, out);
      else queue.unshift(rr);
    });
  }

  /** Write a paint's px inside r into the overlays of the tiles they belong to (making a tile's overlay when it needs one). */
  function apply(r: Rect, gx: number, gy: number, w: number, owner: Int32Array, out: Uint8ClampedArray): void {
    const o32 = as32(out);
    const at = (px: number, py: number): number => (py - gy) * w + px - gx;
    for (const [x, y] of tilesIn(r)) {
      if (!tiles.inside(x, y)) continue;                                // (an index off the grid would name another tile)
      const f = frameOf(x, y);
      const idx = y * tiles.width + x;
      let t = damaged.get(idx);
      if (t && (!f || t.left !== f.left || t.top !== f.top || t.img.width !== f.fw || t.img.height !== f.fh)) {
        damaged.delete(idx);                                            // (its plating is gone or cut differently)
        watcher?.dropped(idx);
        t = undefined;
      }
      if (!f) continue;
      const b = within(r, { x0: f.left, y0: f.top, x1: f.left + f.fw, y1: f.top + f.fh });
      if (b.x0 >= b.x1 || b.y0 >= b.y1) continue;
      if (!t) {
        let any = false;
        for (let py = b.y0; py < b.y1 && !any; py++) for (let px = b.x0; px < b.x1 && !any; px++) any = owner[at(px, py)] === idx && !!o32[at(px, py)];
        if (!any) continue;
        const canvas = Object.assign(document.createElement('canvas'), { width: f.fw, height: f.fh });
        damaged.set(idx, (t = { x, y, left: f.left, top: f.top, img: new ImageData(f.fw, f.fh), canvas }));
      }
      const d = as32(t.img.data);
      for (let py = b.y0; py < b.y1; py++) {
        const q0 = at(b.x0, py);
        const t0 = (py - t.top) * t.img.width + b.x0 - t.left;
        for (let k = 0; k < b.x1 - b.x0; k++) d[t0 + k] = owner[q0 + k] === idx ? (o32[q0 + k] as number) : 0;
      }
      t.canvas.getContext('2d')!.putImageData(t.img, 0, 0);
      watcher?.painted(idx, t);
    }
  }

  function reset(): void {
    gen++;
    busy = false;
    queue.length = 0;
    structKeys.clear();
    for (const idx of damaged.keys()) watcher?.dropped(idx);
    damaged.clear();
  }

  return {
    tiles: damaged,
    watch(w) {
      watcher = w;
    },
    update(t, a, world) {
      tiles = t;
      atlas = a;
      const list = world.get(grid.id, HullHitsC)?.hits ?? [];
      const k = `${list.length}|${list[list.length - 1]?.tick ?? 0}|${grid.revision('wear')}|${grid.revision('struct')}|${sheetId(atlas.stat('roof.c0b.00')?.tex.source)}`;
      if (k !== key) {
        key = k;
        refresh(world);
      }
      pump();
    },
  };
}

/** Copy a sprite's px (its frame from the kept sheet pixels) into a w x h window, anchored at tile centre (cx, cy); with
 * `mark`, also mark the px it covers as roof of tile `idx`. */
function blit(sp: StaticSprite, cx: number, cy: number, w: number, h: number, dst: Uint32Array, mark?: { roof: Uint8Array; owner: Int32Array; idx: number }): void {
  const src = pixelsOf(sp.tex.source);
  if (!src) return;
  const src32 = new Uint32Array(src.data.buffer, src.data.byteOffset, src.w * src.h);
  const res = sp.tex.source.pixelWidth / sp.tex.source.width;
  const fx = Math.round(sp.tex.frame.x * res);
  const fy = Math.round(sp.tex.frame.y * res);
  const fw = Math.round(sp.tex.frame.width * res);
  const fh = Math.round(sp.tex.frame.height * res);
  const ox = Math.round(cx - sp.ax / 2);
  const oy = Math.round(cy - sp.ay / 2);
  const i0 = Math.max(0, -ox);
  const i1 = Math.min(fw, w - ox);
  for (let j = Math.max(0, -oy); j < Math.min(fh, h - oy); j++) {
    const s0 = (fy + j) * src.w + fx;
    const d0 = (oy + j) * w + ox;
    for (let i = i0; i < i1; i++) {
      if ((src.data[(s0 + i) * 4 + 3] as number) < 128) continue;
      dst[d0 + i] = src32[s0 + i] as number;
      if (mark) {
        mark.roof[d0 + i] = 1;
        mark.owner[d0 + i] = mark.idx;
      }
    }
  }
}
