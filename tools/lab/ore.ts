import { Graphics, Sprite, type Container } from 'pixi.js';
import { content } from '../../src/content';
import type { Atlas } from '../../src/render/assets/loader';
import { massChain, oreTileId } from '../../src/render/asteroidView';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 14;
const PATCH = 4;                                       // rock patch: PATCH x PATCH ore tiles
const BINS: Record<string, [number, number]> = { 'module.storage_ore': [2, 2], 'module.storage_ore_large': [3, 2] };
const FILLS = ['empty', 'fill1', 'fill2', 'full'];

/** A dark floor diamond per tile of a w x h footprint, its front-most tile centred on (ox, oy). */
function floor(w: number, h: number, ox: number, oy: number): Graphics {
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

/** Draw the first existing sprite of `ids`, with its glow, anchored at (ox, oy). */
function put(root: Container, atlas: Atlas, ids: readonly string[], ox: number, oy: number): void {
  const s = atlas.firstOf(ids);
  if (!s) return;
  const x = Math.round(ox - s.ax);
  const y = Math.round(oy - s.ay);
  root.addChild(Object.assign(new Sprite(s.tex), { x, y }));
  if (s.glow) {
    const g = Object.assign(new Sprite(s.glow), { x, y });
    g.blendMode = 'add';
    root.addChild(g);
  }
}

/** A cell of size w x h drawing `draw(root)`. */
const cell = (label: string, note: string, w: number, h: number, newRow: boolean, draw: (root: Container) => void): LabCell => ({
  label, note, w, h, newRow, mount(root) { draw(root); return () => {}; },
});

/**
 * `?panel=ore`: an ore's art on its own. Per ore (`ores=ore.crystal,ore.rare`, default the energy crystal): its item at each
 * stack size and held; a PATCH x PATCH block of rich and of thin rock tiles (ids from asteroidView's `massChain` and
 * `oreTileId`, so the edges take the game's masks) and a lone tile of each; then each ore bin size at every fill
 * (`rots=0,1,2,3`, default r0), the bin's kind from its def's `storageArt`.
 */
export const orePanel: LabPanel = {
  id: 'ore',
  title: 'Ore art: items, rock tiles, bins',
  zoom: 1,
  help: 'ores=ore.crystal,ore.rare,ore.iron,ore.ice (default ore.crystal) rots=0,1,2,3 (default 0)',
  async cells({ atlas, params }) {
    const all = Object.keys(content.ores);
    const ores = params.get('ores')?.split(',').map((s) => s.trim()).filter((s) => all.includes(s)) ?? ['ore.crystal'];
    const rots = (params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4) ?? [0]);
    for (const p of ['item.', 'rock.', 'module.storage_ore']) atlas.ids(p).forEach((id) => atlas.stat(id)); // queue the sheets
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const oreId of ores) {
      const item = (content.ores as Record<string, { item: string }>)[oreId]?.item ?? '';
      ['s', 'm', 'l', 'held'].forEach((size, i) => {
        cells.push(cell(size, item, 150, 110, i === 0, (root) => {
          root.addChild(floor(1, 1, 75, 86));
          put(root, atlas, [`${item}.${size}`], 75, 86);
        }));
      });
      const pw = PATCH * TW + PAD * 2;
      const ph = PATCH * TH + 116 + PAD * 2;
      [true, false].forEach((rich, i) => {
        const stem = oreTileId(oreId, rich);
        cells.push(cell(`${PATCH}x${PATCH} ${rich ? 'rich' : 'thin'}`, stem, pw, ph, i === 0, (root) => {
          const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < PATCH && y < PATCH;
          const ox = pw / 2;
          const oy = ph - PAD - (PATCH * TH);
          for (let d = 0; d <= 2 * (PATCH - 1); d++) {
            for (let x = 0; x < PATCH; x++) {
              const y = d - x;
              if (!inside(x, y)) continue;
              put(root, atlas, massChain((dx, dy) => inside(x + dx, y + dy), x, y, stem), ox + ((x - y) * TW) / 2, oy + ((x + y) * TH) / 2);
            }
          }
        }));
        cells.push(cell(`lone ${rich ? 'rich' : 'thin'}`, stem, 160, 140, false, (root) => {
          put(root, atlas, massChain(() => false, 0, 0, stem), 80, 120);
        }));
      });
      const kind = Object.entries(BINS).map(([asset]) => (content.modules as Record<string, { storageArt?: Record<string, string> }>)[asset]?.storageArt?.[item]);
      Object.entries(BINS).forEach(([asset, fp], b) => {
        if (kind[b] === undefined) return;
        for (const rot of rots) {
          const [w, h] = rot % 2 === 0 ? fp : [fp[1], fp[0]];
          const ids = (fill: string): string[] => {
            const state = fill === 'empty' ? 'empty' : `${kind[b]}.${fill}`;
            return [`${asset}.r${rot}.${state}`, `${asset}.${state}`];
          };
          // one cell size per row from the sprites' real bounds and the floor's, the origin lined up across the row
          const st = FILLS.map((f) => atlas.firstOf(ids(f))).filter((x) => !!x);
          const left = Math.max((w * TW) / 2, ...st.map((x) => x.ax));
          const right = Math.max((h * TW) / 2, ...st.map((x) => x.tex.width - x.ax));
          const top = Math.max(((w + h - 1) * TH) / 2, ...st.map((x) => x.ay));
          const bottom = Math.max(TH / 2, ...st.map((x) => x.tex.height - x.ay));
          const cw = Math.ceil(left + right) + PAD * 2;
          const ch = Math.ceil(top + bottom) + PAD * 2;
          const ox = PAD + Math.round(left);
          const oy = PAD + Math.round(top);
          FILLS.forEach((fill, i) => {
            cells.push(cell(`${fill}`, `${asset} r${rot}`, cw, ch, i === 0, (root) => {
              root.addChild(floor(w, h, ox, oy));
              put(root, atlas, ids(fill), ox, oy);
            }));
          });
        }
      });
    }
    return cells;
  },
};
