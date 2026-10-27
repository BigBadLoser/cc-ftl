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

type Channel = 'P' | 'S' | 'T' | 'U';
interface Scheme {
  motifs: readonly string[];
  P: number;
  S: number;
  T?: number;
  U?: number;
  remap?: Readonly<Record<string, readonly [Channel, Channel]>>;
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
  // v13 faction schemes: a coat over the whole roof carries the faction colour, its motifs the rest
  gash: {
    motifs: ['coat', 'claw', 'fangs', 'em.skull'], P: 0x2a2d33, S: 0xc8402e, T: 0xe2dccb,
    remap: { claw: ['S', 'S'], fangs: ['S', 'S'], 'em.skull': ['P', 'T'] },
  },
  scorch: {
    motifs: ['coat', 'claw', 'fangs', 'em.skull'], P: 0x33302c, S: 0xe07a26, T: 0xe2dccb,
    remap: { claw: ['S', 'S'], fangs: ['S', 'S'], 'em.skull': ['P', 'T'] },
  },
  reaver: {
    motifs: ['coat', 'claw', 'fangs', 'emL.skull'], P: 0x2a2d33, S: 0xc8402e, T: 0xe2dccb,
    remap: { claw: ['S', 'S'], fangs: ['S', 'S'], 'emL.skull': ['P', 'T'] },
  },
  litany: { motifs: ['coat', 'trace', 'em.eye'], P: 0xd6cfbd, S: 0x3fc4d4, T: 0x2b3440, remap: { trace: ['S', 'S'], 'em.eye': ['T', 'S'] } },
  relic: {
    motifs: ['coat', 'aft', 'trace', 'em.eye'], P: 0xc9ccd1, S: 0x5fd6c0, T: 0x3a2f4a,
    remap: { aft: ['T', 'T'], trace: ['S', 'S'], 'em.eye': ['T', 'S'] },
  },
  vigil: { motifs: ['coat', 'trace', 'emL.eye'], P: 0xd6cfbd, S: 0x3fc4d4, T: 0x2b3440, remap: { trace: ['S', 'S'], 'emL.eye': ['T', 'S'] } },
  velvet: { motifs: ['coat', 'pins', 'em.crest'], P: 0x4a1f2e, S: 0xc9a64a },
  jade: { motifs: ['coat', 'pins', 'em.crest'], P: 0x1d3b33, S: 0xc9a64a },
  sable: { motifs: ['coat', 'pins', 'emL.crest'], P: 0x1f2026, S: 0xc9a64a },
  drab: { motifs: ['coat', 'aft', 'big', 'em.delta', 'sten'], P: 0x4d5a3a, S: 0xd8d4c4, T: 0x1e2018, remap: { aft: ['T', 'T'] } },
  khaki: { motifs: ['coat', 'aft', 'big', 'em.delta', 'sten'], P: 0x7a6e4f, S: 0x1e2018, T: 0x3d3a2c, remap: { aft: ['T', 'T'] } },
  combine: {
    motifs: ['coat', 'split', 'nose', 'big', 'em.meridian'], P: 0x2456a0, S: 0xe8b830, T: 0xe4e2da,
    remap: { coat: ['T', 'T'], nose: ['S', 'P'], big: ['T', 'P'] },
  },
  helix: {
    motifs: ['coat', 'stripe', 'em.helix', 'sten'], P: 0xe6ebea, S: 0x2aa59a, T: 0x8fd3cb,
    remap: { stripe: ['S', 'T'], 'em.helix': ['P', 'S'], sten: ['S', 'S'] },
  },
  vantor: { motifs: ['coat', 'hazard', 'big', 'em.delta'], P: 0xd6a424, S: 0x1e2018, remap: { 'em.delta': ['S', 'P'] } },
  brigade: { motifs: ['coat', 'aft', 'big', 'emL.delta', 'sten'], P: 0x4d5a3a, S: 0xd8d4c4, T: 0x1e2018, remap: { aft: ['T', 'T'] } },
  freight: {
    motifs: ['coat', 'split', 'nose', 'big', 'emL.meridian'], P: 0x2456a0, S: 0xe8b830, T: 0xe4e2da,
    remap: { coat: ['T', 'T'], nose: ['S', 'P'], big: ['T', 'P'] },
  },
  clinic: {
    motifs: ['coat', 'stripe', 'emL.helix', 'sten'], P: 0xe6ebea, S: 0x2aa59a, T: 0x8fd3cb,
    remap: { stripe: ['S', 'T'], 'emL.helix': ['P', 'S'], sten: ['S', 'S'] },
  },
  foundry: { motifs: ['coat', 'hazard', 'big', 'emL.delta'], P: 0xd6a424, S: 0x1e2018, remap: { 'emL.delta': ['S', 'P'] } },
  bazaar: { motifs: ['coat', 'patch', 'em.diamond', 'sten'], P: 0x2b2830, S: 0xff3fa4, T: 0x8a4a2e, U: 0x3e6e6a, remap: { patch: ['T', 'U'] } },
  souk: { motifs: ['coat', 'patch', 'em.diamond', 'sten'], P: 0x33302a, S: 0x39e0d0, T: 0x6e5a3a, U: 0x5a3a5e, remap: { patch: ['T', 'U'] } },
  neon: { motifs: ['coat', 'patch', 'emL.diamond', 'sten'], P: 0x2b2830, S: 0xff3fa4, T: 0x8a4a2e, U: 0x3e6e6a, remap: { patch: ['T', 'U'] } },
};
export const SCHEME_NAMES = Object.keys(SCHEMES);

/** roof_livery.CLASSIC: the original ten schemes, the navy, civilian, scrapper and drone liveries. */
const CLASSIC = ['crimson', 'ivory', 'tide', 'sovereign', 'orchid', 'hornet', 'glacier', 'verdant', 'ember', 'tricolour'] as const;
/** roof_livery.LIVERIES: a faction art def's `livery` id -> the schemes its ships pick from by name. */
export const LIVERIES: Readonly<Record<string, readonly string[]>> = {
  'livery.navy': CLASSIC,
  'livery.scrapper': CLASSIC,
  'livery.drone': CLASSIC,
  'livery.raider': ['gash', 'scorch', 'reaver'],
  'livery.zealot': ['litany', 'relic', 'vigil'],
  'livery.cartel': ['velvet', 'jade', 'sable'],
  'livery.merc': ['drab', 'khaki', 'brigade'],
  'livery.meridian': ['combine', 'freight'],
  'livery.helix': ['helix', 'clinic'],
  'livery.vantor': ['vantor', 'foundry'],
  'livery.blackmarket': ['bazaar', 'souk', 'neon'],
};

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

/**
 * Deterministic livery of a ship from its faction and name: scheme, registry seed and which end the bow motifs take.
 * `livery` (the generating faction's art def `livery` id) picks the scheme list; an unknown or missing id takes the
 * classic ten.
 */
export function liveryFor(faction: string, name: string, livery?: string): { scheme: string; seed: number; bowWest: boolean } {
  const h = strHash(`${faction}:${name}`);
  const list = (livery && LIVERIES[livery]) || CLASSIC;
  return { scheme: list[h % list.length] as string, seed: h % 1000, bowWest: ((h >>> 11) & 1) === 1 };
}

/**
 * Text masks (registry digits, stencils) and the claw swipe: never mirrored, so text stays readable and the swipe keeps its
 * angle; only their placement mirrors (roof_livery.TEXT).
 */
const isText = (mask: string): boolean => ['reg.', 'big.', 'sten.', 'claw.'].some((p) => mask.startsWith(p));

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
    if (m === 'coat') {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) add(x, y, 'full.P');
    } else if (m === 'fangs') {
      for (let y = 0; y < height; y++) {
        add(xb - 2, y, 'fang');
        for (let x = xb - 1; x < width; x++) add(x, y, 'full.P');
      }
    } else if (m === 'claw') {
      const x0 = xs + pyRound(0.25 * L);
      for (let q = 0; q < 12; q++) add(x0 + (q % 4), yc - 2 + Math.floor(q / 4), `claw.${q}`);
    } else if (m === 'hazard') {
      for (let y = 0; y < height; y++) for (const x of [xs, xs + 1, ...Array.from({ length: Math.max(0, width - xb + 1) }, (_, k) => xb - 1 + k)]) add(x, y, 'hazard');
    } else if (m === 'patch') {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const k = rhash(Math.floor((x + Math.floor(y / 2)) / 3), Math.floor(y / 2), seed, 17) % 5;
          if (k < 2) add(x, y, k === 0 ? 'full.P' : 'full.S');
        }
    } else if (m === 'trace') {
      for (let x = xs; x <= xb; x++) {
        add(x, yc - 1, 'trace.n');
        add(x, yc, 'trace.s');
      }
    } else if (m === 'aft') {
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
    } else if (m.startsWith('emL.')) {
      const x0 = xs + pyRound(0.62 * L);
      const block = (xe: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((q) => [xe - 1 + (q % 3), yc - 2 + Math.floor(q / 3)] as const);
      const d = [0, -1, 1, -2, 2, -3, 3].find((dd) => block(x0 + dd).every(([x, y]) => S(x, y)));
      block(x0 + (d ?? 0)).forEach(([x, y], q) => add(x, y, `${m}.${q}`));
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
