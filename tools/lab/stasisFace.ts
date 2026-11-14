import { Container, Sprite, Texture, type Renderer } from 'pixi.js';
import { figurePx } from '../../src/render/slabFace';
import { corners, faceMask, frame, mix, noise, original, originalLight, pressPx, q, sample, type Field, type Px, type Variant } from '../../src/render/slabPress';
import type { LabCell, LabPanel } from './panel';

/*
 * Prototype of the stasis "crew shader" (#116): a full slab shows its prisoner pressed into the slab's face. The face
 * area is found from the sprite itself: the face is the palette tone `slbFace` unlit (#8c9697 after the render's
 * colour step), a clean parallelogram, so a colour key gives the mask and its four corners give the affine map from
 * the figure to the face. No Blender mask. The press is baked on the CPU here (one-off per sprite and prisoner) to
 * look at it. The press itself (mask, corners, frame, sample, R2) lives in src/render/slabPress.ts and slabFace.ts, which
 * the game uses; this panel draws the other variants from the same code.
 */

const A = 'module.stasis_wheel';
const PAD = 14;


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
  if (fld && v) im.data.set(pressPx(sp, mask, fld, v));
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
