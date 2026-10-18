/**
 * Roof art rules, ported from the Blender pipeline (pure, no Pixi). Keep in sync with
 * tools/blender/sprites/roof_layout.py (module rule), roof_variants.py (patch and inset plates) and roof_livery.py
 * (livery plan and schemes); the sprite ids are listed in roofs.py (production set).
 */
import { Struct } from '../sim/structure';
import { outward, touchesSpace, wallMask, type KindAt } from './tiles';

/** Python's roof_layout._h: a 32-bit multiplicative hash of small ints. */
export function rhash(...v: number[]): number {
  let x = 0x9e3779b1;
  for (const a of v) {
    x = Math.imul((x ^ a) >>> 0, 0x85ebca6b) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
  }
  return x;
}

/** Module size in tiles. */
export const M = 4;
type Plate = readonly [x0: number, y0: number, w: number, h: number];
/** Plates per layout (tile units), roof_layout.LAYOUTS (tone and feature dropped). */
const LAYOUTS: readonly (readonly Plate[])[] = [
  [[0, 0, 4, 2], [0, 2, 2, 2], [2, 2, 2, 2]],
  [[0, 0, 2, 4], [2, 0, 2, 2], [2, 2, 2, 2]],
  [[0, 0, 4, 1], [0, 1, 2, 3], [2, 1, 2, 3]],
  [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 4, 2]],
];
const PATCH = [2, 1, 0, 1];
const INSET = [1, 2, 2, 0];

export const moduleLayout = (mx: number, my: number): number => rhash(mx, my, 7) % LAYOUTS.length;

/** Colour courses: blue-grey bands of 1-3 module columns between 1-module ochre bands. */
export function moduleColour(mx: number): 'o' | 'b' {
  let x0 = 0;
  for (let k = 0; ; k++) {
    const col = k % 2 === 0 ? 'b' : 'o';
    const w = col === 'b' ? 1 + (rhash(k, 11) % 3) : 1;
    if (mx < x0 + w) return col;
    x0 += w;
  }
}

const onPlate = (p: Plate | undefined, u: number, v: number): boolean => !!p && p[0] <= u && u < p[0] + p[2] && p[1] <= v && v < p[1] + p[3];
const plateIndex = (L: number, u: number, v: number): number => (LAYOUTS[L] ?? []).findIndex((p) => onPlate(p, u, v));

/** Base sprite id of roof tile (x, y) and its colour family. */
export function roofTile(x: number, y: number): { id: string; col: 'o' | 'b' } {
  const mx = Math.floor(x / M);
  const my = Math.floor(y / M);
  const u = x - mx * M;
  const v = y - my * M;
  const L = moduleLayout(mx, my);
  const col = moduleColour(mx);
  const base = `roof.c${L}${col}.${u}${v}`;
  const p = plateIndex(L, u, v);
  if (rhash(mx, my, 13) % 3 !== 0 && p === INSET[L]) return { id: `${base}.inset`, col };
  if ((mx + 2 * my) % 3 === 0 && p === PATCH[L]) return { id: `${base}.patch`, col };
  return { id: base, col };
}

/** Luminance (0..1) of each colour family's top plate tone (palette_extra cO1 / cB1), the reference of the relief hint. */
export const FAMILY_LUM = { o: lum(0xb48a38), b: lum(0x4a6788) };
/** roof_livery recolour model constants. */
export const RELIEF = { dark: 0.4, light: 1.2, kDark: 0.1, kLight: 0.08 };

export function lum(hex: number): number {
  return (0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255)) / 255;
}

interface Scheme {
  motifs: readonly string[];
  P: number;
  S: number;
  T?: number;
  remap?: Readonly<Record<string, readonly ['P' | 'S' | 'T', 'P' | 'S' | 'T']>>;
}
/** roof_livery.SCHEMES. */
export const SCHEMES: Readonly<Record<string, Scheme>> = {
  crimson: { motifs: ['stripe', 'chev', 'reg'], P: 0xb0443a, S: 0xe2ddd0 },
  ivory: { motifs: ['saddle', 'pinp', 'em.dot'], P: 0xdcd8cc, S: 0x25272d },
  tide: { motifs: ['aft', 'saddle', 'em.delta', 'reg'], P: 0x2f8f8a, S: 0xe2ddd0 },
  sovereign: { motifs: ['stripe', 'em.cross', 'reg'], P: 0x26282e, S: 0xe0b23e },
  orchid: { motifs: ['aft', 'pins', 'chev', 'reg'], P: 0x74509e, S: 0xc3c8d2 },
  hornet: { motifs: ['dbl', 'nose', 'big'], P: 0xd9822b, S: 0x25272d },
  glacier: { motifs: ['split', 'arrow', 'sten'], P: 0xaebdcb, S: 0x1d2a44, remap: { arrow: ['S', 'P'] } },
  verdant: { motifs: ['bars', 'arrow', 'em.star', 'sten'], P: 0x4f9a4a, S: 0xe2ddd0 },
  ember: { motifs: ['nose', 'bars', 'em.diamond', 'big'], P: 0x26282e, S: 0xd9822b },
  tricolour: {
    motifs: ['split', 'dbl', 'em.star', 'big', 'sten'], P: 0x24324f, S: 0xe2ddd0, T: 0xb0443a,
    remap: { dbl: ['T', 'S'], 'em.star': ['T', 'S'], big: ['T', 'S'] },
  },
};
export const SCHEME_NAMES = Object.keys(SCHEMES);

/** Paint colours (P and S channel) of a motif in a scheme. */
export function motifColours(scheme: string, motif: string): [number, number] {
  const sc = SCHEMES[scheme] as Scheme;
  const [a, b] = sc.remap?.[motif] ?? ['P', 'S'];
  return [sc[a] ?? sc.P, sc[b] ?? sc.S];
}

/** String hash for picking a ship's livery (FNV-1a). */
function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Deterministic livery of a ship from its faction and name: scheme, registry seed and which end the bow motifs take. */
export function liveryFor(faction: string, name: string): { scheme: string; seed: number; bowWest: boolean } {
  const h = strHash(`${faction}:${name}`);
  return { scheme: SCHEME_NAMES[h % SCHEME_NAMES.length] as string, seed: h % 1000, bowWest: ((h >>> 11) & 1) === 1 };
}

/** Text masks (registry digits, stencils): never mirrored, so they stay readable; only their placement mirrors. */
const isText = (mask: string): boolean => mask.startsWith('reg.') || mask.startsWith('big.') || mask.startsWith('sten.');

/** Python's round(): halves go to the even neighbour. */
function pyRound(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
}

/** One painted mask on a tile: the mask id (`roof.lv.<mask>`) and the motif it belongs to (for its colours). */
export interface Paint {
  mask: string;
  motif: string;
}

/**
 * roof_livery.plan: the masks per roof tile, bottom first, for a ship (long axis x, bow +x). `solid(x, y)` = roofed
 * tile, `has(mask)` = the mask exists (empty masks are not built).
 */
export function liveryPlan(width: number, height: number, solid: (x: number, y: number) => boolean, scheme: string, seed: number,
  has: (mask: string) => boolean, bowWest = false): Map<string, Paint[]> {
  return bowWest ? mirrorPlan(width, height, solid, scheme, seed, has) : planBowEast(width, height, solid, scheme, seed, has);
}

/**
 * The plan with the bow at -x: the plan of the x-mirrored outline, mapped back. Direction-dependent masks use their
 * mirrored sprites (`<mask>.m`, roof_livery.MIRROR; a mask without one is symmetric); each text block keeps its
 * left-to-right reading order on its mirrored tiles.
 */
function mirrorPlan(width: number, height: number, solid: (x: number, y: number) => boolean, scheme: string, seed: number,
  has: (mask: string) => boolean): Map<string, Paint[]> {
  const src = planBowEast(width, height, (x, y) => solid(width - 1 - x, y), scheme, seed, has);
  const out = new Map<string, Paint[]>();
  const text = new Map<string, { xp: number; mask: string; paint: Paint }[]>();
  for (const [key, list] of src) {
    const [xp, y] = key.split(',').map(Number) as [number, number];
    const x = width - 1 - xp;
    const paints = list.map((q) => {
      const paint = { mask: isText(q.mask) || !has(`${q.mask}.m`) ? q.mask : `${q.mask}.m`, motif: q.motif };
      if (isText(q.mask)) {
        const g = text.get(`${q.motif}|${y}`) ?? [];
        g.push({ xp, mask: q.mask, paint });
        text.set(`${q.motif}|${y}`, g);
      }
      return paint;
    });
    out.set(`${x},${y}`, paints);
  }
  for (const g of text.values()) {
    const masks = [...g].sort((a, b) => a.xp - b.xp).map((e) => e.mask);
    [...g].sort((a, b) => b.xp - a.xp).forEach((e, i) => (e.paint.mask = masks[i] as string));
  }
  return out;
}

function planBowEast(width: number, height: number, solid: (x: number, y: number) => boolean, scheme: string, seed: number,
  has: (mask: string) => boolean): Map<string, Paint[]> {
  const out = new Map<string, Paint[]>();
  const sc = SCHEMES[scheme];
  if (!sc) return out;
  const S = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && solid(x, y);
  const rows: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (S(x, y)) { rows.push(y); break; }
  if (!rows.length) return out;
  const yc = Math.floor(((rows[0] as number) + (rows[rows.length - 1] as number) + 2) / 2);
  const spine: number[] = [];
  for (let x = 0; x < width; x++) if (S(x, yc - 1) && S(x, yc)) spine.push(x);
  if (!spine.length) return out;
  const xs = spine[0] as number;
  const xb = spine[spine.length - 1] as number;
  const L = xb - xs + 1;
  const mot = sc.motifs;
  for (const m of mot) {
    const add = (x: number, y: number, k: string) => {
      if (!S(x, y) || !has(k)) return;
      const key = `${x},${y}`;
      const list = out.get(key) ?? [];
      list.push({ mask: k, motif: m });
      out.set(key, list);
    };
    if (m === 'aft') {
      for (let k = 0; k < 3; k++) for (let y = 0; y < height; y++) add(xs + k, y, `aft.${k}`);
    } else if (m === 'bars') {
      for (let k = 0; k < 3; k++) for (let y = 0; y < height; y++) add(xs + k, y, 'bar');
    } else if (m === 'saddle') {
      const x0 = xs + pyRound(0.38 * L);
      for (let y = 0; y < height; y++) {
        add(x0, y, 'saddle.w');
        add(x0 + 1, y, 'saddle.e');
      }
    } else if (m === 'nose') {
      for (let y = 0; y < height; y++) {
        add(xb - 1, y, 'saddle.w');
        for (let x = xb; x < width; x++) add(x, y, 'full.P');
      }
    } else if (m === 'split') {
      for (let y = 0; y < yc - 1; y++) for (let x = 0; x < width; x++) add(x, y, 'full.P');
      for (let x = 0; x < width; x++) add(x, yc - 1, 'half.n');
    } else if (m === 'stripe' || m === 'pins' || m === 'pinp' || m === 'dbl') {
      const end = mot.includes('chev') ? xb - 2 : xb;
      const name = m === 'pins' ? 'pin' : m;
      for (let x = xs; x <= end; x++) {
        add(x, yc - 1, `${name}.n`);
        add(x, yc, `${name}.s`);
      }
    } else if (m === 'chev') {
      for (const x of [xb - 1, xb]) {
        add(x, yc - 1, 'chev.n');
        add(x, yc, 'chev.s');
      }
    } else if (m === 'arrow') {
      const xh = xs + pyRound(0.45 * L);
      for (let x = xs + 2; x < xh; x++) {
        add(x, yc - 1, 'shaft.n');
        add(x, yc, 'shaft.s');
      }
      for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 4; qy++) add(xh + qx, yc - 2 + qy, `arr.${qx}.${qy}`);
    } else if (m.startsWith('em.')) {
      const ye = yc - 2;
      const x0 = xs + pyRound(0.62 * L);
      const quad = (xe: number) => [0, 1, 2, 3].map((q) => [xe - 1 + (q % 2), ye - 1 + Math.floor(q / 2)] as const);
      const d = [0, -1, 1, -2, 2, -3, 3].find((dd) => quad(x0 + dd).every(([x, y]) => S(x, y)));
      const xe = x0 + (d ?? 0);
      quad(xe).forEach(([x, y], q) => add(x, y, `${m}.${q}`));
    } else if (m === 'reg' || m === 'big') {
      const num = String(100 + (rhash(seed, scheme.length, 5) % 900));
      const n = m === 'reg' ? 1 : 2;
      let x0 = xb - 2 - 3 * n;
      for (let x = xb - 2 - 3 * n; x > xs; x--) {
        let ok = true;
        for (let k = 0; k < 3 * n; k++) ok &&= S(x + k, yc + 1);
        if (ok) {
          x0 = x;
          break;
        }
      }
      [...num].forEach((c, k) => {
        for (let t = 0; t < n; t++) add(x0 + k * n + t, yc + 1, m === 'reg' ? `reg.${c}` : `big.${c}.${t}`);
      });
    } else if (m === 'sten') {
      for (let k = 0; k < 3; k++) add(xs + 1 + k, yc + 2, `sten.${k}`);
    }
  }
  return out;
}

/** Ship-wide light gradient over the roof (brighter toward the camera-left), as in the approved roof study. */
export function roofGradient(x: number, y: number, width: number, height: number): number {
  return 0.93 + (0.13 * (y - x + width)) / (width + height);
}

/**
 * Tiles the roof plating covers on a roofed ship: every tile of the ship. The slab sits on the interior walls and on
 * top of the hull, its outer edge on the hull's outer face (cut plates, `roofCut`), so no hull top strip shows.
 */
export function roofCovers(kindAt: KindAt, x: number, y: number): boolean {
  const k = kindAt(x, y);
  return k === Struct.Floor || k === Struct.Door || k === Struct.Wall;
}

/** Which cut plate a roof tile needs (tools/blender/sprites/roof_cuts.py), '' for a full plate. */
export type RoofCut = '' | 's' | 'e' | 'se' | 'c';

/**
 * The cut of roof tile (x, y): the near hull is cut at its outer face (`s` space at +y, `e` at +x, `se` both), the
 * far corner whose N and W sides face space is chamfered like the hull (`c`). The far hull's outer face is its tile
 * edge: full plates. An engine's hull row is the same production hull wall, so it takes the same cuts.
 */
export function roofCut(kindAt: KindAt, x: number, y: number): RoofCut {
  if (kindAt(x, y) !== Struct.Wall || !touchesSpace(kindAt, x, y)) return '';
  const o = outward(kindAt, x, y);
  if (o === 1) return 's';
  if (o === 2) return 'e';
  if (o === 3) return 'se';
  return o === 0 && wallMask(kindAt, x, y) === 6 && kindAt(x, y - 1) === Struct.Space && kindAt(x - 1, y) === Struct.Space ? 'c' : '';
}

/** Sprite id suffix of a cut, and the open sides its own lip / girders replace. */
export function cutSuffix(cut: RoofCut): string {
  return cut === '' ? '' : `.cut.${cut}`;
}
export function cutHides(cut: RoofCut, side: 'n' | 'e' | 's' | 'w'): boolean {
  return cut === 'c' ? side === 'n' || side === 'w' : cut.includes(side);
}
