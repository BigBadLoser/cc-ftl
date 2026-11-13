import { Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { CART_FPS, CART_FRAMES, cartFrame, slotOrder } from '../../src/render/stasisArt';
import { floor, put } from './hydroponics';
import type { LabCell, LabPanel } from './panel';

const A = 'module.stasis_wheel';
const TW = 64;
const TH = 32;
const PAD = 12;
/** [label, slots holding a prisoner, slots with no slab at all, prisoners on their reserve]; every other slot holds an empty slab. */
const FILLS: readonly [string, readonly number[], readonly number[], boolean][] = [
  ['no slabs', [], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], false], ['stocked (10 empty)', [], [], false], ['3 held', [0, 3, 8], [], false],
  ['7 held, 2 gone', [0, 1, 2, 4, 6, 7, 9], [3, 5], false], ['3 on reserve (red pulses)', [0, 3, 8], [], true],
];

/** A sprite that shows `id(t)` each frame, placed by that frame's own anchor (and its glow). */
function playing(root: Container, atlas: Atlas, id: (t: number) => string, ox: number, oy: number): (t: number) => void {
  const spr = new Sprite();
  const glow = new Sprite();
  glow.blendMode = 'add';
  root.addChild(spr, glow);
  return (t) => {
    const s = atlas.stat(id(t));
    if (!s) return;
    const x = Math.round(ox - s.ax);
    const y = Math.round(oy - s.ay);
    Object.assign(spr, { texture: s.tex, x, y });
    glow.visible = !!s.glow;
    if (s.glow) Object.assign(glow, { texture: s.glow, x, y });
  };
}

/**
 * `?panel=stasis`: the stasis wheel (#116) at fill levels, stacked as the game draws it (the base, then each slot's slab
 * back to front, then the lit rim lamps), one row per rotation; then the slab on its hover cart per rotation (`&play` runs the ring loop); then
 * an empty slab as a floor stack and a full one set down on the floor along x and along y.
 * `rots=0,1,2,3` (default all).
 */
export const stasisPanel: LabPanel = {
  id: 'stasis',
  title: 'Stasis wheel',
  zoom: 2,
  help: 'rots=0,1,2,3 (default all); &play runs the hover cart loop',
  async cells({ atlas, params }) {
    const rots = (params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4)) ?? [0, 1, 2, 3];
    const ids = [...atlas.ids(A), ...atlas.ids('slab.'), 'item.stasis_slab.l'];
    ids.forEach((id) => atlas.stat(id));            // queue the sheets
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
      FILLS.forEach(([label, full, none, reserve], j) => {
        cells.push({
          label, note: `r${rot}`, w, h, newRow: j === 0,
          mount(root) {
            root.addChild(floor(3, 3, ox, oy));
            put(root, atlas, `${A}.r${rot}`, ox, oy);
            for (const i of slotOrder(rot)) if (!none.includes(i)) put(root, atlas, `${A}.slot${i}.r${rot}`, ox, oy);
            for (let i = 0; i < 10; i++) {
              if (none.includes(i)) continue;
              put(root, atlas, `${A}.lamp${i}.${full.includes(i) ? (reserve ? 'red' : 'cy') : 'amb'}.r${rot}`, ox, oy);
            }
            return () => {};
          },
        });
      });
    }
    const cw = 3 * TW + PAD * 2;
    const ch = 3 * TH + PAD * 2;
    rots.forEach((rot, j) => {
      cells.push({
        label: 'hover cart', note: `r${rot}, ${CART_FRAMES} frames`, w: cw, h: ch, newRow: j === 0, at: 0, loop: CART_FRAMES / CART_FPS,
        mount(root) {
          const x = Math.round(cw / 2);
          const y = ch - PAD - TH;
          root.addChild(floor(1, 2, x, y));
          const set = playing(root, atlas, (t) => cartFrame(rot, t * 1000), x, y);
          return (t) => set(t);
        },
      });
    });
    // Off the wheel and the cart: [label, sprite, tiles back along x, along y].
    const loose: readonly [string, string, number, number][] = [['empty slab (item)', 'item.stasis_slab.l', 1, 1], ['floor slab, along x', 'slab.floor.x', 2, 1], ['floor slab, along y', 'slab.floor.y', 1, 2]];
    loose.forEach(([label, id, fx, fy], j) => {
      cells.push({
        label, note: id, w: cw, h: ch, newRow: j === 0,
        mount(root) {
          const x = Math.round(cw / 2);
          const y = ch - PAD - TH;
          root.addChild(floor(fx, fy, x, y));
          put(root, atlas, id, x, y);
          return () => {};
        },
      });
    });
    return cells;
  },
};
