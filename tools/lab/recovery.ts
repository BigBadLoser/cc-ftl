import { Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { ANIM_FPS } from '../../src/render/moduleArt';
import { floor, put } from './hydroponics';
import type { LabCell, LabPanel } from './panel';

const A = 'module.recovery';
const BUBBLES = 8;                                  // the `.active` loop's frames (tools/blender/sprites/recovery.py)
const SCAN = 16;                                    // the scanner's sweep
const TW = 64;
const TH = 32;
const PAD = 12;

/** An animation's frame `f`: the base id, then `.f1`, `.f2`... */
const frame = (base: string, f: number): string => (f ? `${base}.f${f}` : base);

/** A layer that plays the frames of `base` (n of them at ANIM_FPS), each frame placed by its own anchor. */
function playing(root: Container, atlas: Atlas, base: string, n: number, ox: number, oy: number): (t: number) => void {
  const spr = new Sprite();
  const glow = new Sprite();
  glow.blendMode = 'add';
  root.addChild(spr, glow);
  return (t) => {
    const s = atlas.stat(frame(base, Math.floor(t * ANIM_FPS) % n));
    if (!s) return;
    const x = Math.round(ox - s.ax);
    const y = Math.round(oy - s.ay);
    Object.assign(spr, { texture: s.tex, x, y });
    glow.visible = !!s.glow;
    if (s.glow) Object.assign(glow, { texture: s.glow, x, y });
  };
}

/**
 * `?panel=recovery`: the recovery pod (#319), empty, layered as the game will stack it (pod, scan's far half, the front
 * overlay, scan's near half; a patient goes between the pod and the front). One row per rotation: unpowered, powered
 * (the bubble loop, `&play` to run it) and scanning (the 16-frame sweep). `rots=0,1,2,3` (default all).
 */
export const recoveryPanel: LabPanel = {
  id: 'recovery',
  title: 'Recovery pod',
  zoom: 2,
  help: 'rots=0,1,2,3 (default all); &play runs the bubble loop and the scan',
  async cells({ atlas, params }) {
    const rots = (params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4)) ?? [0, 1, 2, 3];
    atlas.ids(A).forEach((id) => atlas.stat(id));   // queue the sheets
    await atlas.whenIdle();
    const st = atlas.ids(A).map((id) => atlas.stat(id)).filter((s) => !!s);
    const left = Math.max(TW, ...st.map((s) => s.ax));
    const right = Math.max(TW, ...st.map((s) => s.tex.width - s.ax));
    const top = Math.max((3 * TH) / 2, ...st.map((s) => s.ay));
    const bottom = Math.max(TH / 2, ...st.map((s) => s.tex.height - s.ay));
    const w = Math.ceil(left + right) + PAD * 2;
    const h = Math.ceil(top + bottom) + PAD * 2;
    const ox = PAD + Math.round(left);
    const oy = PAD + Math.round(top);
    const cells: LabCell[] = [];
    for (const rot of rots) {
      const r = `.r${rot}`;
      cells.push({
        label: 'unpowered', note: `r${rot}`, w, h, newRow: true,
        mount(root) {
          root.addChild(floor(2, 2, ox, oy));
          put(root, atlas, `${A}${r}.unpowered`, ox, oy);
          put(root, atlas, `${A}.front${r}.unpowered`, ox, oy);
          return () => {};
        },
      });
      cells.push({
        label: 'powered', note: `r${rot}, ${BUBBLES} frames`, w, h, at: 0, loop: BUBBLES / ANIM_FPS,
        mount(root) {
          root.addChild(floor(2, 2, ox, oy));
          const sets = [playing(root, atlas, `${A}${r}.active`, BUBBLES, ox, oy), playing(root, atlas, `${A}.front${r}.active`, BUBBLES, ox, oy)];
          return (t) => sets.forEach((set) => set(t));
        },
      });
      cells.push({
        label: 'scanning', note: `r${rot}, ${SCAN} frames`, w, h, at: 1, loop: SCAN / ANIM_FPS,
        mount(root) {
          root.addChild(floor(2, 2, ox, oy));
          const sets = [
            playing(root, atlas, `${A}${r}.active`, BUBBLES, ox, oy),
            playing(root, atlas, `${A}.scan.back${r}`, SCAN, ox, oy),
            playing(root, atlas, `${A}.front${r}.active`, BUBBLES, ox, oy),
            playing(root, atlas, `${A}.scan.front${r}`, SCAN, ox, oy),
          ];
          return (t) => sets.forEach((set) => set(t));
        },
      });
    }
    return cells;
  },
};
