import { Graphics } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct, STRUCT_MAX_HP } from '../sim/structure';
import type { Layers } from './layers';
import { iso } from './iso';
import { tileHash } from './tiles';

/** Walls and doors below this share of their integrity show cracks. */
const CRACK_BELOW = 0.7;

export interface DamageView {
  update(): void;
  dispose(): void;
}

/** Crack overlay (Graphics, an allowed overlay) on damaged walls; redrawn when integrity changes. `wallH` is the wall height now drawn. */
export function createDamageView(grid: Grid, L: Layers, wallH: () => number): DamageView {
  const g = new Graphics();
  L.fx.addChild(g);
  let key = '';
  return {
    update() {
      const h = wallH();
      const k = `${grid.revision('hp')}|${grid.revision('struct')}|${h}`;
      if (k === key) return;
      key = k;
      g.clear();
      const struct = grid.raw('struct');
      const hp = grid.raw('hp');
      const w = grid.width;
      for (let i = 0; i < struct.length; i++) {
        const kind = struct[i];
        if (kind !== Struct.Wall && kind !== Struct.Door) continue;
        const r = (hp[i] as number) / STRUCT_MAX_HP;
        if (r >= CRACK_BELOW) continue;
        const x = i % w;
        const y = (i - x) / w;
        // Hull tiles facing the camera are drawn as ghosts; no cracks on those.
        if ((y + 1 < grid.height ? struct[i + w] : Struct.Space) === Struct.Space || (x + 1 < w ? struct[i + 1] : Struct.Space) === Struct.Space) continue;
        const p = iso(x, y);
        const cy = p.y - Math.max(4, h / 2);
        const hash = tileHash(x, y);
        const n = r < 0.25 ? 3 : r < 0.5 ? 2 : 1;
        for (let j = 0; j < n; j++) {
          const sx = p.x + ((hash >>> (j * 5)) % 19) - 9;
          const sy = cy + ((hash >>> (j * 3 + 1)) % 9) - 4;
          const dir = (hash >>> (j * 7)) & 1 ? 1 : -1;
          g.moveTo(sx, sy).lineTo(sx + dir * 3, sy + 3).lineTo(sx + dir * 1, sy + 6).lineTo(sx + dir * 5, sy + 10);
        }
      }
      g.stroke({ width: 1, color: 0x120c0c, alpha: 0.9, pixelLine: true });
    },
    dispose() {
      g.destroy();
    },
  };
}
