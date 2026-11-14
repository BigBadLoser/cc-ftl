import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { LAMP_TINT } from '../../src/render/stasisArt';
import { floor } from './hydroponics';
import type { LabCell, LabPanel } from './panel';

/**
 * `?panel=stasisload`: the stasis wheel's loading animation PROTOTYPE (#116), `&rot=N` (0-3). The frames are
 * patches (tools/blender/sprites/slab_loadanim.py): the pixels that differ from the shut, empty wheel, anchored on its
 * origin. A still is the base, then (once seated) slot 0's slab, the hatch patch, the star patch and the lamp tint.
 * `&src=/.cache/stasis-load-preview/` is where the preview sheet is read (`npm run sprites -- -- <it> stasisload --preview`).
 * First a strip of every tick, then the patches alone on a flat colour (their size is the cost); `&play` loops the strip.
 */
const FPS = 8;
const HD = 5; // hd0-hd4: the leaves part, the cradle rises
const HC = 26; // hc00-hc25: cradle folds flat, the cart brings the slab, the cradle tips it up, it sinks and is run in
const HE = 2; // he0-he1: the leaves shut
const STAR = 6;
const HATCH = HD + HC + HE;
const TICKS = HATCH + STAR + 2; // then the star steps and the lamp lights, and a short hold
const CART_FROM = HD + 4; // hc04 (the cart arrives) .. hc08 (it is pulling away): the game hides its own cart here
const CART_TO = HD + 8;
const hatchName = (i: number): string => (i < HD ? `hd${i}` : i < HD + HC ? `hc${String(i - HD).padStart(2, '0')}` : `he${i - HD - HC}`);
const hatchAt = (t: number): number => (t < HATCH ? t : -1);
const starAt = (t: number): number => (t >= HATCH && t < HATCH + STAR ? t - HATCH : -1);
const slabIn = (t: number): boolean => t >= HATCH;
const lampAt = (t: number): 'off' | 'cy' => (t >= HATCH ? 'cy' : 'off');

interface Fr { tex: Texture; glow: Texture | null; ax: number; ay: number }
interface Man {
  assets: Record<string, { frame: { x: number; y: number; w: number; h: number }; anchor: { x: number; y: number }; glow?: boolean }>;
  sheets: Record<string, { image: string; glow?: string }>;
}

async function frames(src: string): Promise<Map<string, Fr>> {
  const m = await (await fetch(`${src}manifest.json?t=${Date.now()}`)).json() as Man;
  const sh = m.sheets.stasisload as { image: string; glow?: string };
  const img = await Assets.load<Texture>(`${src}${sh.image}?t=${Date.now()}`);
  const gl = sh.glow ? await Assets.load<Texture>(`${src}${sh.glow}?t=${Date.now()}`) : null;
  img.source.scaleMode = 'nearest';
  if (gl) gl.source.scaleMode = 'nearest';
  const out = new Map<string, Fr>();
  for (const [id, a] of Object.entries(m.assets)) {
    if (!id.startsWith('stasisload.')) continue;
    const r = new Rectangle(a.frame.x, a.frame.y, a.frame.w, a.frame.h);
    out.set(id.slice('stasisload.'.length), { tex: new Texture({ source: img.source, frame: r }), glow: gl && a.glow ? new Texture({ source: gl.source, frame: r }) : null, ax: a.anchor.x, ay: a.anchor.y });
  }
  return out;
}

function draw(root: Container, f: Fr | undefined, ox: number, oy: number, tint = 0xffffff): void {
  if (!f) return;
  const x = Math.round(ox - f.ax);
  const y = Math.round(oy - f.ay);
  root.addChild(Object.assign(new Sprite(f.tex), { x, y, tint }));
  if (f.glow) root.addChild(Object.assign(new Sprite(f.glow), { x, y, tint, blendMode: 'add' }));
}

export const stasisLoadPanel: LabPanel = {
  id: 'stasisload',
  title: 'Stasis wheel loading (prototype)',
  zoom: 2,
  help: 'src=/.cache/stasis-load-preview/ ; &play loops the strip',
  async cells({ params }) {
    const fr = await frames(params.get('src') ?? '/.cache/stasis-load-preview/');
    const rot = Number(params.get('rot') ?? 0);
    const g = (n: string): Fr | undefined => fr.get(`${n}.r${rot}`);
    const w = 230;
    const h = 190;
    const ox = Math.round(w / 2);
    const oy = 150;
    const cells: LabCell[] = [];
    const scene = (root: Container): ((t: number) => void) => {
      root.addChild(floor(3, 3, ox, oy));
      const dyn = new Container();
      root.addChild(dyn);
      return (tick) => {
        dyn.removeChildren().forEach((c) => c.destroy());
        draw(dyn, g('base'), ox, oy);
        if (slabIn(tick)) draw(dyn, g('slot0'), ox, oy);
        if (hatchAt(tick) >= 0) draw(dyn, g(hatchName(hatchAt(tick))), ox, oy);
        if (starAt(tick) >= 0) draw(dyn, g(`s${starAt(tick)}`), ox, oy);
        const l = lampAt(tick);
        if (l !== 'off') draw(dyn, g('lamp0'), ox, oy, LAMP_TINT[l]);
      };
    };
    for (let t = 0; t < TICKS; t++) {
      cells.push({
        label: `tick ${t}`, note: `${hatchAt(t) >= 0 ? hatchName(t) : '-'}${t >= CART_FROM && t <= CART_TO ? ' (cart)' : ''}, star ${starAt(t) >= 0 ? `s${starAt(t)}` : '-'}, lamp ${lampAt(t)}`,
        w, h, newRow: t % 11 === 0, at: t / FPS, loop: TICKS / FPS,
        mount(root) {
          const set = scene(root);
          return (s) => set(Math.min(TICKS - 1, Math.floor(s * FPS + 1e-6)));
        },
      });
    }
    return cells;
  },
};
