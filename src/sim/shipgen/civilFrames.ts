import type { Block } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import type { Builder, Part } from './builder';
import { cargoSpec, type RoomSpec } from './plan';
import { containerChar } from './containerCells';
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

/** Freeze an open structure (human access): no transitions fair onto it. */
const bareBlock = (b: Builder, kind: string, label: string, ports: Parameters<typeof blockFrom>[4]): Block => ({ ...blockFrom(b, kind, label, 'human', ports), bare: true });

/** A container or hold: crates on all but one row (the aisle their crates are reached from). */
const unit = (w: number, h: number): RoomSpec => ({ ...cargoSpec(w * Math.max(1, h - 1)), w, h });

export interface FrameOpts {
  /** Spine build: 0 a single beam, 1+ an open truss (two chords, ties between) the containers clamp to. */
  lane: number;
  /** Open columns of spine between neighbouring containers. */
  gap: number;
  /** The usual container on this frame, short (door) end along the spine by length out from it: 2 x 4 or 3 x 6. */
  cw: number;
  ch: number;
  /** Container bands: 1 or 2 spines, each with a row of containers on both faces. */
  bands?: number;
  /** Offset the lower row of each band by half a container (staggered stacking). */
  stagger?: boolean;
  /** The spine is a walkable crawl tube (a tug's barge: the far end is crewed) instead of beams. */
  crawl?: boolean;
  /** Chance a slot is left empty (never the first of a row). */
  missing?: number;
}

/** Stamp one container (`w` along x, `h` across) with its top-left at (x, y); false if no size fits or it clashes. */
const stampContainer = (b: Builder, x: number, y: number, w: number, h: number, key: string): boolean => {
  const ch = containerChar(w, h);
  return ch !== null && b.cv.stamp(Array.from({ length: h }, () => ch.repeat(w)), x, y, key);
};

/**
 * Container frame: a container ship's cargo section. Each band is a spine (a beam, an open truss, or a crawl tube) with
 * sealed containers clamped along both faces; a cross passage at the after end joins the spines and the crew body.
 * Containers are not rooms: they are drawn as container cells and become container modules on Beam tiles.
 * Ports: the cross passage's east wall ('e') and ends ('n', 's'); a crawl spine's west end ('w').
 */
export function containerFrame(rng: Rng, crates: number, o: FrameOpts): Block {
  const b = localBuilder(rng);
  const bands = Math.max(1, Math.min(2, o.bands ?? 1));
  // Containers clamp by their short (door) end: 2 or 3 along the spine, 4 or 6 out from it.
  const base: Box = o.cw === 2 ? [2, 4] : [3, 6];
  const other: Box = base[0] === 2 ? [3, 6] : [2, 4];
  const T = o.crawl || o.lane > 0 ? 3 : 1;
  const k = Math.max(2 * bands, Math.min(24, Math.ceil(crates / ((base[0] * base[1]) / 4))));
  const perRow = Math.ceil(k / (2 * bands));
  // Long rows mix in the other size and leave the odd slot empty, so a spine never reads as one repeated box.
  const mix = Math.min(0.45, 0.12 + 0.04 * perRow);
  const missing = Math.max(o.missing ?? 0, perRow >= 5 ? 0.1 : 0);
  const sh = o.stagger ? Math.ceil((base[0] + o.gap) / 2) : 0;
  const rows: { x: number; box: Box }[][] = [];
  let L = 0;
  for (let r = 0; r < 2 * bands; r++) {
    const row: { x: number; box: Box }[] = [];
    let x = 1 + (r % 2 === 1 ? sh : 0);
    for (let i = 0; i < perRow; i++) {
      const box = rng.chance(mix) ? other : base;
      if (!(i > 0 && rng.chance(missing))) row.push({ x, box });
      x += box[0] + o.gap;
    }
    rows.push(row);
    L = Math.max(L, x - o.gap + 2);
  }
  const D = 6;
  const pitch = 2 * D + T + 1;
  const H = bands * pitch - 1;
  const oy = -Math.round(H / 2);
  const end = b.place({ x: L - 1, y: oy, w: 3, h: H }, 'hall');
  const spineY = (band: number): number => oy + band * pitch + D;
  for (let band = 0; band < bands; band++) {
    const y = spineY(band);
    if (o.crawl) {
      const tube = b.place({ x: 0, y, w: L, h: 3 }, 'hall');
      if (tube && end) b.door(tube, end);
    } else if (T === 1) truss(b, 0, y, L - 1, 1, `spine${band}`);
    else {
      truss(b, 0, y, L - 1, 1, `chordN${band}`);
      truss(b, 0, y + 2, L - 1, 1, `chordS${band}`);
      for (let x = 0; x < L - 1; x += 4) truss(b, x, y + 1, 1, 1, `tie${band}.${x}`);
      truss(b, L - 2, y + 1, 1, 1, `tie${band}.end`);
    }
    let n = 0;
    for (const top of [true, false]) {
      let prev: { x: number; w: number; d: number } | null = null;
      for (const { x, box } of rows[2 * band + (top ? 0 : 1)] ?? []) {
        const [w, d] = box;
        if (!stampContainer(b, x, top ? y - d : y + T, w, d, `box${band}.${top ? 0 : 1}.${x}`)) continue;
        n++;
        // Cell guides: a strut from the spine out between neighbouring containers, so each box sits in a visible
        // frame instead of floating off a spine its neighbours hide.
        const g = prev ? x - (prev.x + prev.w) : 0;
        if (prev && g >= 1 && g <= 2) {
          const gd = Math.min(d, prev.d);
          truss(b, prev.x + prev.w + Math.floor((g - 1) / 2), top ? y - gd : y + T, 1, gd, `guide${band}.${top ? 0 : 1}.${x}`);
        }
        prev = { x, w, d };
      }
    }
    if (n === 0) truss(b, 1, y - 1, 1, 1, 'stub');
  }
  const ports: Parameters<typeof blockFrom>[4] = [
    { id: 'e', side: 'e', x: L + 1, y: oy + 1, len: H - 2, access: 'human' },
    { id: 'n', side: 'n', x: L, y: oy, len: 1, access: 'human' }, { id: 's', side: 's', x: L, y: oy + H - 1, len: 1, access: 'human' },
  ];
  if (o.crawl) ports.push({ id: 'w', side: 'w', x: 0, y: spineY(0) + 1, len: 1, access: 'human' });
  return bareBlock(b, 'cargo', `container frame ${bands} ${o.crawl ? 'crawl' : T === 1 ? 'beam' : 'truss'}`, ports);
}

/** A container footprint as laid on a horizontal spine: [along the spine (the short, door end), out from it]. */
type Box = [number, number];

/**
 * Ore cage: a row of ore holds hung under a crawlway rail, truss struts between them hanging below like teeth. Ports:
 * the rail's top wall ('n', long) and its east end ('e'). Mirror it to hang the holds above the rail.
 */
export interface CageOpts {
  hw: number;
  hh: number;
  /** Open columns between holds (1..4); teeth stand in gaps of 3 or more. */
  gap: number;
  /** A tooth in every `every`-th gap, `tooth` tiles below the holds. */
  every: number;
  tooth: number;
}

export function oreCage(rng: Rng, crates: number, o: CageOpts, maxCols = 99): Block {
  const b = localBuilder(rng);
  const per = o.hw * Math.max(1, o.hh - 1);
  const cols = Math.max(2, Math.min(maxCols, Math.ceil(crates / per)));
  // Pitch: a hold and its gap; teeth hang below the holds in wide gaps, so every gap opens downward.
  const P = o.hw + 2 + o.gap;
  const W = cols * P - o.gap + 2;
  const oy = -Math.round((o.hh + 4 + o.tooth) / 2);
  const rail = b.place({ x: 0, y: oy, w: W, h: 3 }, 'hall');
  for (let i = 0; i < cols; i++) {
    const x = 1 + i * P;
    const hold = b.place({ x, y: oy + 2, w: o.hw + 2, h: o.hh + 2 }, 'cargo', unit(o.hw, o.hh));
    if (hold && rail) b.door(rail, hold);
    if (i < cols - 1 && o.gap >= 3 && i % o.every === 0) truss(b, x + o.hw + 2 + Math.floor(o.gap / 2), oy + 3, 1, o.hh + 1 + o.tooth, `tooth${i}`);
  }
  return bareBlock(b, 'cargo', 'ore cage', [
    { id: 'n', side: 'n', x: 1, y: oy, len: W - 2, access: 'human' }, { id: 'e', side: 'e', x: W - 1, y: oy + 1, len: 1, access: 'human' },
  ]);
}

/**
 * A truss bridge `len` long (tug to cargo body): a crawlway tube between two truss chords `sp` rows out, open between,
 * so the gap between the craft reads. Ports on the tube's ends.
 */
export function trussBridge(rng: Rng, len: number, sp: number): Block {
  const b = localBuilder(rng);
  b.place({ x: 0, y: -2, w: len, h: 3 }, 'hall');
  if (sp > 0) {
    truss(b, 1, -3 - sp, len - 2, 1, 'chord');
    truss(b, 1, 1 + sp, len - 2, 1, 'chord');
    // Ties at the ends only (the gap between stays open).
    truss(b, 1, -2 - sp, 1, sp, 'tie');
    truss(b, len - 2, 1, 1, sp, 'tie');
  }
  return bareBlock(b, 'beam', 'truss', [
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
    // Every other arm is shorter at its tip, never at the root: it still meets the cross piece.
    truss(b, i % 2 === 1 ? 2 : 0, y, reach - (i % 2 === 1 ? 2 : 0), 1, `arm${i}`);
  }
  return { ...blockFrom(b, 'beam', 'rig boom', 'external', [{ id: 's', side: 's', x: x0 + len, y: 0, len: 1, access: 'external' }]), bare: true };
}

export type LinerShape = 'teardrop' | 'oval' | 'twin';

/** A liner outline: where it is fullest (0..1 along), how far the tail and nose fall (0..1), the depth swing, extra length. */
export interface LinerForm {
  peak: number;
  tail: number;
  nose: number;
  amp: number;
  extra: number;
}

/** Outer-room depth along the hull (t = 0 bow, 1 stern) for a shape and form: 0..1. */
function profile(shape: LinerShape, t: number, f: LinerForm): number {
  const c = Math.min(1, Math.max(0, t));
  if (shape === 'teardrop') return c < f.peak ? f.nose + ((1 - f.nose) * c) / f.peak : 1 - ((1 - f.tail) * (c - f.peak)) / (1 - f.peak);
  if (shape === 'oval') {
    const s = c < f.peak ? Math.sin((Math.PI / 2) * (c / f.peak)) : Math.sin((Math.PI / 2) * ((1 - c) / (1 - f.peak)));
    return (c < f.peak ? f.nose : f.tail) + (1 - (c < f.peak ? f.nose : f.tail)) * Math.pow(Math.max(0, s), 0.7);
  }
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
export function linerBody(rng: Rng, beds: number, lounges: RoomSpec[], shape: LinerShape, cabin: [number, number], form: LinerForm = { peak: 0.3, tail: 0, nose: 0.4, amp: 3, extra: 0 }): Builder | null {
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
  n += form.extra;
  L = loungeRun + n * (cw + 1) + 1;
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
  if (twin) {
    // Twin: each hull's inner cabin row runs its whole length (an unbroken groove between them, open at the bow).
    const row = (corr: Part, y: number, x0: number, len: number): void => {
      let at = x0;
      for (const s of fill(len, cw, [])) {
        const p = b.place({ x: at, y, w: s.w + 2, h: ch + 2 }, 'quarters', { ...cabinSpec(ch), w: s.w });
        if (p) b.door(corr, p);
        at += s.w + 1;
      }
    };
    row(A, yA + 2, X0, L);
    row(B, bTop - ch - 1, X0 + off, L - off);
  } else {
    for (let i = 0; i < n; i++, x += cw + 1) {
      const top = b.place({ x, y: yA + 2, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch));
      const bot = b.place({ x, y: bTop - ch - 1, w: cw + 2, h: ch + 2 }, 'quarters', cabinSpec(ch));
      if (top) b.door(A, top);
      if (bot) b.door(B, bot);
    }
  }
  // Outer rows follow the hull shape.
  const outer = (corr: Part, side: 'n' | 's', x0: number, len: number): void => {
    const specs = fill(len, cw, []);
    let at = x0;
    for (const s of specs) {
      const t = (at - X0 + s.w / 2) / Math.max(1, L);
      const h = Math.max(2, ch - 1 + Math.round(form.amp * profile(shape, t, form)));
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
