import { Container, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { figurePx } from '../../src/render/slabFace';
import { pressSlab, pressSlabUv, uvMask, type Px } from '../../src/render/slabPress';
import type { LabCell, LabPanel } from './panel';

/*
 * The slab press through the Blender UV pass (#481), every family that has one: the hover cart (all headings), the wheel's slot
 * layers, the floor slabs and the loading patches. Each row is one slab sprite read from the game's atlas with its UV sheet:
 * the empty sprite, the press as the game did it before (the face found by its colour, four fitted corners, an affine map),
 * the press through the UV pass (what the game does now), the UV pass itself (u red, v green), and where the two face masks
 * differ (white: both, red: the UV pass only, blue: the colour key only). The same figure and the same R2 look in both.
 * `&ids=a,b` picks sprites by id prefix; `&over` draws each loading patch over the shut wheel as the game does.
 */

const PAD = 14;
const LOOKS = [
  { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 },
  { species: 'species.human', role: 'role.medic', appearanceSeed: 5 },
];

const WHEEL = 'module.stasis_wheel';
const patch = (n: string, r = 0): string => `stasisload.${n}.r${r}`;
const DEFAULT_IDS = [
  'slab.cart.h2', 'slab.cart.h5', 'slab.cart.h8', 'slab.floor.x', 'slab.floor.y',
  ...[0, 1, 2, 3].map((r) => `${WHEEL}.slot0.r${r}`), `${WHEEL}.slot4.r1`,
  ...['hd2', 'hh0', 'hh3', 'hh6', 'hc09', 'hc12', 'hc16', 'hc20', 'hc25', 'he0', 's0'].map((n) => patch(n)),
  patch('hc12', 1), patch('hc12', 2), patch('hc12', 3),
];

function read(renderer: Renderer, tex: Texture): Px {
  const c = renderer.extract.canvas({ target: new Sprite(tex), resolution: 1, antialias: false }) as HTMLCanvasElement;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const im = x.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, d: im.data };
}

function tex(w: number, h: number, d: Uint8ClampedArray): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(d), w, h), 0, 0);
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

/** The pixels a press changed: where the colour key found the face. */
function changed(sp: Px, pressed: Uint8ClampedArray | null): Uint8Array {
  const m = new Uint8Array(sp.w * sp.h);
  if (pressed) for (let i = 0; i < m.length; i++) m[i] = sp.d[i * 4] !== pressed[i * 4] || sp.d[i * 4 + 1] !== pressed[i * 4 + 1] || sp.d[i * 4 + 2] !== pressed[i * 4 + 2] ? 1 : 0;
  return m;
}

export const slabUvPanel: LabPanel = {
  id: 'slabuv',
  title: 'Slab press through the UV pass',
  zoom: 2,
  help: 'rows: slab sprites with a UV sheet (ids=prefix,...); columns: empty, colour-keyed press, UV press, the UV pass, mask difference; &over: loading patches over the wheel',
  async cells({ atlas, renderer, params }) {
    const want = params.get('ids')?.split(',');
    const ids = want ? want.flatMap((p) => atlas.ids(p)) : DEFAULT_IDS;
    ids.forEach((id) => atlas.stat(id));
    atlas.stat(`${WHEEL}.r0`);
    await atlas.whenIdle();
    const figs: Px[] = [];
    for (const look of LOOKS) figs.push(await figurePx(atlas, renderer, look, 5));
    if (params.has('over')) return overWheel(atlas, renderer, figs, ids.filter((id) => id.startsWith('stasisload.')));
    const cells: LabCell[] = [];
    ids.forEach((id, row) => {
      const st = atlas.stat(id);
      if (!st?.uv) return;
      const sp = read(renderer, st.tex);
      const uvp = read(renderer, st.uv);
      const fig = figs[row % figs.length]!;
      const key = pressSlab(sp, fig);
      const t0 = performance.now();
      const uvr = pressSlabUv(sp, uvp, fig);
      const ms = performance.now() - t0;
      const km = changed(sp, key?.pressed ?? null);
      const um = uvr ? uvMask(sp, uvp) : new Uint8Array(sp.w * sp.h);
      const diff = new Uint8ClampedArray(sp.d);
      const vis = new Uint8ClampedArray(sp.w * sp.h * 4);
      let both = 0, onlyUv = 0, onlyKey = 0;
      for (let i = 0; i < um.length; i++) {
        if (um[i] && km[i]) { diff.set([235, 235, 235, 255], i * 4); both++; }
        else if (um[i]) { diff.set([230, 40, 40, 255], i * 4); onlyUv++; }
        else if (km[i]) { diff.set([50, 80, 240, 255], i * 4); onlyKey++; }
        if (uvp.d[i * 4 + 3]) vis.set([uvp.d[i * 4]!, uvp.d[i * 4 + 1]!, 40, 255], i * 4);
      }
      console.log(`slabuv ${id}: ${sp.w}x${sp.h}, both ${both}, uv only ${onlyUv}, key only ${onlyKey}, uv press ${ms.toFixed(1)}ms`);
      const cols: [string, string, Uint8ClampedArray][] = [
        ['empty slab', id, sp.d],
        ['colour key', key ? 'face by colour, fitted corners' : 'no face found: plain slab', key?.pressed ?? sp.d],
        ['UV press', uvr ? `${ms.toFixed(1)}ms` : 'no uv face', uvr?.pressed ?? sp.d],
        ['UV pass', 'u red, v green', vis],
        ['masks', `both ${both}, uv only ${onlyUv}, key only ${onlyKey}`, diff],
      ];
      cols.forEach(([label, note, d], j) => {
        const t = tex(sp.w, sp.h, d);
        cells.push({
          label: j ? label : id, note, w: sp.w + PAD * 2, h: sp.h + PAD * 2, newRow: j === 0,
          mount(root: Container) {
            const s = new Sprite(t);
            s.position.set(PAD, PAD);
            root.addChild(s);
            return () => {};
          },
        });
      });
    });
    return cells;
  },
};

/** `&over`: each loading patch drawn over the shut empty wheel of its rotation (both on the wheel's origin) as the game does: the wheel alone, the plain patch, the UV-pressed patch. */
function overWheel(atlas: Atlas, renderer: Renderer, figs: Px[], ids: string[]): LabCell[] {
  const cells: LabCell[] = [];
  for (const id of ids) {
    const st = atlas.stat(id);
    const rot = Number(/\.r(\d)$/.exec(id)?.[1] ?? 0);
    const base = atlas.stat(`${WHEEL}.r${rot}`);
    if (!st || !base) continue;
    const sp = read(renderer, st.tex);
    const press = st.uv ? pressSlabUv(sp, read(renderer, st.uv), figs[0]!) : null;
    const w = base.tex.width + 20, h = base.tex.height + 20;
    const variants: [string, Texture | null][] = [['wheel alone', null], ['plain patch', st.tex], ['UV-pressed patch', press ? tex(sp.w, sp.h, press.pressed) : st.tex]];
    variants.forEach(([label, t], j) => cells.push({
      label: j ? label : id, note: j ? '' : `over ${WHEEL}.r${rot}`, w, h, newRow: j === 0,
      mount(root: Container) {
        const u = new Sprite(base.tex);
        u.position.set(10, 10);
        root.addChild(u);
        if (base.glow) { const g = new Sprite(base.glow); g.blendMode = 'add'; g.position.set(10, 10); root.addChild(g); }
        if (t) { const s = new Sprite(t); s.position.set(10 + base.ax - st.ax, 10 + base.ay - st.ay); root.addChild(s); }
        return () => {};
      },
    }));
  }
  return cells;
}
