import { Graphics } from 'pixi.js';
import { CHUNK_SIZE, type Grid } from '../sim/grid';
import { Struct, STRUCT_MAX_HP } from '../sim/structure';
import type { Layers } from './layers';
import { ART_SCALE as S, iso } from './iso';
import { createChunkViews, regionTiles, type ChunkRef } from './regionTiles';
import { tileHash } from './tiles';

/** Walls and doors below this share of their integrity show cracks. */
const CRACK_BELOW = 0.7;

export interface DamageView {
  update(): void;
  dispose(): void;
}

/**
 * Crack overlay (Graphics, an allowed overlay) on damaged walls, one Graphics per sector chunk (step 5b), redrawn when
 * the chunk's integrity or struct (and its +x / +y neighbours') changes. `wallH` is the wall height now drawn.
 */
export function createDamageView(grid: Grid, L: Layers, wallH: () => number): DamageView {
  const tiles = regionTiles(grid);
  const chunks = createChunkViews<Graphics>((g) => g.destroy());
  let key = '';

  function draw(c: ChunkRef, old: Graphics | undefined): Graphics {
    const g = old ?? L.fx.addChild(new Graphics());
    g.clear();
    const struct = tiles.data('struct', c);
    const hp = tiles.data('hp', c);
    if (!struct || !hp) return g;
    const h = wallH();
    const r = tiles.chunkRect(c);
    for (let y = Math.max(0, r.y0); y < Math.min(tiles.height, r.y1); y++)
      for (let x = Math.max(0, r.x0); x < Math.min(tiles.width, r.x1); x++) {
        const ci = (y - r.y0) * CHUNK_SIZE + (x - r.x0);
        const kind = struct[ci];
        if (kind !== Struct.Wall && kind !== Struct.Door) continue;
        const ratio = (hp[ci] as number) / STRUCT_MAX_HP;
        if (ratio >= CRACK_BELOW) continue;
        // Hull tiles facing the camera are drawn as ghosts; no cracks on those.
        if (tiles.kindAt(x, y + 1) === Struct.Space || tiles.kindAt(x + 1, y) === Struct.Space) continue;
        const p = iso(x, y);
        const cy = p.y - Math.max(4 * S, h / 2);
        const hash = tileHash(x, y);
        const n = ratio < 0.25 ? 3 : ratio < 0.5 ? 2 : 1;
        for (let j = 0; j < n; j++) {
          const sx = p.x + (((hash >>> (j * 5)) % 19) - 9) * S;
          const sy = cy + (((hash >>> (j * 3 + 1)) % 9) - 4) * S;
          const dir = (hash >>> (j * 7)) & 1 ? 1 : -1;
          g.moveTo(sx, sy).lineTo(sx + dir * 3 * S, sy + 3 * S).lineTo(sx + dir * S, sy + 6 * S).lineTo(sx + dir * 5 * S, sy + 10 * S);
        }
      }
    g.stroke({ width: 1, color: 0x120c0c, alpha: 0.9, pixelLine: true });
    return g;
  }

  return {
    update() {
      const h = wallH();
      const k = `${grid.revision('hp')}|${grid.revision('struct')}|${h}`;
      if (k === key) return;
      key = k;
      chunks.sync(tiles.chunks(), (c) => `${tiles.rev('hp', c)}|${tiles.key('struct', c, 1)}|${h}`, draw);
    },
    dispose() {
      chunks.clear();
    },
  };
}
