import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import type { LabCell, LabPanel } from './panel';

/** The two bed sizes: asset id and footprint (width, depth) in tiles at r0. */
const SIZES: Record<string, { asset: string; fp: [number, number] }> = {
  small: { asset: 'module.hydroponics', fp: [2, 1] },
  large: { asset: 'module.hydroponics_large', fp: [3, 2] },
};
const CROPS = ['greens', 'beans', 'herbs', 'grain'];
const STAGES = ['sprout', 'grow', 'ripe'];

/** The bed's sprite, lit `<asset>.rN.on` or dark `<asset>.rN.off`, as the game's bed chain (render/moduleArt.ts). */
const bedId = (asset: string, rot: number, on: boolean): string => `${asset}.r${rot}.${on ? 'on' : 'off'}`;
const cropId = (asset: string, crop: string, stage: string, rot: number): string => `${asset}.crop.${crop}.${stage}.r${rot}`;

const TW = 64;
const TH = 32;
const PAD = 12;

/** Floor tiles under a w x h footprint, the sprite origin at the centre of the front-most tile (ox, oy). */
export function floor(w: number, h: number, ox: number, oy: number): Graphics {
  const g = new Graphics();
  for (let tx = 0; tx < w; tx++) {
    for (let ty = 0; ty < h; ty++) {
      const cx = ox + ((ty - tx) * TW) / 2;
      const cy = oy - ((tx + ty) * TH) / 2;
      g.poly([cx, cy - TH / 2, cx + TW / 2, cy, cx, cy + TH / 2, cx - TW / 2, cy]).fill(0x2a323a).stroke({ color: 0x3a444e, width: 1 });
    }
  }
  return g;
}

/** Draw the sprite `id` with its glow at the origin (ox, oy). */
export function put(root: Container, atlas: Atlas, id: string, ox: number, oy: number, tint = 0xffffff): void {
  const s = atlas.stat(id);
  if (!s) return;
  const x = Math.round(ox - s.ax);
  const y = Math.round(oy - s.ay);
  root.addChild(Object.assign(new Sprite(s.tex), { x, y, tint }));
  if (s.glow) {
    const g = Object.assign(new Sprite(s.glow), { x, y, tint });
    g.blendMode = 'add';
    root.addChild(g);
  }
}

/**
 * `?panel=hydroponics`: the grow beds (#59), each crop layer drawn over its lit bed as the game will stack them. One row
 * per size and rotation: the bed dark (`.off`) and lit (`.on`), then each crop at each stage. `sizes=small,large`,
 * `rots=0,1,2,3`, `crops=greens,beans,herbs,grain`, `stages=sprout,grow,ripe` (default ripe).
 */
export const hydroponicsPanel: LabPanel = {
  id: 'hydroponics',
  title: 'Hydroponics beds',
  zoom: 2,
  help: 'sizes=small,large rots=0,1,2,3 crops=greens,beans,herbs,grain stages=sprout,grow,ripe (default: both sizes, r0, ripe)',
  async cells({ atlas, params }) {
    const list = (k: string, all: string[], def: string[]): string[] =>
      (params.get(k)?.split(',').map((s) => s.trim()).filter((s) => all.includes(s)) ?? def);
    const sizes = list('sizes', Object.keys(SIZES), Object.keys(SIZES));
    const rots = list('rots', ['0', '1', '2', '3'], ['0']).map(Number);
    const crops = list('crops', CROPS, CROPS);
    const stages = list('stages', STAGES, ['ripe']);
    for (const size of sizes) atlas.ids((SIZES[size] as { asset: string }).asset).forEach((id) => atlas.stat(id)); // queue the sheet
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const size of sizes) {
      const { asset, fp } = SIZES[size] as { asset: string; fp: [number, number] };
      for (const rot of rots) {
        const [w, h] = rot % 2 === 0 ? fp : [fp[1], fp[0]];
        const cols: { label: string; ids: string[] }[] = [
          { label: 'off', ids: [bedId(asset, rot, false)] },
          { label: 'on', ids: [bedId(asset, rot, true)] },
          ...crops.flatMap((c) => stages.map((st) => ({ label: `${c} ${st}`, ids: [bedId(asset, rot, true), cropId(asset, c, st, rot)] }))),
        ];
        // one cell size per row, from the sprites' real bounds and the floor's, origin lined up across the row
        const st = cols.flatMap((c) => c.ids).map((id) => atlas.stat(id)).filter((s) => !!s);
        const left = Math.max((w * TW) / 2, ...st.map((s) => s.ax));
        const right = Math.max((h * TW) / 2, ...st.map((s) => s.tex.width - s.ax));
        const top = Math.max(((w + h - 1) * TH) / 2, ...st.map((s) => s.ay));
        const bottom = Math.max(TH / 2, ...st.map((s) => s.tex.height - s.ay));
        const cw = Math.ceil(left + right) + PAD * 2;
        const ch = Math.ceil(top + bottom) + PAD * 2;
        const ox = PAD + Math.round(left);
        const oy = PAD + Math.round(top);
        cols.forEach((col, i) => {
          cells.push({
            label: col.label,
            note: `${size} r${rot}`,
            w: cw,
            h: ch,
            newRow: i === 0,
            mount(root) {
              root.addChild(floor(w, h, ox, oy));
              for (const id of col.ids) put(root, atlas, id, ox, oy);
              return () => {};
            },
          });
        });
      }
    }
    return cells;
  },
};
