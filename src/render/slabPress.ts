/*
 * The stasis press (#116): a full slab shows its prisoner's whole crew sprite pressed into the slab's face. The face is found
 * from the slab sprite itself: it is the palette tone `slbFace` unlit (#8c9697 after the render's colour step), a clean
 * parallelogram, so a colour key gives the mask and its four corners the affine map from the figure to the face. No Blender
 * mask. The game's look is R2 of the render lab's `stasisface` panel (the original press on a face lifted 50% toward pale
 * grey, the figure stretched over the whole face window with its tones spread). Pure pixel maths over RGBA buffers; slabFace.ts
 * bakes it for the game, and the lab panel draws its other variants from the same code.
 */

/** An RGBA pixel buffer. */
export interface Px { w: number; h: number; d: Uint8ClampedArray }
export type V = [number, number];

/** The face's tone in the slab sprites. */
export const FACE = [140, 150, 151];
const SS = 3;                                       // supersamples per axis when reading the figure
export const FACE_ASPECT = 2;                       // the slab's face is 1.6 long by 0.8 wide (slab_study.py L, W)
export const FILL = 0.94;                           // how much of the face's length the figure takes

/** Face pixels: the exact face tone, opaque. */
export function faceMask(s: Px): Uint8Array {
  const m = new Uint8Array(s.w * s.h);
  for (let i = 0; i < m.length; i++) m[i] = s.d[i * 4 + 3]! > 200 && s.d[i * 4]! === FACE[0] && s.d[i * 4 + 1]! === FACE[1] && s.d[i * 4 + 2]! === FACE[2] ? 1 : 0;
  return m;
}

/** The face's four corners, clockwise from the top one: the extremes of the mask along x and y with tie-breaks, the best-area four. */
export function corners(m: Uint8Array, w: number, h: number): V[] {
  const pts: V[] = [];
  const dirs: V[] = [[1, 0.01], [1, -0.01], [-1, 0.01], [-1, -0.01], [0.01, 1], [-0.01, 1], [0.01, -1], [-0.01, -1]];
  for (const [dx, dy] of dirs) {
    let best = -Infinity;
    let p: V = [0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { const k = x * dx + y * dy; if (k > best) { best = k; p = [x + 0.5, y + 0.5]; } }
    if (!pts.some((q) => q[0] === p[0] && q[1] === p[1])) pts.push(p);
  }
  let top: V[] = [];
  let bestA = -1;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const ang = (p: V): number => Math.atan2(p[1] - cy, p[0] - cx);
  const n = pts.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const q = [pts[a]!, pts[b]!, pts[c]!, pts[d]!].sort((p, r) => ang(p) - ang(r));
    let area = 0;
    for (let i = 0; i < 4; i++) { const p = q[i]!; const r = q[(i + 1) % 4]!; area += p[0] * r[1] - r[0] * p[1]; }
    if (Math.abs(area) > bestA) { bestA = Math.abs(area); top = q; }
  }
  return top;                                       // sorted by angle: clockwise on screen (y down) from the left
}

/**
 * The map from a face pixel to figure coordinates: the figure lies lengthwise, head to feet along the face's long edge
 * (v), its right along u; of the choices, the one with the feet lowest on screen (head at the upper end), never mirrored.
 */
export function frame(q: V[]): { p0: V; u: V; v: V } {
  let best = -Infinity;
  let out = { p0: q[0]!, u: [1, 0] as V, v: [0, 1] as V };
  for (let i = 0; i < 4; i++) {
    const p0 = q[i]!;
    const p1 = q[(i + 1) % 4]!;
    const p3 = q[(i + 3) % 4]!;
    const u: V = [p1[0] - p0[0], p1[1] - p0[1]];
    const v: V = [p3[0] - p0[0], p3[1] - p0[1]];
    const lu = Math.hypot(...u);
    const lv = Math.hypot(...v);
    if (u[0] * v[1] - u[1] * v[0] <= 0 || lv < lu) continue;     // no mirror; v is the long edge
    const score = v[1] / lv + 0.2 * (v[0] / lv);
    if (score > best) { best = score; out = { p0, u, v }; }
  }
  return out;
}


/** a, l: coverage and luminance, supersampled; n, c: the figure's own pixel at the centre (coverage, rgb), pixel-sharp. */
export interface Field { a: Float32Array; l: Float32Array; n: Float32Array; c: Float32Array; w: number; h: number }

/** Sample the figure into the face: coverage `a` and luminance `l` per sprite pixel (0 where the figure isn't). */
export function sample(sp: Px, mask: Uint8Array, por: Px, fr: ReturnType<typeof frame>, stretch = false): Field {
  const { w, h } = sp;
  const a = new Float32Array(w * h);
  const l = new Float32Array(w * h);
  const n = new Float32Array(w * h);
  const cc = new Float32Array(w * h * 3);
  const det = fr.u[0] * fr.v[1] - fr.u[1] * fr.v[0];
  const hf = stretch ? 0.94 : FILL;                 // the figure's height as a fraction of the face's length
  const wf = stretch ? 0.94 : (por.w / por.h) * FILL * FACE_ASPECT;  // and its width (stretch: the whole window, as the round-1 study)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    let sa = 0;
    let sl = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const dx = x + (i + 0.5) / SS - fr.p0[0];
      const dy = y + (j + 0.5) / SS - fr.p0[1];
      const s = (dx * fr.v[1] - dy * fr.v[0]) / det;
      const t = (dy * fr.u[0] - dx * fr.u[1]) / det;
      const px = Math.floor(((s - 0.5) / wf + 0.5) * por.w);
      const py = Math.floor(((t - 0.5) / hf + 0.5) * por.h);
      if (px < 0 || py < 0 || px >= por.w || py >= por.h) continue;
      const k = (py * por.w + px) * 4;
      const al = por.d[k + 3]! / 255;
      if (i === (SS >> 1) && j === (SS >> 1)) {
        n[y * w + x] = al;
        for (let ch = 0; ch < 3; ch++) cc[(y * w + x) * 3 + ch] = por.d[k + ch]!;
      }
      sa += al;
      sl += al * (0.3 * por.d[k]! + 0.59 * por.d[k + 1]! + 0.11 * por.d[k + 2]!) / 255;
    }
    a[y * w + x] = sa / (SS * SS);
    l[y * w + x] = sa ? sl / sa : 0;
  }
  if (stretch) {                                    // the figure's tones spread over 0.15..0.95, so a dark loadout still reads
    let lo = 1, hi = 0;
    for (let k = 0; k < l.length; k++) if (a[k]! > 0.5) { lo = Math.min(lo, l[k]!); hi = Math.max(hi, l[k]!); }
    for (let k = 0; k < l.length; k++) if (a[k]! > 0) l[k] = 0.15 + 0.8 * (l[k]! - lo) / Math.max(0.05, hi - lo);
  }
  return { a, l, n, c: cc, w, h };
}
/** Box blur of a field over the face, `r` px, so the edge of the figure goes soft (as seen through frost or ice). */
export function blur(f: Float32Array, w: number, h: number, r: number): Float32Array {
  const o = new Float32Array(f.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    let n = 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const xx = x + i;
      const yy = y + j;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      s += f[yy * w + xx]!;
      n++;
    }
    o[y * w + x] = s / n;
  }
  return o;
}

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const q = (v: number, n: number): number => Math.round(v * n) / n;       // quantise to n steps, for a pixel-art read
export const noise = (x: number, y: number): number => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

export type Variant = (o: number[], i: number, x: number, y: number, ctx: { f: Field; bl: Float32Array; bl2: Float32Array; edge: number }) => void;
/** O: the original study's press (tools/blender/review/slab_preview.py): the crew's shading carried into the face colour,
 * its outline cut in (lit top-left, shadowed bottom-right), a 15% tint of the field. */
export const original: Variant = (o, i, _x, _y, { f }) => {
  const w = f.w;
  const on = (k: number): boolean => (f.a[k] ?? 0) > 0.5;
  if (!on(i)) return;
  let sh = 0.78 + 0.6 * (f.l[i]! - 0.45);
  if (!on(i - w - 1)) sh *= 1.22;
  else if (!on(i + w + 1)) sh *= 0.62;
  const tint = [127, 240, 255];
  for (let c = 0; c < 3; c++) o[c] = Math.min(255, o[c]! * sh) * 0.85 + tint[c]! * 0.15;
};
/** O on a lighter face (the round-1 slabs' face was a pale blue-grey; the game's is darker), `lift` toward it. */
export const originalLight = (lift: number): Variant => (o, i, x, y, ctx) => {
  const pale = [176, 196, 202];
  for (let c = 0; c < 3; c++) o[c] = mix(o[c]!, pale[c]!, lift);
  original(o, i, x, y, ctx);
};

/** Edge distance (px, 1..3, else 9) of face pixel i from the face's border. */
function edgeOf(mask: Uint8Array, i: number, w: number): number {
  for (let r = 1; r <= 3; r++) if (!mask[i - r] || !mask[i + r] || !mask[i - r * w] || !mask[i + r * w]) return r;
  return 9;
}

/**
 * The slab sprite's pixels with every face pixel replaced by the press of variant `v` over field `fld`. `blurs` computes the
 * blurred coverage some lab variants read (the game's look does not, so it skips them).
 */
export function pressPx(sp: Px, mask: Uint8Array, fld: Field, v: Variant, blurs = true): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sp.d);
  const none = new Float32Array(0);
  const bl = blurs ? blur(fld.a, sp.w, sp.h, 1) : none;
  const bl2 = blurs ? blur(fld.a, sp.w, sp.h, 2) : none;
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
    const i = y * sp.w + x;
    if (!mask[i]) continue;
    const o = [sp.d[i * 4]!, sp.d[i * 4 + 1]!, sp.d[i * 4 + 2]!];
    v(o, i, x, y, { f: fld, bl, bl2, edge: edgeOf(mask, i, sp.w) });
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(o[c]!)));
  }
  return out;
}

/** The game's press (R2): `slab` pressed with `figure`. Null if the slab has no face (fewer than 4 corners found). */
export function pressSlab(slab: Px, figure: Px): { pressed: Uint8ClampedArray; mask: Uint8Array } | null {
  const mask = faceMask(slab);
  const q4 = corners(mask, slab.w, slab.h);
  if (q4.length < 4) return null;
  const fld = sample(slab, mask, figure, frame(q4), true);
  return { pressed: pressPx(slab, mask, fld, originalLight(0.5), false), mask };
}
