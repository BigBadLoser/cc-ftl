import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { LAMP_TINT } from '../../src/render/stasisArt';
import { floor } from './hydroponics';
import type { LabCell, LabPanel } from './panel';

/**
 * `?panel=stasisload`: the stasis wheel's loading animation PROTOTYPE (#116), rotation 0, preview quality. The frames are
 * patches (tools/blender/sprites/slab_loadanim.py): the pixels that differ from the shut, empty wheel, anchored on its
 * origin. A still is the base, then (once seated) slot 0's slab, the hatch patch, the star patch and the lamp tint.
 * `&src=/.cache/stasis-load-preview/` is where the preview sheet is read (`npm run sprites -- -- <it> stasisload --preview`).
 * First a strip of every tick, then the patches alone on a flat colour (their size is the cost); `&play` loops the strip.
 */
const FPS = 8;
const HATCH = 13;
const STAR = 6;
const TICKS = 16;
const hatchAt = (t: number): number => (t < HATCH ? t : -1);
const starAt = (t: number): number => (t >= 9 && t < 9 + STAR ? t - 9 : -1);
const slabIn = (t: number): boolean => t >= 12;
const lampAt = (t: number): 'off' | 'amb' | 'cy' => (t < 2 ? 'off' : t < 9 ? (t % 2 === 0 ? 'amb' : 'off') : 'cy');

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
    const w = 190;
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
        draw(dyn, fr.get('base'), ox, oy);
        if (slabIn(tick)) draw(dyn, fr.get('slot0'), ox, oy);
        if (hatchAt(tick) >= 0) draw(dyn, fr.get(`h${hatchAt(tick)}`), ox, oy);
        if (starAt(tick) >= 0) draw(dyn, fr.get(`s${starAt(tick)}`), ox, oy);
        const l = lampAt(tick);
        if (l !== 'off') draw(dyn, fr.get('lamp0'), ox, oy, LAMP_TINT[l]);
      };
    };
    for (let t = 0; t < TICKS; t++) {
      cells.push({
        label: `tick ${t}`, note: `hatch ${hatchAt(t) >= 0 ? `h${hatchAt(t)}` : '-'}, star ${starAt(t) >= 0 ? `s${starAt(t)}` : '-'}, lamp ${lampAt(t)}`,
        w, h, newRow: t % 8 === 0, at: t / FPS, loop: TICKS / FPS,
        mount(root) {
          const set = scene(root);
          return (s) => set(Math.min(TICKS - 1, Math.floor(s * FPS + 1e-6)));
        },
      });
    }
    // The patches alone (what the game would load), on a flat colour.
    const ids = [...Array.from({ length: HATCH }, (_, i) => `h${i}`), ...Array.from({ length: STAR }, (_, i) => `s${i}`)];
    ids.forEach((id, i) => {
      const f = fr.get(id);
      cells.push({
        label: `patch ${id}`, note: f ? `${f.tex.width}x${f.tex.height} px` : 'missing', w, h, newRow: i % 8 === 0,
        mount(root) {
          root.addChild(Object.assign(new Sprite(Texture.WHITE), { width: w, height: h, tint: 0x2a3a5a }));
          draw(root, f, ox, oy);
          return () => {};
        },
      });
    });
    return cells;
  },
};
