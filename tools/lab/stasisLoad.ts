import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { LAMP_TINT } from '../../src/render/stasisArt';
import { LOAD_TICKS, loadPlan, loadTick, patchId, planHasCart } from '../../src/render/stasisLoad';
import { STOW_SECONDS } from '../../src/sim/stasis/tuning';
import { floor } from './hydroponics';
import type { LabCell, LabPanel } from './panel';

/**
 * `?panel=stasisload`: the stasis wheel's loading animation (#116), `&rot=N` (0-3). Each cell is the game's drawing at one stow
 * progress 0..1 (render/stasisLoad.ts loadTick/loadPlan/patchId, the same calls stasisArt makes): the wheel and slot 0's layers from the
 * game's atlas, the patch over them. `&src=/.cache/stasis-load-preview/` reads the patches from a scratch sheet instead of the atlas
 * (`&src2=` adds more); `&play` runs one stow over STOW_SECONDS. The cart is the crew member's own: the game hides its cart sprite then.
 */
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
  img.source.resolution = 0.5; // a 1x sheet is drawn at twice its pixel size, like the atlas's
  if (gl) Object.assign(gl.source, { scaleMode: 'nearest', resolution: 0.5 });
  const out = new Map<string, Fr>();
  for (const [id, a] of Object.entries(m.assets)) {
    if (!id.startsWith('stasisload.')) continue;
    const r = new Rectangle(a.frame.x * 2, a.frame.y * 2, a.frame.w * 2, a.frame.h * 2) /* (frames are in logical px: a 1x sheet's are doubled) */;
    out.set(id.slice('stasisload.'.length), { tex: new Texture({ source: img.source, frame: r }), glow: gl && a.glow ? new Texture({ source: gl.source, frame: r }) : null, ax: a.anchor.x * 2, ay: a.anchor.y * 2 });
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


const A = 'module.stasis_wheel';

export const stasisLoadPanel: LabPanel = {
  id: 'stasisload',
  title: 'Stasis wheel loading',
  zoom: 1,
  help: 'rot=0..3 ; src=/.cache/stasis-load-preview/ (patch sheets, else the atlas) ; &play runs one stow',
  async cells({ params, atlas }) {
    const srcs = (params.get('src') ?? '').split(',').filter(Boolean);
    const fr = new Map<string, Fr>();
    for (const d of srcs) for (const [k, v] of await frames(d)) fr.set(`stasisload.${k}`, v);
    const rot = Number(params.get('rot') ?? 0);
    const w = 480;
    const h = 330;
    const ox = 200;
    const oy = 285;
    const art = (id: string): Fr | undefined => {
      const f = fr.get(id);
      if (f) return f;
      const a = atlas.stat(id);
      return a ? { tex: a.tex, glow: a.glow, ax: a.ax, ay: a.ay } : undefined;
    };
    const ids = [`${A}.r${rot}`, `${A}.slot0.r${rot}`, `${A}.lamp0.r${rot}`];
    ids.forEach((id) => atlas.stat(id));
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    const scene = (root: Container): ((p: number) => void) => {
      root.addChild(floor(3, 3, ox, oy));
      const dyn = new Container();
      root.addChild(dyn);
      return (p) => {
        const plan = loadPlan(loadTick(p));
        dyn.removeChildren().forEach((c) => c.destroy());
        draw(dyn, art(ids[0] as string), ox, oy);
        if (plan.home) draw(dyn, art(ids[1] as string), ox, oy);
        if (plan.patch) draw(dyn, art(patchId(plan.patch, rot)), ox, oy);
        if (plan.home) draw(dyn, art(ids[2] as string), ox, oy, LAMP_TINT.cy);
      };
    };
    for (let t = 0; t < LOAD_TICKS; t++) {
      const p = (t + 0.5) / LOAD_TICKS;
      const plan = loadPlan(t);
      cells.push({
        label: `tick ${t}`, note: `${plan.patch ?? '-'}${planHasCart(t) ? ' (cart)' : ''}  p=${p.toFixed(3)}`,
        w, h, newRow: t % 11 === 0, at: p * STOW_SECONDS, loop: STOW_SECONDS,
        mount(root) {
          const set = scene(root);
          return (s) => set(Math.min(0.9999, s / STOW_SECONDS));
        },
      });
    }
    return cells;
  },
};
