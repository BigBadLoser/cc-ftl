import { Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { tubePieces, type TubeLook } from '../../src/render/tubeArt';
import type { WallLevel } from '../../src/render/tiles';
import type { TubeRun } from '../../src/sim/tube';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 16;
const TALL = 140;                                      // headroom over the run for the hull row and ports, px

/** Draw the first existing sprite of `ids`, with its glow, anchored at (ox, oy). */
function put(root: Container, atlas: Atlas, id: string, ox: number, oy: number): void {
  const s = atlas.stat(id);
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

/** A run of `len` floor tiles along `axis` from (2, 2), its far door at (1, 2) or (2, 1). */
const run = (axis: 'x' | 'y', len: number): TubeRun => {
  const dx = axis === 'x' ? 1 : 0, dy = 1 - dx;
  return { axis, x: 2, y: 2, len, far: { x: 2 - dx, y: 2 - dy }, near: { x: 2 + dx * len, y: 2 + dy * len } };
};

/** Ground under the patch, then the run's pieces (tubeArt.tubePieces) in the game's depth order: tile depth plus the piece's `dz`. */
function scene(root: Container, atlas: Atlas, r: TubeRun, look: TubeLook, ox: number, oy: number, w: number, h: number): void {
  const sx = (x: number, y: number) => ox + ((x - y) * TW) / 2;
  const sy = (x: number, y: number) => oy + ((x + y) * TH) / 2;
  for (let d = 0; d <= w + h - 2; d++) for (let x = 0; x < w; x++) if (d - x >= 0 && d - x < h) put(root, atlas, `rock.ground.m15.v${(x * 5 + (d - x) * 3) % 8}`, sx(x, d - x), sy(x, d - x));
  const pieces = tubePieces(r, look).map((p, i) => ({ ...p, i })).sort((a, b) => a.x + a.y + a.dz - (b.x + b.y + b.dz) || a.i - b.i);
  for (const p of pieces) put(root, atlas, p.id, sx(p.x, p.y), sy(p.x, p.y));
}

/**
 * `?panel=tube`: the prefab base tube (#508) as tubeArt picks its sprites, on asteroid ground with no module walls round it:
 * x and y runs one, three and five tiles long with both doors shut and both open, at each wall view level, and roofed (the
 * hull row full height, no junction). The hull row is unpainted here (the game paints it with the hull's colours).
 */
export const tubePanel: LabPanel = {
  id: 'tube',
  title: 'Prefab base tube',
  zoom: 1,
  help: 'no options',
  async cells({ atlas }) {
    for (const p of ['tube.', 'rock.ground.m15']) atlas.ids(p).forEach((id) => atlas.stat(id)); // queue the sheets
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    const looks: [string, TubeLook][] = [
      ['shut, cut', { level: 'cut', roofed: false, farOpen: false, nearOpen: false }],
      ['open, cut', { level: 'cut', roofed: false, farOpen: true, nearOpen: true }],
      ...(['up', 'low'] as WallLevel[]).map((level): [string, TubeLook] => [`shut, ${level}`, { level, roofed: false, farOpen: false, nearOpen: false }]),
      ['roofed', { level: 'up', roofed: true, farOpen: false, nearOpen: false }],
    ];
    for (const axis of ['x', 'y'] as const)
      for (const len of [1, 3, 5])
        looks.forEach(([name, look], i) => {
          const r = run(axis, len);
          const w = axis === 'x' ? len + 4 : 5, h = axis === 'y' ? len + 4 : 5;
          const cw = ((w + h) * TW) / 2 + PAD * 2, ch = ((w + h) * TH) / 2 + TALL + PAD * 2;
          cells.push({
            label: `${axis} ${len}: ${name}`, note: `far door ${r.far.x},${r.far.y}, near ${r.near.x},${r.near.y}`, w: cw, h: ch, newRow: i === 0,
            mount(root) { scene(root, atlas, r, look, PAD + (h * TW) / 2, PAD + TALL + TH / 2, w, h); return () => {}; },
          });
        });
    return cells;
  },
};
