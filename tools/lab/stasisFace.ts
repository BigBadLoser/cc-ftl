import { Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { drawLayers } from '../../src/render/crewSprites';
import { ART_SCALE } from '../../src/render/iso';
import { crewLoadout, preloadLayers, type CrewLook } from '../../src/render/loadout';
import type { LabCell, LabPanel } from './panel';

/*
 * Prototype of the stasis "crew shader" (#116): a full slab shows its prisoner pressed into the slab's face. The face
 * area is found from the sprite itself: the face is the palette tone `slbFace` unlit (#8c9697 after the render's
 * colour step), a clean parallelogram, so a colour key gives the mask and its four corners give the affine map from
 * the figure to the face. No Blender mask. The press is baked on the CPU here (one-off per sprite and prisoner) to
 * look at it; in the game it would be a pixi filter doing the same per pixel (see the report).
 */

const A = 'module.stasis_wheel';
const FACE = [140, 150, 151];
const PAD = 14;
const SS = 3;                                       // supersamples per axis when reading the figure

interface Px { w: number; h: number; d: Uint8ClampedArray }
type V = [number, number];

/** The look of each prisoner: who is in the slab. */
const LOOKS = [
  { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 },
  { species: 'species.human', role: 'role.medic', appearanceSeed: 5 },
  { species: 'species.human', role: 'role.gunner', appearanceSeed: 22 },
];

function read(renderer: Renderer, tex: Texture): Px {
  const c = renderer.extract.canvas({ target: new Sprite(tex), resolution: 1, antialias: false }) as HTMLCanvasElement;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const im = x.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, d: im.data };
}

/** The prisoner's whole crew sprite (a standing idle frame, every layer of their loadout, their palette), trimmed to its opaque pixels. */
async function figurePx(atlas: Atlas, renderer: Renderer, look: CrewLook, dir: number): Promise<Px> {
  const layers = crewLoadout(atlas, look);
  preloadLayers(layers);
  await atlas.whenIdle();
  const body = new Container();
  const parts = layers.map((layer) => { const sprite = new Sprite(); body.addChild(sprite); return { layer, sprite }; });
  drawLayers({ parts, glows: [] }, 'idle', dir, 0);
  await atlas.whenIdle();
  drawLayers({ parts, glows: [] }, 'idle', dir, 0);
  const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(look.appearanceSeed));
  setFilterZoom(filter, ART_SCALE);
  setFilterTint(filter, 0xffffff);
  body.filters = [filter];
  const root = new Container();
  root.addChild(body);
  const c = renderer.extract.canvas({ target: root, frame: new Rectangle(-80, -150, 160, 170), resolution: 1, antialias: false }) as HTMLCanvasElement;
  const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d.data[(y * c.width + x) * 4 + 3]! > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = d.data[((y + y0) * c.width + x + x0) * 4 + k]!;
  return { w, h, d: out };
}

/** Face pixels: the exact face tone, opaque. */
function faceMask(s: Px): Uint8Array {
  const m = new Uint8Array(s.w * s.h);
  for (let i = 0; i < m.length; i++) m[i] = s.d[i * 4 + 3]! > 200 && s.d[i * 4]! === FACE[0] && s.d[i * 4 + 1]! === FACE[1] && s.d[i * 4 + 2]! === FACE[2] ? 1 : 0;
  return m;
}

/** The face's four corners, clockwise from the top one: the extremes of the mask along x and y with tie-breaks, the best-area four. */
function corners(m: Uint8Array, w: number, h: number): V[] {
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
function frame(q: V[]): { p0: V; u: V; v: V } {
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

const FACE_ASPECT = 2;                              // the slab's face is 1.6 long by 0.8 wide (slab_study.py L, W)
const FILL = 0.94;                                  // how much of the face's length the figure takes

/** a, l: coverage and luminance, supersampled; n, c: the figure's own pixel at the centre (coverage, rgb), pixel-sharp. */
interface Field { a: Float32Array; l: Float32Array; n: Float32Array; c: Float32Array; w: number; h: number }

/** Sample the figure into the face: coverage `a` and luminance `l` per sprite pixel (0 where the figure isn't). */
function sample(sp: Px, mask: Uint8Array, por: Px, fr: ReturnType<typeof frame>, stretch = false): Field {
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
function blur(f: Float32Array, w: number, h: number, r: number): Float32Array {
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

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const q = (v: number, n: number): number => Math.round(v * n) / n;       // quantise to n steps, for a pixel-art read
const noise = (x: number, y: number): number => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

type Variant = (o: number[], i: number, x: number, y: number, ctx: { f: Field; bl: Float32Array; bl2: Float32Array; edge: number }) => void;

/** A: frosted glass. The face hazes cold white and the prisoner shows through as a soft blue-grey shadow. */
const frosted: Variant = (o, i, x, y, { bl2, f }) => {
  const fig = bl2[i]!;
  const g = f.l[i]! * 255;
  const haze = [mix(o[0]!, 196, 0.5), mix(o[1]!, 232, 0.5), mix(o[2]!, 246, 0.5)];
  const body = [g * 0.5 + 20, g * 0.78 + 35, g * 0.95 + 55];
  for (let c = 0; c < 3; c++) o[c] = mix(haze[c]!, body[c]!, fig * 0.78) + (noise(x, y) - 0.5) * 7;
};

/** B: set in carbonite. Cold-tinted slab, the figure raised as a relief lit from the top left, its shading from the figure. */
const relief: Variant = (o, i, x, y, { f, bl, edge }) => {
  const w = f.w;
  const h = (k: number): number => bl[k]! * 0.8 + f.l[k]! * f.a[k]! * 0.5;
  const ex = h(i) - h(i - 1 - w) + (h(i + 1) - h(i - 1)) * 0.5;      // slope along the light, top-left
  const lit = f.a[i]! > 0.35 ? 0.62 + 0.55 * f.l[i]! : 0.9;
  const sh = q(lit + ex * 1.5, 6);
  const tint = [88, 160, 190];
  for (let c = 0; c < 3; c++) o[c] = Math.max(0, Math.min(255, mix(o[c]!, tint[c]!, 0.32) * sh * (edge < 2 ? 1.12 : 1)));
};

/** C: pressed under ice. A deep, dark figure (blurred, the face tone multiplied), a frozen white rim, a glass sheen across, ice speckle. */
const ice: Variant = (o, i, x, y, { f, bl2, edge }) => {
  const depth = bl2[i]!;
  const g = 0.45 + 0.7 * f.l[i]!;
  const cold = [0.55, 0.82, 1.0];
  for (let c = 0; c < 3; c++) o[c] = mix(o[c]!, o[c]! * cold[c]! * g * 0.9, depth * 0.88);
  const band = ((x * 0.7 + y * 1.1) % 26) / 26;                      // a glass sheen: two diagonal bands
  const sheen = band < 0.12 ? 0.26 : band > 0.2 && band < 0.26 ? 0.1 : 0;
  const rim = edge < 1.5 ? 0.55 : edge < 2.5 ? 0.22 : 0;
  const sp = noise(x * 3.1, y * 1.7) > 0.93 ? 0.3 : 0;
  const white = Math.max(sheen, rim, sp);
  for (let c = 0; c < 3; c++) o[c] = mix(o[c]!, [225, 245, 255][c]!, white);
};

/** D: A's haze with C's frozen rim, glass sheen and speckle. */
const mixed: Variant = (o, i, x, y, ctx) => {
  frosted(o, i, x, y, ctx);
  const band = ((x * 0.7 + y * 1.1) % 26) / 26;
  const rim = ctx.edge < 1.5 ? 0.55 : ctx.edge < 2.5 ? 0.22 : 0;
  const white = Math.max(band < 0.12 ? 0.18 : 0, rim, noise(x * 3.1, y * 1.7) > 0.95 ? 0.25 : 0);
  for (let c = 0; c < 3; c++) o[c] = mix(o[c]!, [225, 245, 255][c]!, white);
};

/** O: the original study's press (tools/blender/review/slab_preview.py): the crew's shading carried into the face colour,
 * its outline cut in (lit top-left, shadowed bottom-right), a 15% tint of the field. */
const original: Variant = (o, i, _x, _y, { f }) => {
  const w = f.w;
  const on = (k: number): boolean => (f.a[k] ?? 0) > 0.5;
  if (!on(i)) return;
  let sh = 0.78 + 0.6 * (f.l[i]! - 0.45);
  if (!on(i - w - 1)) sh *= 1.22;
  else if (!on(i + w + 1)) sh *= 0.62;
  const tint = [127, 240, 255];
  for (let c = 0; c < 3; c++) o[c] = Math.min(255, o[c]! * sh) * 0.85 + tint[c]! * 0.15;
};

/** Carbonite that keeps the sprite: a relief from the figure's sharp outline (lit top-left), and inside it the crew
 * sprite's own pixels, their luminance at full range in the slab's cold tone; `keep` of the crew's own colour stays. */
const sharpCarbonite = (keep: number, tone: number[], contrast: number): Variant => (o, i, _x, _y, { f }) => {
  const w = f.w;
  const on = (k: number): number => ((f.n[k] ?? 0) > 0.5 ? 1 : 0);
  const tinted = [0, 1, 2].map((c) => mix(o[c]!, tone[c]!, 0.32));
  if (!on(i)) {                                     // the slab round the figure: its shadow falls bottom-right
    const sh = on(i - w - 1) ? 0.72 : 1;
    for (let c = 0; c < 3; c++) o[c] = tinted[c]! * sh;
    return;
  }
  const r = f.c[i * 3]!, g = f.c[i * 3 + 1]!, b = f.c[i * 3 + 2]!;
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  let sh = 1 + (lum - 0.45) * contrast;
  if (!on(i - w - 1) || !on(i - w)) sh += 0.32;      // the raised edge catches the light
  else if (!on(i + w + 1) || !on(i + 1)) sh -= 0.28;
  const grey = [r, g, b].map((v) => mix(lum * 255, v, 0.5));
  for (let c = 0; c < 3; c++) o[c] = mix(tinted[c]! * sh, grey[c]! * (0.55 + 0.45 * sh), keep);
};
const ALL_VARIANTS: readonly [string, string, Variant][] = [
  ['O original study', 'shade + cut outline + field tint', original],
  ['A frosted glass', 'haze + soft shadow', frosted],
  ['B carbonite relief', 'tinted slab, raised, lit top-left', relief],
  ['C pressed under ice', 'dark deep, frozen rim, sheen', ice],
  ['D haze + rim', 'A haze with C rim and sheen', mixed],
];
/** O on a lighter face (the round-1 slabs' face was a pale blue-grey; the game's is darker), `lift` toward it. */
const originalLight = (lift: number): Variant => (o, i, x, y, ctx) => {
  const pale = [176, 196, 202];
  for (let c = 0; c < 3; c++) o[c] = mix(o[c]!, pale[c]!, lift);
  original(o, i, x, y, ctx);
};
/** Stretched variants sample the figure over the whole window (round 1), with its tones spread. */
const STRETCHED = new Set<Variant>();
const st = (v: Variant): Variant => { STRETCHED.add(v); return v; };
const VARIANTS: readonly [string, string, Variant][] = [
  ['O original (true proportions)', 'as before', original],
  ['R1 round-1 press', 'O stretched over the window, tones spread', st((o, i, x, y, c) => original(o, i, x, y, c))],
  ['R2 round-1, paler face', 'R1 on a face lifted 50% toward round 1 grey', st(originalLight(0.5))],
  ['R3 round-1, pale face', 'R1 on round 1 grey', st(originalLight(1))],
  ALL_VARIANTS[2]!,
  ['F carbonite, a little colour', 'E keeping 30% of the crew colours', sharpCarbonite(0.3, [88, 160, 190], 1.3)],
];

/** A new texture: the slab with every face pixel replaced by the press, or the sprite itself with no variant. */
function press(sp: Px, mask: Uint8Array, fld: Field | null, v: Variant | null): { tex: Texture; ms: number } {
  const t0 = performance.now();
  const out = document.createElement('canvas');
  out.width = sp.w;
  out.height = sp.h;
  const x = out.getContext('2d') as CanvasRenderingContext2D;
  const im = x.createImageData(sp.w, sp.h);
  im.data.set(sp.d);
  if (fld && v) {
    const bl = blur(fld.a, sp.w, sp.h, 1);
    const bl2 = blur(fld.a, sp.w, sp.h, 2);
    for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) {
      const i = yy * sp.w + xx;
      if (!mask[i]) continue;
      let edge = 9;                                 // distance in px from the face's border (to the first non-face pixel)
      for (let r = 1; r <= 3 && edge === 9; r++) if (!mask[i - r] || !mask[i + r] || !mask[i - r * sp.w] || !mask[i + r * sp.w]) edge = r;
      const o = [sp.d[i * 4]!, sp.d[i * 4 + 1]!, sp.d[i * 4 + 2]!];
      v(o, i, xx, yy, { f: fld, bl, bl2, edge });
      for (let c = 0; c < 3; c++) im.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(o[c]!)));
    }
  }
  x.putImageData(im, 0, 0);
  const tex = Texture.from(out);
  tex.source.scaleMode = 'nearest';
  return { tex, ms: performance.now() - t0 };
}

function stamp(root: Container, tex: Texture, ox: number, oy: number, ax: number, ay: number, flip = false): void {
  const s = new Sprite(tex);
  s.x = Math.round(flip ? ox + ax : ox - ax);
  s.y = Math.round(oy - ay);
  if (flip) s.scale.x = -1;
  root.addChild(s);
}

/**
 * `?panel=stasisface`: prototype of the crew shader for stasis slabs (#116). Prisoners pressed into three slab
 * sprites (the floor slab, the slab on its cart at heading h4, the wheel slot) in three styles, beside the empty slab.
 * `&noface` leaves out the press (the empty slabs only).
 */
export const stasisFacePanel: LabPanel = {
  id: 'stasisface',
  title: 'Stasis slab face (prototype)',
  zoom: 2.5,
  help: 'the prisoner (whole crew sprite) pressed into the slab face, 4 styles beside the empty slab; rows: floor slab, hover cart h4 and h7, wheel slot 0; dir=5 (facing the camera), &dirs shows the figure at each direction',
  async cells({ atlas, renderer, params }) {
    const dir = Number(params.get('dir') ?? 5);
    const ids = ['slab.floor.x', 'slab.cart.h4', 'slab.cart.h7', `${A}.slot0.r0`];
    ids.forEach((id) => atlas.stat(id));
    await atlas.whenIdle();
    const figs = [];
    for (const look of LOOKS) figs.push(await figurePx(atlas, renderer, look, dir));
    const cells: LabCell[] = [];
    if (params.has('dirs')) {                       // debug: the figure at each of the 8 directions
      for (let d = 0; d < 8; d++) {
        const f = await figurePx(atlas, renderer, LOOKS[0]!, d);
        const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
        (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(f.d), f.w, f.h), 0, 0);
        const tex = Texture.from(c);
        cells.push({ label: `dir ${d}`, w: f.w + 8, h: f.h + 8, mount(root) { const sp = new Sprite(tex); sp.position.set(4, 4); root.addChild(sp); return () => {}; } });
      }
      return cells;
    }
    const rows: { name: string; id: string; look: number }[] = [
      { name: 'floor slab, along x', id: 'slab.floor.x', look: 0 },
      { name: 'floor slab, 2nd prisoner', id: 'slab.floor.x', look: 1 },
      { name: 'on the hover cart, h4', id: 'slab.cart.h4', look: 1 },
      { name: 'on the hover cart, h7 (diagonal)', id: 'slab.cart.h7', look: 0 },
      { name: 'wheel slot 0, r0', id: `${A}.slot0.r0`, look: 0 },
      { name: 'wheel slot 0, 2nd prisoner', id: `${A}.slot0.r0`, look: 1 },
    ];
    const stats: string[] = [];
    for (const row of rows) {
      const st = atlas.stat(row.id);
      if (!st) continue;
      const sp = read(renderer, st.tex);
      const mask = faceMask(sp);
      const fr = frame(corners(mask, sp.w, sp.h));
      const fld = params.has('noface') ? null : sample(sp, mask, figs[row.look]!, fr);
      const fls = params.has('noface') ? null : sample(sp, mask, figs[row.look]!, fr, true);
      const opts: [string, string, Variant | null][] = [['empty slab', 'as the sprite is', null], ...(params.has('all') ? ALL_VARIANTS : VARIANTS)];
      const w = sp.w + PAD * 2;
      const h = sp.h + PAD * 2;
      opts.forEach(([label, note, v], j) => {
        const { tex, ms } = press(sp, mask, v && STRETCHED.has(v) ? fls : fld, v);
        if (v) stats.push(`${row.name}/${label}: ${ms.toFixed(1)}ms`);
        cells.push({
          label: j ? label : row.name, note: j ? note : `${row.id} (empty)`, w, h, newRow: j === 0,
          mount(root) {
            stamp(root, tex, PAD, PAD, 0, 0);
            if (st.glow) { const g = new Sprite(st.glow); g.blendMode = 'add'; g.x = PAD; g.y = PAD; root.addChild(g); }
            return () => {};
          },
        });
      });
    }
    console.log(`stasisface bake cost: ${stats.join('; ')}`);
    (window as unknown as { __faceStats?: string[] }).__faceStats = stats;
    return cells;
  },
};
