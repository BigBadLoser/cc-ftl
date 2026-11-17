import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { CABLE_FITTINGS, cableTileId, type CableSide } from '../../src/render/groundCable';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 16;
const WALL_H = 44;                                     // stand-in module block height, px

/** A test layout: `=` cable, `#` a module (a stand-in block the cable plugs into), anything else bare ground. */
const NETWORK = [
  '.............',
  '.###.....###.',
  '.###=====###.',
  '.###..=..###.',
  '......=......',
  '..=======....',
  '..=...=......',
  '..=...=====..',
  '..=..........',
  '.............',
];

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

/** A stand-in module block on the tile centred at (cx, cy): debug drawing, not art. */
function block(root: Container, cx: number, cy: number): void {
  const g = new Graphics();
  const t = cy - WALL_H;
  g.poly([cx - TW / 2, cy, cx, cy + TH / 2, cx, t + TH / 2, cx - TW / 2, t]).fill(0x3c4f5c);
  g.poly([cx + TW / 2, cy, cx, cy + TH / 2, cx, t + TH / 2, cx + TW / 2, t]).fill(0x2b3a44);
  g.poly([cx, t - TH / 2, cx + TW / 2, t, cx, t + TH / 2, cx - TW / 2, t]).fill(0x587384);
  root.addChild(g);
}

/** Ground under every tile of a w x h patch, then the cables and blocks of `rows`, back to front. */
function scene(root: Container, atlas: Atlas, rows: readonly string[], powered: boolean, ox: number, oy: number): void {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
  const sx = (x: number, y: number) => ox + ((x - y) * TW) / 2;
  const sy = (x: number, y: number) => oy + ((x + y) * TH) / 2;
  const order: [number, number][] = [];
  for (let d = 0; d <= w + h - 2; d++) for (let x = 0; x < w; x++) if (d - x >= 0 && d - x < h) order.push([x, d - x]);
  for (const [x, y] of order) put(root, atlas, [`rock.ground.m15.v${(x * 5 + y * 3) % 8}`, 'rock.ground.m15.v0'], sx(x, y), sy(x, y));
  for (const [x, y] of order) {
    const c = at(x, y);
    if (c === '#') block(root, sx(x, y), sy(x, y));
    else if (c === '=') {
      const side = (dx: number, dy: number): CableSide => (at(x + dx, y + dy) === '=' ? 'cable' : at(x + dx, y + dy) === '#' ? 'wall' : null);
      put(root, atlas, [cableTileId(side, x, y, powered)], sx(x, y), sy(x, y));
    }
  }
}

/** A cell of size w x h drawing `draw(root)`. */
const cell = (label: string, note: string, w: number, h: number, newRow: boolean, draw: (root: Container) => void): LabCell => ({
  label, note, w, h, newRow, mount(root) { draw(root); return () => {}; },
});

/** A lone sprite on a ground tile. */
const lone = (atlas: Atlas, id: string, newRow: boolean): LabCell =>
  cell(id.replace('cable.duct.', ''), id, 120, 100, newRow, (root) => {
    put(root, atlas, ['rock.ground.m15.v0'], 60, 64);
    put(root, atlas, [id], 60, 64);
  });

/**
 * `?panel=cable`: the ground power cable (#514) on asteroid ground, its ids from `cableTileId` as the game will pick them:
 * a test network (straights, corners, tees, a cross, dead ends, sockets into stand-in module blocks) powered and
 * unpowered, then every connection mask on its own and every straight fitting on both axes.
 */
export const cablePanel: LabPanel = {
  id: 'cable',
  title: 'Ground power cable',
  zoom: 1,
  help: 'no options',
  async cells({ atlas }) {
    for (const p of ['cable.', 'rock.ground.m15']) atlas.ids(p).forEach((id) => atlas.stat(id)); // queue the sheets
    await atlas.whenIdle();
    const h = NETWORK.length;
    const w = Math.max(...NETWORK.map((r) => r.length));
    const cw = ((w + h) * TW) / 2 + PAD * 2;
    const ch = ((w + h) * TH) / 2 + WALL_H + PAD * 2;
    const ox = PAD + (h * TW) / 2;
    const oy = PAD + WALL_H + TH / 2;
    const cells: LabCell[] = [true, false].map((powered, i) =>
      cell(powered ? 'network, powered' : 'network, unpowered', 'stand-in blocks are modules', cw, ch, i === 0, (root) =>
        scene(root, atlas, NETWORK, powered, ox, oy)));
    for (let m = 0; m < 16; m++) cells.push(lone(atlas, `cable.duct.m${m}`, m === 0));
    for (const m of [10, 5]) for (let v = 1; v <= CABLE_FITTINGS; v++) cells.push(lone(atlas, `cable.duct.m${m}.v${v}`, v === 1));
    return cells;
  },
};
