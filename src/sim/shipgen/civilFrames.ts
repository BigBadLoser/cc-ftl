import type { Block } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import type { Builder, Part } from './builder';
import { cargoSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Civil frames: the non-spine civil structures. Sealed cargo on beam frames (container frames, ore cages), long
 * rig booms, and the liner's wide 2D hull. The truss pieces are drawn in one builder and joined to crewed sections
 * sideways or lengthways (grafts), so a ship is no longer one corridor run.
 */

/** Stamp a solid truss rectangle. */
export const truss = (b: Builder, x: number, y: number, w: number, h: number, key: string): void => {
  if (w > 0 && h > 0) b.cv.stamp(Array.from({ length: h }, () => '='.repeat(w)), x, y, key);
};

/** A container or hold: crates on all but one row (the aisle their crates are reached from). */
const unit = (w: number, h: number): RoomSpec => ({ ...cargoSpec(w * Math.max(1, h - 1)), w, h });

export interface FrameOpts {
  /** Open rows between the two container rows: the containers hang from the rails, nothing runs between them. */
  lane: number;
  gap: number;
  cw: number;
  ch: number;
}

/**
 * Container frame: two thin crawlway rails (top and bottom) with containers slung from them, an open lane between the
 * rows (or back to back, lane 0), and a cross passage at the after end joining the rails. Ports: the cross passage's
 * east wall ('e') and ends ('n', 's'), the top rail's west end ('w').
 */
export function containerFrame(rng: Rng, crates: number, o: FrameOpts): Block {
  const b = localBuilder(rng);
  const per = o.cw * Math.max(1, o.ch - 1);
  const k = Math.max(2, Math.ceil(crates / per));
  const perRow = Math.ceil(k / 2);
  const rowH = o.ch + 2;
  const H = 3 + rowH + (o.lane > 0 ? o.lane - 1 + rowH : rowH - 2) + 2;
  const oy = -Math.round(H / 2);
  const L = o.gap + perRow * (o.cw + 1 + o.gap) + 2;
  const top = b.place({ x: 0, y: oy, w: L, h: 3 }, 'hall');
  const bot = b.place({ x: 0, y: oy + H - 3, w: L, h: 3 }, 'hall');
  const end = b.place({ x: L - 1, y: oy, w: 3, h: H }, 'hall');
  if (top && bot && end) { b.door(top, end); b.door(bot, end); }
  for (let i = 0, n = 0; i < perRow; i++) {
    const x = o.gap + i * (o.cw + 1 + o.gap);
    const t = n++ < k ? b.place({ x, y: oy + 2, w: o.cw + 2, h: rowH }, 'cargo', unit(o.cw, o.ch)) : null;
    const u = n++ < k ? b.place({ x, y: oy + H - 3 - rowH + 1, w: o.cw + 2, h: rowH }, 'cargo', unit(o.cw, o.ch)) : null;
    if (t && top) b.door(top, t);
    if (u && bot) b.door(bot, u);
  }
  return blockFrom(b, 'cargo', 'container frame', 'human', [
    { id: 'e', side: 'e', x: L + 1, y: oy + 1, len: H - 2, access: 'human' }, { id: 'w', side: 'w', x: 0, y: oy + 1, len: 1, access: 'human' },
    { id: 'n', side: 'n', x: L, y: oy, len: 1, access: 'human' }, { id: 's', side: 's', x: L, y: oy + H - 1, len: 1, access: 'human' },
  ]);
}

/**
 * Ore cage: a row of ore holds hung under a crawlway rail, truss struts between them hanging below like teeth. Ports:
 * the rail's top wall ('n', long) and its east end ('e'). Mirror it to hang the holds above the rail.
 */
export function oreCage(rng: Rng, crates: number, hw: number, hh: number, maxCols = 99): Block {
  const b = localBuilder(rng);
  const per = hw * Math.max(1, hh - 1);
  const cols = Math.max(2, Math.min(maxCols, Math.ceil(crates / per)));
  // Pitch: a hold, an open gap, a strut hanging below the holds (teeth), another gap; the gaps open downward.
  const P = hw + 5;
  const W = cols * P + 2;
  const oy = -Math.round((hh + 6) / 2);
  const rail = b.place({ x: 0, y: oy, w: W, h: 3 }, 'hall');
  for (let i = 0; i < cols; i++) {
    const x = 1 + i * P;
    const hold = b.place({ x, y: oy + 2, w: hw + 2, h: hh + 2 }, 'cargo', unit(hw, hh));
    if (hold && rail) b.door(rail, hold);
    if (i < cols - 1) truss(b, x + hw + 3, oy + 3, 1, hh + 3, `strut${i}`);
  }
  return blockFrom(b, 'cargo', 'ore cage', 'human', [
    { id: 'n', side: 'n', x: 1, y: oy, len: W - 2, access: 'human' }, { id: 'e', side: 'e', x: W - 1, y: oy + 1, len: 1, access: 'human' },
  ]);
}

/** A truss bridge `len` long (tug to barge): a crawlway tube between truss chords, ports on its ends. */
export function trussBridge(rng: Rng, len: number, chords: boolean): Block {
  const b = localBuilder(rng);
  b.place({ x: 0, y: -2, w: len, h: 3 }, 'hall');
  if (chords) {
    for (const y of [-3, 1]) for (let x = 1; x < len - 1; x++) if (x % 3 !== 0) truss(b, x, y, 1, 1, `chord${y}${x}`);
  }
  return blockFrom(b, 'beam', 'truss', 'human', [
    { id: 'w', side: 'w', x: 0, y: -1, len: 1, access: 'human' }, { id: 'e', side: 'e', x: len - 1, y: -1, len: 1, access: 'human' },
  ]);
}

/**
 * A long rig boom: a strut up from its host, a boom running `len` forward, a cross piece at the tip with `arms` arms
 * reaching on. Joins its host's north face (mirror it for the south).
 */
export function boomRig(rng: Rng, out: number, len: number, spread: number, arms: number, reach: number): Block {
  const b = localBuilder(rng);
  const x0 = reach + 1;
  truss(b, x0 + len, -out, 1, out, 'strut');
  truss(b, x0, -out, len, 1, 'boom');
  truss(b, reach, -out - spread, 1, 2 * spread + 1, 'cross');
  for (let i = 0; i < arms; i++) {
    const y = -out - spread + Math.round((i * 2 * spread) / Math.max(1, arms - 1));
    truss(b, 0, y, reach - (i % 2 === 1 ? 2 : 0), 1, `arm${i}`);
  }
  return blockFrom(b, 'beam', 'rig boom', 'external', [{ id: 's', side: 's', x: x0 + len, y: 0, len: 1, access: 'external' }]);
}

export type LinerShape = 'teardrop' | 'oval' | 'twin';

/** Outer-room depth along the hull (t = 0 bow, 1 stern) for a shape: 0..1. */
function profile(shape: LinerShape, t: number): number {
  if (shape === 'teardrop') return t < 0.3 ? 0.4 + (0.6 * t) / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
  if (shape === 'oval') return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.7);
  return 1;
}

/** Rooms of a run along a corridor wall, widths summing to exactly `len` (the last stretches). */
function fill(len: number, w: number, specs: RoomSpec[]): RoomSpec[] {
  const n = Math.max(1, Math.floor((len - 1) / (w + 1)));
  const out = Array.from({ length: n }, (_, i): RoomSpec => specs[i] ?? { role: 'quarters', mods: [], w, h: 2 });
  const used = out.reduce((t, r) => t + r.w + 1, 1);
  const last = out[out.length - 1] as RoomSpec;
  out[out.length - 1] = { ...last, w: last.w + (len - used) };
  return out;
}

/**
 * Liner hull: one wide body with cabins laid out in 2D. Two long corridors; a band of back-to-back cabins (and the
 * lounges, full depth, fore) between them; outer cabin rows whose depth follows the hull shape; cross corridors at the
 * ends. `twin`: the inner band splits along an open groove (two flat hulls joined aft), the lower hull shorter.
 */
export function linerBody(rng: Rng, beds: number, lounges: RoomSpec[], shape: LinerShape, cabin: [number, number]): Builder | null {
  const b = localBuilder(rng);
  const [cw, ch] = cabin;
  const twin = shape === 'twin';
  // Twin: an open groove row between the two hulls' inner cabins.
  const Hm = 2 * ch + 1 + (twin ? 2 : 0);
  const fore = twin ? [] : lounges;
  const lw = fore.map((r) => Math.max(3, r.w));
  const loungeRun = lw.reduce((t, w) => t + w + 1, 0) + (twin ? lounges.reduce((t, r) => t + Math.max(3, r.w) + 1, 0) : 0);
  // Inner-band cabin columns: enough that inner and outer rows together hold every bed.
  let n = 2;
  let L = 0;
  for (; n < 60; n++) {
    L = loungeRun + n * (cw + 1) + 1;
    if (2 * n + 2 * Math.floor((L - 1) / (cw + 1)) >= beds) break;
  }
  const off = twin ? rng.int(3, 6) : 0;
  const yA = -3 - Math.floor(Hm / 2);
  const bTop = yA + Hm + 3;
  const X0 = twin ? 0 : 2;
  const xe = X0 + L - 1;
  const A = b.place({ x: X0, y: yA, w: L, h: 3 }, 'hall');
  const B = b.place({ x: X0 + off, y: bTop, w: L - off, h: 3 }, 'hall');
  if (!A || !B) return null;
  const ce = b.place({ x: xe, y: yA, w: 3, h: bTop + 3 - yA }, 'hall');
  if (!ce || !b.door(A, ce) || !b.door(B, ce)) return null;
  if (!twin) {
    const cwst = b.place({ x: 0, y: yA, w: 3, h: bTop + 3 - yA }, 'hall');
    if (!cwst || !b.door(cwst, A) || !b.door(cwst, B)) return null;
  }
  let bed = beds;
  const cabinSpec = (h: number): RoomSpec => (bed-- > 0 ? { role: 'quarters', mods: ['module.bed'], w: cw, h } : { role: 'quarters', mods: [], w: cw, h });
  // Inner band: lounges fore (full depth, doored to both corridors), then back-to-back cabins.
  let x = X0;
  fore.forEach((r, i) => {
    const w = lw[i] as number;
    const p = b.place({ x, y: yA + 2, w: w + 2, h: Hm + 2 }, r.role, { ...r, w, h: Hm });
    if (p) { b.door(A, p); b.door(B, p); }
    x += w + 1;
  });
  if (twin) x += loungeRun;
  for (let i = 0; i < n; i++, x += cw + 1) {
    const top = b.place({ x, y: yA + 2, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch));
    const bot = x >= X0 + off ? b.place({ x, y: bTop - ch - 1, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch)) : null;
    if (top) b.door(A, top);
    if (bot) b.door(B, bot);
  }
  if (twin) {
    // The twin's fore inner band (where the lounges' run is) holds more cabins; its lounges ride the upper hull's top.
    for (let xi = X0; xi + cw + 1 <= X0 + loungeRun; xi += cw + 1) {
      const top = b.place({ x: xi, y: yA + 2, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch));
      if (top) b.door(A, top);
      const bot = xi >= X0 + off ? b.place({ x: xi, y: bTop - ch - 1, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch)) : null;
      if (bot) b.door(B, bot);
    }
  }
  // Outer rows follow the hull shape.
  const outer = (corr: Part, side: 'n' | 's', x0: number, len: number): void => {
    const specs = fill(len, cw, []);
    let at = x0;
    for (const s of specs) {
      const t = (at - X0 + s.w / 2) / Math.max(1, L);
      const h = Math.max(2, ch - 1 + Math.round(3 * profile(shape, t)));
      const spec = { ...cabinSpec(h), w: s.w };
      b.strip(corr, side, [spec], at);
      at += s.w + 1;
    }
  };
  if (twin) {
    // Lounges on the upper hull's top, fore.
    let at = X0;
    for (const r of lounges) { b.strip(A, 'n', [{ ...r, w: Math.max(3, r.w), h: Math.max(3, ch + 2) }], at); at += Math.max(3, r.w) + 1; }
    outer(A, 'n', at, L - (at - X0));
  } else outer(A, 'n', X0, L);
  outer(B, 's', X0 + off, L - off);
  return b;
}
