import { Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { CarpetSprite } from '../../src/render/carpetPaint';
import { carpetPaintFor } from '../../src/render/hullArt';
import { mulColor } from '../../src/render/lightTint';
import { SCHEME_NAMES } from '../../src/render/roofArt';
import { floorChain } from '../../src/render/tiles';
import { Finish } from '../../src/sim/structure';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 12;

/** An n x n patch of floor tiles as gridView lays them: `floorChain` picks each tile's sprite, a carpet takes `paint` (times `light`). */
function patch(root: Container, atlas: Atlas, n: number, finish: number, paint: number, light = 0xffffff): void {
  const ox = PAD + (n * TW) / 2;
  const oy = PAD + TH / 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const s = atlas.firstOf(floorChain(x, y, finish));
      if (!s) continue;
      const carpet = finish === Finish.Carpet && s === atlas.stat('tile.floor.carpet');
      const spr = carpet ? new CarpetSprite(s.tex) : new Sprite(s.tex);
      spr.tint = carpet ? mulColor(light, paint) : light;
      spr.position.set(Math.round(ox + ((x - y) * TW) / 2 - s.ax), Math.round(oy + ((x + y) * TH) / 2 - s.ay));
      root.addChild(spr);
    }
}

const size = (n: number) => ({ w: n * TW + PAD * 2, h: n * TH + PAD * 2 });

/** The scheme names shown for the carpet: the lab's sample of liveries, from a light P to a near-black one. */
const SAMPLE = ['', 'crimson', 'tide', 'orchid', 'verdant', 'hornet', 'glacier', 'sovereign', 'velvet', 'combine'];

/**
 * `?panel=floor-finishes`: the floor finishes as the game draws them: each of the plain deck, heavy
 * plate, clean tile and carpet as a 3x3 and an 8x8 patch; then the carpet as a 3x3 under a sample of livery schemes (`schemes=`,
 * default a sample; '' is no livery) and under dimmed light (the light still multiplies in), and an 8x8 under two schemes.
 */
export const floorFinishesPanel: LabPanel = {
  id: 'floor-finishes',
  title: 'Floor finishes: heavy, clean, carpet',
  zoom: 1,
  help: 'schemes=crimson,tide,sovereign (the carpet\'s livery schemes; default a sample, "none" for no livery)',
  async cells({ atlas, params }) {
    atlas.ids('tile.floor.').forEach((id) => atlas.stat(id));
    await atlas.whenIdle();
    const wanted = params.get('schemes')?.split(',').map((s) => (s === 'none' ? '' : s.trim()));
    const schemes = (wanted ?? SAMPLE).filter((s) => s === '' || SCHEME_NAMES.includes(s));
    const cells: LabCell[] = [];
    const add = (label: string, note: string, n: number, finish: number, paint: number, newRow: boolean, light = 0xffffff): void => {
      cells.push({ label, note, ...size(n), newRow, mount: (root) => (patch(root, atlas, n, finish, paint, light), () => {}) });
    };
    const plain = carpetPaintFor('');
    const finishes = [['plain deck', Finish.Plain], ['heavy plate', Finish.Heavy], ['clean tile', Finish.Clean], ['carpet (no livery)', Finish.Carpet]] as const;
    finishes.forEach(([name, f], i) => add(name, '3x3', 3, f, plain, i === 0));
    finishes.forEach(([name, f], i) => add(name, '8x8', 8, f, plain, i === 0));
    schemes.forEach((s, i) => add(`carpet: ${s || 'no livery'}`, `#${carpetPaintFor(s).toString(16).padStart(6, '0')}`, 3, Finish.Carpet, carpetPaintFor(s), i === 0));
    add('carpet, dim light', 'light 0x808080', 3, Finish.Carpet, plain, true, 0x808080);
    add('carpet, dark light', 'light 0x404040', 3, Finish.Carpet, plain, false, 0x404040);
    ['crimson', 'sovereign'].forEach((s, i) => add(`carpet 8x8: ${s}`, '', 8, Finish.Carpet, carpetPaintFor(s), i === 0));
    return cells;
  },
};
