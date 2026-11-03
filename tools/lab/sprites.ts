import { Graphics, Sprite } from 'pixi.js';
import type { LabCell, LabPanel } from './panel';

/** Frames of one sprite id: `fx.shield_flash.3` is frame 3 of `fx.shield_flash`; an id with no number is one frame. */
function group(ids: readonly string[]): Map<string, string[]> {
  const out = new Map<string, { id: string; n: number }[]>();
  for (const id of ids) {
    const m = /^(.*)\.(\d+)$/.exec(id);
    const key = m ? (m[1] as string) : id;
    const list = out.get(key) ?? [];
    list.push({ id, n: m ? Number(m[2]) : 0 });
    out.set(key, list);
  }
  return new Map([...out].map(([k, v]) => [k, v.sort((a, b) => a.n - b.n).map((x) => x.id)]));
}

const PAD = 8;

/**
 * `?panel=sprites&ids=fx.shield_` : every static sprite whose id starts with one of the comma-separated prefixes, each
 * animation on its own row, frame by frame, anchors lined up. `glow=off` hides the glow sheet, `glow=only` shows it alone;
 * `anchor` marks each anchor point; `fps=14` sets the frame rate the notes and `&play` use.
 */
export const spritesPanel: LabPanel = {
  id: 'sprites',
  title: 'Sprites',
  help: 'any static sprites by id prefix, frame by frame: ids=fx.shield_,fx.hit (comma list), glow=on|off|only, anchor, fps=14',
  async cells({ atlas, params }) {
    const prefixes = (params.get('ids') ?? 'fx.').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = [...new Set(prefixes.flatMap((p) => atlas.ids(p)))];
    for (const id of ids) atlas.stat(id); // queue their sheets
    await atlas.whenIdle();
    const glow = params.get('glow') ?? 'on';
    const fps = Number(params.get('fps') ?? 14) || 14;
    const cells: LabCell[] = [];
    let afterAnim = false; // single sprites flow together; one after an animation row starts a new row
    for (const [name, frames] of group(ids)) {
      const st = frames.map((id) => atlas.stat(id)).filter((s) => !!s);
      if (st.length === 0) continue;
      const left = Math.max(...st.map((s) => s.ax));
      const top = Math.max(...st.map((s) => s.ay));
      const right = Math.max(...st.map((s) => s.tex.width - s.ax));
      const bottom = Math.max(...st.map((s) => s.tex.height - s.ay));
      const w = Math.ceil(left + right) + PAD * 2;
      const h = Math.ceil(top + bottom) + PAD * 2;
      if (frames.length > 1) {
        // the animation itself: frame 0 in a still, playing on a loop with `&play`
        cells.push({
          label: `${name} (${frames.length} frames)`,
          note: 'play',
          w,
          h,
          newRow: true,
          loop: frames.length / fps,
          mount(root) {
            const spr = new Sprite();
            const g = new Sprite();
            g.blendMode = 'add';
            root.addChild(spr, g);
            return (t) => {
              const s = atlas.stat(frames[Math.min(frames.length - 1, Math.floor(t * fps))] as string);
              if (!s) return;
              spr.texture = s.tex;
              spr.visible = glow !== 'only';
              g.texture = s.glow ?? s.tex;
              g.visible = glow !== 'off' && !!s.glow;
              spr.position.set(PAD + Math.round(left - s.ax), PAD + Math.round(top - s.ay));
              g.position.copyFrom(spr.position);
            };
          },
        });
      }
      frames.forEach((id, i) => {
        cells.push({
          label: frames.length > 1 ? `${i}` : name,
          note: frames.length > 1 ? `${((i / fps) * 1000).toFixed(0)} ms` : undefined,
          w,
          h,
          newRow: i === 0 && frames.length === 1 && afterAnim,
          mount(root) {
            const s = atlas.stat(id);
            if (!s) return () => {};
            const x = PAD + Math.round(left - s.ax);
            const y = PAD + Math.round(top - s.ay);
            if (glow !== 'only') root.addChild(Object.assign(new Sprite(s.tex), { x, y }));
            if (glow !== 'off' && s.glow) {
              const g = Object.assign(new Sprite(s.glow), { x, y });
              g.blendMode = 'add';
              root.addChild(g);
            }
            if (params.has('anchor')) {
              root.addChild(new Graphics().rect(PAD + left - 3, PAD + top, 7, 1).rect(PAD + left, PAD + top - 3, 1, 7).fill(0xff3b6b));
            }
            return () => {};
          },
        });
      });
      afterAnim = frames.length > 1;
    }
    return cells;
  },
};
