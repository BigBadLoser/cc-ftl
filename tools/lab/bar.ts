import { Sprite } from 'pixi.js';
import { iso } from '../../src/render/iso';
import type { LabCell, LabCtx, LabPanel } from './panel';

const COUNTER = 'module.bar_counter';
const SHORT = 'module.bar_counter_short';
const CORNER = 'module.bar_corner';
const STOOL = 'module.bar_stool';
const ALL = [COUNTER, SHORT, CORNER, STOOL];

/** Sprite drawn with its anchor at the front-most tile of its footprint, whose tile is (gx, gy) in the lab's grid. */
function put(ctx: LabCtx, root: import('pixi.js').Container, id: string, ox: number, oy: number, gx: number, gy: number): void {
  const s = ctx.atlas.stat(id);
  if (!s) return;
  const p = iso(gx, gy);
  root.addChild(Object.assign(new Sprite(s.tex), { x: Math.round(ox + p.x - s.ax), y: Math.round(oy + p.y - s.ay) }));
}

function floor(ctx: LabCtx, root: import('pixi.js').Container, ox: number, oy: number, x0: number, x1: number, y0: number, y1: number): void {
  const f = ctx.atlas.stat('tile.floor.a');
  if (!f) return;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const p = iso(gx, gy);
    root.addChild(Object.assign(new Sprite(f.tex), { x: ox + p.x - f.ax, y: oy + p.y - f.ay }));
  }
}

/**
 * `?panel=bar`: the bar counter pieces and the bar stool (#441) at four rotations each, then one L assembled from a
 * 3x1 counter, the corner and a 2x1 turned, with stools in front. Art only: the sprite anchor is the front-most tile.
 * `rots=0,1,2,3` (default all).
 */
export const barPanel: LabPanel = {
  id: 'bar',
  title: 'Bar furniture',
  zoom: 1,
  help: 'rots=0,1,2,3 (default all): counter, short counter, corner, stool, then an L with stools',
  async cells(ctx) {
    const rots = (ctx.params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4)) ?? [0, 1, 2, 3];
    for (const id of ALL) for (let r = 0; r < 4; r++) ctx.atlas.stat(`${id}.r${r}`);
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const id of ALL) {
      rots.forEach((rot, i) => cells.push({
        label: `${id.replace('module.', '')} r${rot}`,
        w: 340,
        h: 200,
        newRow: i === 0,
        mount(root) {
          const ox = 200, oy = 120;
          floor(ctx, root, ox, oy, -2, 1, -2, 1);
          put(ctx, root, `${id}.r${rot}`, ox, oy, 0, 0);
          return () => {};
        },
      }));
    }
    // The L at r0: the 3x1 along u with its padded face on +v, the corner at its right end, the 2x1 turned (r1)
    // running back along v from the corner; stools on the customer side. Front-most tiles are the anchors.
    cells.push({
      label: 'L: 3x1 + corner + 2x1 r1, stools in front',
      w: 560,
      h: 380,
      newRow: true,
      mount(root) {
        const ox = 250, oy = 100;
        floor(ctx, root, ox, oy, -1, 5, -1, 4);
        // Back-to-front draw order: arm, corner, straight, stools.
        put(ctx, root, `${SHORT}.r1`, ox, oy, 3, 1);
        put(ctx, root, `${CORNER}.r0`, ox, oy, 3, 2);
        put(ctx, root, `${COUNTER}.r0`, ox, oy, 2, 2);
        for (const gx of [0, 1, 2]) put(ctx, root, `${STOOL}.r0`, ox, oy, gx, 3);
        return () => {};
      },
    });
    return cells;
  },
};
