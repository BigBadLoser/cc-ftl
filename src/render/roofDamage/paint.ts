/**
 * The roof damage overlay (the look: tools/damage_mock/roof_mock.py on art/walls-2x), drawn over the roof plating and
 * its livery. Where the armour is torn away it is opaque: the steel underplate (its own colour, broken into chunks,
 * layered along the hole's edge, thin on a hole's camera-facing side), the structure under it in the dark (purlins
 * snapped span by span), and the plate's cut along a hole's far edge with its lit lip. Over the armour that stays it is
 * translucent: soot in hard steps, cracks, and the dents' light and dark steps, so the livery still shows through.
 */
import { hitFields, type RoofHit, type Window } from './hits';
import { and, dilate, distances, joinedTo, label, not, opened, or, shifted, stepped, type Mask } from './masks';
import { cellsAlong, hash, hash3, rng, valueNoise } from './noise';

export interface RoofLayers {
  /** RGBA: the plating (base sprites, for the cut's colour), the structure, the structure without its purlins. */
  plate: Uint8ClampedArray;
  struct: Uint8ClampedArray;
  bare: Uint8ClampedArray;
}

const SOOT = [30, 33, 37] as const;
const STEEL = [96, 100, 106] as const;          // the underplate: one neutral steel, whatever the armour's colour
const BACK_W = [1, 9] as const;                 // px: the underplate shows this far round a hole (by noise)
const BACK_MORE = 11;                           // px: up to this much more in broad, uneven lobes
const JAG = 2;                                  // px: its edge jitters this much either way
const NEAR = 3;                                 // a hole's near (camera-facing) side shows the band 1/this as wide
const BACK_STEP = [[2, 6], [2, 4]] as const;
const LOBE_STEP = [[3, 8], [2, 5]] as const;
const CHUNK = [[6, 14], [4, 8]] as const;       // px: the underplate's broken chunks
const CHUNK_TONES = [-10, -4, 0, 0, 6];
const CRACKED = 0.5;                            // share of chunks whose edges show as fractures
const FRACTURE = [12, -16] as const;            // a fracture's lit (upper, left) and shadowed (lower, right) sides
const STRATA = 2;                               // px per stratum along a hole's edge, and its tone step either way
const STRATA_TONE = 3;
const SCRAP = 150;                              // px: a plating scrap cut off by tears, smaller than this, goes too
const BRIDGE = 2;                               // px: armour narrower than twice this between holes is stripped
const CUT = 2;                                  // px: a plate's cut, a face along a hole's far edge
const CUT_TONE = 0.82;
const LIP = [214, 218, 222] as const;           // bare metal on the cut's lip, and how far toward it
const LIP_LIT = 0.3;
const SNAP = 0.65;                              // share of purlin spans a tear snaps (each span its own draw)
const STUB = [1, 5] as const;                   // px: a snapped span's stubs
const TORN = 3;                                 // px: how far each row of a break tears on
const DENT_STEPS = [[0, 0.4], [0, 0.22], [0, 0], [255, 0.13], [255, 0.27]] as const;   // dent light steps: (grey, alpha)

const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));

/** The overlay (RGBA, window size) for these hits. */
export function paintRoofDamage(win: Window, layers: RoofLayers, hits: readonly RoofHit[]): Uint8ClampedArray {
  const { w, h, gx, gy, roof } = win;
  const n = w * h;
  const out = new Uint8ClampedArray(n * 4);
  if (!hits.length) return out;
  const f = hitFields(win, hits);
  let hole = f.hole;
  // Plating slivers under 3 px between tears go with them, and scraps cut off inside them (not ones the window cut).
  const plate = and(roof, not(hole));
  const kept = dilate(opened(plate, w, h, 1), w, h, true);
  const nearTear = or(or(shifted(hole, w, h, 2, 0), shifted(hole, w, h, -2, 0)), or(shifted(hole, w, h, 0, 2), shifted(hole, w, h, 0, -2)));
  hole = or(hole, and(and(plate, not(kept)), nearTear));
  const parts = label(and(roof, not(hole)), w, h);
  hole = hole.slice();
  for (let i = 0; i < n; i++) {
    const q = parts.lab[i] as number;
    if (q && (parts.size[q] as number) < SCRAP && !parts.edge[q]) hole[i] = 1;
  }
  // How far each px is from a hole (the near side grows a step in NEAR), and the underplate band by noise.
  const dist = distances(hole, w, h, BACK_W[1] + BACK_MORE, NEAR);
  // The band's width by noise, where a hole is near enough for it to matter (dist 99 is past any width).
  const width = new Float32Array(n);
  const more = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 99) continue;
      const X = gx + x;
      const Y = gy + y;
      width[i] = BACK_W[0] + (BACK_W[1] - BACK_W[0]) * clamp(0.5 + 0.8 * valueNoise(X, Y, 6, 2, 2)) ** 1.3 + JAG * valueNoise(X, Y, 3, 1, 3);
      more[i] = (width[i] as number) + BACK_MORE * clamp((valueNoise(X, Y, 18, 2, 4) + 0.15) / 0.55) ** 1.5;
    }
  }
  const cols = (size: readonly [number, number], salt: number): Int32Array => cellsAlong(gx, w, size, salt);
  const rows = (size: readonly [number, number], salt: number): Int32Array => cellsAlong(gy, h, size, salt + 1);
  const chunkCol = cols(CHUNK[0], 7);
  const chunkRow = rows(CHUNK[1], 7);
  const chunks = new Int32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) chunks[y * w + x] = hash3(chunkCol[x] as number, chunkRow[y] as number, 7) | 0;
  const within = (lim: Float32Array | number): Mask => {
    const o = new Uint8Array(n);
    if (typeof lim === 'number') for (let i = 0; i < n; i++) o[i] = (dist[i] as number) <= lim ? 1 : 0;
    else for (let i = 0; i < n; i++) o[i] = (dist[i] as number) <= (lim[i] as number) ? 1 : 0;
    return o;
  };
  const backStep = stepped(within(width), w, h, cols(BACK_STEP[0], 5), rows(BACK_STEP[1], 5));
  const lobeStep = stepped(within(more), w, h, cols(LOBE_STEP[0], 6), rows(LOBE_STEP[1], 6));
  let back = and(and(or(or(backStep, lobeStep), within(BACK_W[0])), roof), not(hole));
  back = or(and(back, dilate(opened(back, w, h, 1), w, h)), and(and(within(BACK_W[0]), roof), not(hole)));
  back = joinedTo(back, hole, w, h);                                   // (only underplate joined to a hole: no islands)
  const armour = and(and(roof, not(hole)), not(back));
  back = or(back, and(armour, not(opened(armour, w, h, BRIDGE))));    // (thin armour bridges between holes: stripped)
  const gone = or(hole, back);
  // Soot in hard steps (the grain breaks its edge up).
  const s = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!f.scorch[i]) continue;
      const v = clamp((f.scorch[i] as number) * (0.75 + 0.25 * valueNoise(gx + x, gy + y, 3, 2, 8)));
      s[i] = v > 0.75 ? 0.7 : v > 0.45 ? 0.45 : v > 0.2 ? 0.22 : 0;
    }
  }
  const snapped = snappedSpans(layers, hole, w, h, gx, gy);
  const set = (i: number, r: number, g: number, b: number, a = 255): void => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!roof[i]) continue;
      const si = s[i] as number;
      if (hole[i]) {                                                    // (the structure, in the dark; its shadow under the cut)
        const src = snapped[i] ? layers.bare : layers.struct;
        const lum = ((src[i * 4] as number) + (src[i * 4 + 1] as number) + (src[i * 4 + 2] as number)) / 3;
        const k = 0.62 + 0.38 * clamp((lum - 115) / 55);
        const open = (d: number): boolean => y - d < 0 || !hole[i - d * w];
        const shade = open(CUT + 1) ? 0.7 : open(CUT + 2) ? 0.5 : open(CUT + 3) ? 0.3 : 0;
        const c = (j: number): number => (src[i * 4 + j] as number) * k * (1 - shade) + (SOOT[j] as number) * shade;
        set(i, c(0), c(1), c(2));
      } else if (back[i]) {                                             // (the underplate: chunks, fractures, strata)
        const t = plateTone(chunks, i, w, h, dist[i] as number);
        const shade = y < 1 || !gone[i - w] ? 0.5 : y < 2 || !gone[i - 2 * w] ? 0.25 : 0;
        const c = (j: number): number => {
          const v = ((STEEL[j] as number) + t) * (1 - si) + (SOOT[j] as number) * si;
          return v * (1 - shade) + (SOOT[j] as number) * shade;
        };
        set(i, c(0), c(1), c(2));
      } else {                                                          // (armour: soot, cracks, dent light, translucent)
        overArmour(i, x, y, si);
      }
    }
  }
  // The plate's cut along a hole's far (upper) edge, its own colour turned down, and the lit lip at its foot.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!roof[i] || !gone[i]) continue;
      for (let k = 1; k <= CUT; k++) {
        const j = i - k * w;
        if (y - k < 0 || !roof[j]) continue;
        const fromArmour = !gone[j];
        const fromBack = hole[i] && back[j];
        if (!fromArmour && !fromBack) continue;
        const above = fromArmour ? sooted(layers.plate, j, s[j] as number) : [out[j * 4] as number, out[j * 4 + 1] as number, out[j * 4 + 2] as number];
        let c = above.map((v) => v * CUT_TONE);
        if (k === 2 && fromArmour && gone[i - w]) c = c.map((v, q) => v * (1 - LIP_LIT) + (LIP[q] as number) * LIP_LIT);
        set(i, c[0] as number, c[1] as number, c[2] as number);
        break;
      }
    }
  }
  return out;

  function overArmour(i: number, x: number, y: number, si: number): void {
    const d = f.dent;
    const gyd = ((y < h - 1 ? (d[i + w] as number) : (d[i] as number)) - (y > 0 ? (d[i - w] as number) : (d[i] as number))) / 2;
    const gxd = ((x < w - 1 ? (d[i + 1] as number) : (d[i] as number)) - (x > 0 ? (d[i - 1] as number) : (d[i] as number))) / 2;
    const step = clamp(Math.round(-(gyd * 0.8 + gxd * 0.5) * 16), -2, 2) + 2;
    const [dg, da] = DENT_STEPS[step] as readonly [number, number];
    const cracked = f.crack[i] ? 0.65 : 0;
    if (!da && !si && !cracked) return;
    // Layers bottom up (dent light, soot, crack), composited "over" into one translucent px.
    let a = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    const over = (cr: number, cg: number, cb: number, al: number): void => {
      if (!al) return;
      const na = al + a * (1 - al);
      r = (cr * al + r * a * (1 - al)) / na;
      g = (cg * al + g * a * (1 - al)) / na;
      b = (cb * al + b * a * (1 - al)) / na;
      a = na;
    };
    over(dg, dg, dg, da);
    over(SOOT[0], SOOT[1], SOOT[2], si);
    over(SOOT[0], SOOT[1], SOOT[2], cracked);
    if (a > 0) set(i, r, g, b, Math.round(a * 255));
  }
}

function sooted(src: Uint8ClampedArray, j: number, si: number): number[] {
  return [0, 1, 2].map((q) => (src[j * 4 + q] as number) * (1 - si) + (SOOT[q] as number) * si);
}

/** The underplate's own detail at px i: its chunk's tone step, fractures on cracked chunks' edges, strata by distance. */
function plateTone(chunks: Int32Array, i: number, w: number, h: number, dist: number): number {
  const c = chunks[i] as number;
  const x = i % w;
  const y = (i - x) / w;
  let t = CHUNK_TONES[hash(c, 9) % CHUNK_TONES.length] as number;
  if ((hash(c, 10) % 1000) / 1000 < CRACKED) {
    if ((y > 0 && chunks[i - w] !== c) || (x > 0 && chunks[i - 1] !== c)) t += FRACTURE[0];
    if ((y < h - 1 && chunks[i + w] !== c) || (x < w - 1 && chunks[i + 1] !== c)) t += FRACTURE[1];
  }
  return t + (Math.floor(dist / STRATA) % 2 === 1 ? -STRATA_TONE : STRATA_TONE);
}

/**
 * Purlin spans a tear has snapped: each run of purlin px (where the structure differs from its bare layer) that a hole
 * reaches is snapped by its own draw, its middle gone (jagged ends, stubs left, its soft edge above and below with it).
 */
function snappedSpans(layers: RoofLayers, hole: Mask, w: number, h: number, gx: number, gy: number): Mask {
  const n = w * h;
  const purlin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = layers.struct;
    const b = layers.bare;
    if (Math.abs((s[i * 4] as number) - (b[i * 4] as number)) + Math.abs((s[i * 4 + 1] as number) - (b[i * 4 + 1] as number)) > 6) purlin[i] = 1;
  }
  const { lab, size } = label(purlin, w, h);
  const boxes = size.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, hit: false }));
  for (let i = 0; i < n; i++) {
    const q = lab[i] as number;
    if (!q) continue;
    const b = boxes[q]!;
    const x = i % w;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, (i - x) / w);
    if (hole[i]) b.hit = true;
  }
  let gap: Mask = new Uint8Array(n);
  const draws = boxes.map((b) => rng(hash(gx + b.x0, gy + b.y0, 77)));
  const ends = boxes.map((b, q) => {
    const r = draws[q] as () => number;
    const take = b.hit && r() < SNAP;
    return { take, a: STUB[0] + Math.floor(r() * (STUB[1] - STUB[0] + 1)), b: STUB[0] + Math.floor(r() * (STUB[1] - STUB[0] + 1)), seed: hash(gx + b.x0, gy + b.y0, 78) };
  });
  for (let i = 0; i < n; i++) {
    const q = lab[i] as number;
    const e = ends[q];
    if (!q || !e?.take) continue;
    const x = i % w;
    const y = (i - x) / w;
    const b = boxes[q]!;
    const ja = hash(e.seed, gy + y, 1) % (TORN + 1);
    const jb = hash(e.seed, gy + y, 2) % (TORN + 1);
    if (x > b.x0 + e.a + ja && x < b.x1 - e.b - jb) gap[i] = 1;
  }
  for (let d = 0; d < 2; d++) gap = or(gap, or(shifted(gap, w, h, 1, 0), shifted(gap, w, h, -1, 0)));
  return gap;
}
