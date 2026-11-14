import { Container, Sprite, Texture, type Renderer } from 'pixi.js';
import { figurePx } from '../../src/render/slabFace';
import { pressSlab, pressSlabUv, uvMask, type Px } from '../../src/render/slabPress';
import type { LabCell, LabPanel } from './panel';

/*
 * The slab press through a Blender UV pass (#481), prototype. Each row is one slab sprite of the prototype set
 * (tools/lab/fixtures/slabuv/: sheets slabuv.png and slabuv.uv.png from `npm run sprites -- -- <outdir> slabuv`, rendered by
 * tools/blender/sprites/slab_uv.py): the empty sprite, the press as the game does it now (the face found by its colour,
 * four fitted corners, an affine map), the press through the UV pass, the UV pass itself (u red, v green), and where the two
 * face masks differ (white: both, red: the UV pass only, blue: the colour key only). The same figure and the same R2 look.
 */

const DIR = '/tools/lab/fixtures/slabuv/';
const PAD = 14;
const LOOKS = [
  { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 },
  { species: 'species.human', role: 'role.medic', appearanceSeed: 5 },
];

interface Entry { sheet: string; frame: { x: number; y: number; w: number; h: number }; anchor: { x: number; y: number } }
interface Fixture { assets: Record<string, Entry>; img: Map<string, HTMLImageElement>; uv: Map<string, HTMLImageElement> }

async function image(url: string): Promise<HTMLImageElement> {
  const im = new Image();
  im.src = url;
  await im.decode();
  return im;
}

async function fixture(): Promise<Fixture> {
  const man = (await (await fetch(`${DIR}manifest.json`)).json()) as { sheets: Record<string, { image: string; uv?: string }>; assets: Record<string, Entry> };
  const img = new Map<string, HTMLImageElement>();
  const uv = new Map<string, HTMLImageElement>();
  for (const [name, s] of Object.entries(man.sheets)) {
    img.set(name, await image(DIR + s.image.replace('sprites/', "")));
    if (s.uv) uv.set(name, await image(DIR + s.uv.replace('sprites/', "")));
  }
  return { assets: man.assets, img, uv };
}

function cut(im: HTMLImageElement, f: Entry['frame']): Px {
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  x.drawImage(im, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  return { w: f.w, h: f.h, d: x.getImageData(0, 0, f.w, f.h).data };
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

/** The colour key's mask of the sprite, as the game's press finds it (faceMask via pressSlab's own steps): pixels it changes. */
function keyMask(sp: Px, pressed: Uint8ClampedArray | null): Uint8Array {
  const m = new Uint8Array(sp.w * sp.h);
  if (pressed) for (let i = 0; i < m.length; i++) m[i] = sp.d[i * 4] !== pressed[i * 4] || sp.d[i * 4 + 1] !== pressed[i * 4 + 1] || sp.d[i * 4 + 2] !== pressed[i * 4 + 2] ? 1 : 0;
  return m;
}

const ROWS: { name: string; id: string; look: number }[] = [
  { name: 'hover cart h2', id: 'slab.cart.h2', look: 0 },
  { name: 'hover cart h6 (diagonal)', id: 'slab.cart.h6', look: 1 },
  { name: 'floor slab, along x', id: 'slab.floor.x', look: 0 },
  { name: 'wheel slot 0, r0', id: 'module.stasis_wheel.slot0.r0', look: 1 },
  ...['hh0', 'hh3', 'hh6', 'hc09', 'hc12', 'hc16', 'hc20', 'hc25'].map((n, k) => ({ name: `loading ${n}`, id: `stasisload.${n}.r0`, look: k % 2 })),
];

export const slabUvPanel: LabPanel = {
  id: 'slabuv',
  title: 'Slab press through a UV pass (prototype)',
  zoom: 2,
  help: 'rows: the prototype slab sprites; columns: empty, colour-keyed press (now), UV press, the UV pass, mask difference',
  async cells({ atlas, renderer, params }) {
    const fx = await fixture();
    const figs = [];
    for (const look of LOOKS) figs.push(await figurePx(atlas, renderer as Renderer, look, 5));
    const only = params.get('rows')?.split(',');
    const cells: LabCell[] = [];
    for (const row of ROWS) {
      if (only && !only.some((o) => row.id.includes(o))) continue;
      const e = fx.assets[row.id];
      if (!e) continue;
      const sp = cut(fx.img.get(e.sheet)!, e.frame);
      const uvp = cut(fx.uv.get(e.sheet)!, e.frame);
      const key = pressSlab(sp, figs[row.look]!);
      const t0 = performance.now();
      const uvr = pressSlabUv(sp, uvp, figs[row.look]!);
      const ms = performance.now() - t0;
      const km = keyMask(sp, key?.pressed ?? null);
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
      console.log(`slabuv ${row.id}: sprite ${sp.w}x${sp.h}, masks both ${both}, uv only ${onlyUv}, key only ${onlyKey}, uv press ${ms.toFixed(1)}ms`);
      const panels: [string, string, Uint8ClampedArray][] = [
        ['empty slab', row.id, sp.d],
        ['colour key (now)', key ? 'face by colour, fitted corners' : 'no face found: plain slab', key?.pressed ?? sp.d],
        ['UV press', uvr ? `uv: ${ms.toFixed(1)}ms` : 'no uv face', uvr?.pressed ?? sp.d],
        ['UV pass', 'u red, v green', vis],
        ['masks', `both ${both}, uv only ${onlyUv}, key only ${onlyKey}`, diff],
      ];
      const cw = sp.w + PAD * 2, ch = sp.h + PAD * 2;
      panels.forEach(([label, note, d], j) => {
        const t = tex(sp.w, sp.h, d);
        cells.push({
          label: j ? label : row.name, note, w: cw, h: ch, newRow: j === 0,
          mount(root: Container) {
            const s = new Sprite(t);
            s.position.set(PAD, PAD);
            root.addChild(s);
            return () => {};
          },
        });
      });
    }
    return cells;
  },
};
