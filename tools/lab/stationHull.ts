import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { exteriorIds, hullKeys } from '../../src/render/hullArt';
import { TILE_H, TILE_W } from '../../src/render/iso';
import { bermId, lowId } from '../../src/render/stationHull';
import { HullSide, hullSide, wallPieces, type KindAt } from '../../src/render/tiles';
import { Struct } from '../../src/sim/structure';
import type { LabCell, LabPanel } from './panel';

const TW = TILE_W;
const TH = TILE_H;
const PAD = 16;
const TALL = 260;                                      // headroom over the hull, px
const LIVERY = 0xc8473c;                               // sample deco paint for the `.tint` layers

/** Draw sprite `id` anchored at (ox, oy); a `.tint` livery sprite is multiplied by the sample paint, the piece itself left unpainted. */
function put(root: Container, atlas: Atlas, id: string, ox: number, oy: number, paint = true): boolean {
  const s = atlas.stat(id);
  if (!s) return false;
  const x = Math.round(ox - s.ax), y = Math.round(oy - s.ay);
  root.addChild(Object.assign(new Sprite(s.tex), { x, y }));
  const t = atlas.stat(`${id}.tint`);
  if (paint && t) root.addChild(Object.assign(new Sprite(t.tex), { x: Math.round(ox - t.ax), y: Math.round(oy - t.ay), tint: LIVERY }));
  return true;
}

type Shape = (x: number, y: number) => number;
const box = (w: number, h: number): Shape => (x, y) => (x < 1 || y < 1 || x > w || y > h ? Struct.Space : x === 1 || y === 1 || x === w || y === h ? Struct.Wall : Struct.Floor);

/** Ground, then the base as the game draws it (hullArt.exteriorIds, stationHull.bermId / lowId, tiles.wallPieces), back to front. */
function scene(root: Container, atlas: Atlas, shape: Shape, W: number, H: number, mode: 'roof' | 'up', ox: number, oy: number, pick?: (id: string) => string): void {
  const sx = (x: number, y: number) => ox + ((x - y) * TW) / 2;
  const sy = (x: number, y: number) => oy + ((x + y) * TH) / 2;
  const kindAt: KindAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? Struct.Space : shape(x, y));
  const keys = hullKeys(kindAt, W, H)!;
  const has = (id: string) => !!atlas.stat(id);
  for (let d = 0; d <= W + H - 2; d++) for (let x = 0; x < W; x++) if (d - x >= 0 && d - x < H) put(root, atlas, `rock.ground.m15.v${(x * 5 + (d - x) * 3) % 8}`, sx(x, d - x), sy(x, d - x), false);
  for (let d = 0; d <= W + H - 2; d++)
    for (let x = 0; x < W; x++) {
      const y = d - x;
      if (y < 0 || y >= H) continue;
      const k = kindAt(x, y);
      if (k === Struct.Space) continue;
      const [cx, cy] = [sx(x, y), sy(x, y)];
      if (k === Struct.Floor) root.addChild(new Graphics().poly([cx - TW / 2, cy, cx, cy - TH / 2, cx + TW / 2, cy, cx, cy + TH / 2]).fill(0x1b222b));
      const berm = bermId(keys, x, y, has, mode === 'roof');
      if (mode === 'roof') {
        for (const id of exteriorIds(keys, x, y, has, false, null, 'station') ?? []) put(root, atlas, pick ? pick(id) : id, cx, cy);
      } else if (k === Struct.Wall && hullSide(kindAt, x, y) === HullSide.Near) {
        const foot = lowId(keys, x, y, has);
        if (foot) put(root, atlas, foot, cx, cy);
      } else if (k === Struct.Wall) {
        for (const p of wallPieces(kindAt, x, y, k, 'up', false, undefined, null, 'station')) {
          const id = p.chain.find(has);
          if (id) put(root, atlas, id, cx, cy);
        }
      }
      if (berm) put(root, atlas, berm, cx, cy, false);
    }
}

/**
 * `?panel=station-hull`: the ground base's station hull (#524): a straight run in the base design and in each design (.a1-.a6), an outer
 * corner and a whole roofed base, a diagonal front's generic piece, the berm along a run, and the walls-up far cap and near foot. The
 * `.tint` livery masks take a sample paint; the pieces themselves are unpainted, as in the game.
 */
export const stationHullPanel: LabPanel = {
  id: 'station-hull',
  title: 'Station hull (ground base)',
  zoom: 1,
  help: 'designs=a1,a3: only those straight-run designs',
  async cells({ atlas, params }) {
    atlas.ids('tile.hull.station.').forEach((id) => atlas.stat(id));
    atlas.ids('tile.roof.station.').forEach((id) => atlas.stat(id));
    atlas.ids('rock.ground.m15').forEach((id) => atlas.stat(id));
    await atlas.whenIdle();
    const only = params.get('designs')?.split(',');
    const cells: LabCell[] = [];
    const add = (label: string, note: string, shape: Shape, W: number, H: number, mode: 'roof' | 'up', newRow = false, pick?: (id: string) => string) =>
      cells.push({
        label, note, newRow, w: ((W + H) * TW) / 2 + PAD * 2, h: ((W + H) * TH) / 2 + TALL + PAD * 2,
        mount(root) { scene(root, atlas, shape, W, H, mode, PAD + (H * TW) / 2, PAD + TALL + TH / 2, pick); return () => {}; },
      });
    // A near run of x along the box's front, every tile in one design.
    const designs = ['base', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'].filter((d) => d === 'base' || !only || only.includes(d));
    designs.forEach((d, i) => add(`run: ${d}`, 'x run, 4 tiles, roofed', box(5, 3), 7, 5, 'roof', i === 0, (id) => (/\.o1\.m10(\.a\d)?$/.test(id) ? id.replace(/\.a\d$/, '') + (d === 'base' ? '' : `.${d}`) : id)));
    add('outer corner', 'roofed box 5x3', box(5, 3), 7, 5, 'roof', true);
    // A diagonal front's generic piece (`tile.hull.station.ext.g.<key>` and its roof) alone on the ground, with its berm where it has one.
    const DIAG = ['0_1_47~1_0_47~0_1_79~m1_0_47~m1_m1_31', '0_m1_47~m1_0_47~0_m1_79~1_0_47~1_1_31', '1_0_47~0_m1_47~1_0_79~0_1_47~m1_1_31'];
    cells.push({
      label: 'diagonal generic pieces', note: 'one tile each: ext.g + roof.g, berm', w: DIAG.length * TW * 1.5 + PAD * 2, h: TH * 2 + TALL + PAD * 2,
      mount(root) {
        DIAG.forEach((k, i) => {
          const [cx, cy] = [PAD + TW / 2 + i * TW * 1.5, PAD + TALL + TH / 2];
          put(root, atlas, `rock.ground.m15.v${i}`, cx, cy, false);
          for (const id of [`tile.hull.station.ext.g.${k}`, `tile.roof.station.g.${k}`]) put(root, atlas, id, cx, cy);
          for (const id of atlas.ids(`tile.hull.station.berm.${k}.v0`).slice(0, 1)) put(root, atlas, id, cx, cy, false);
        });
        return () => {};
      },
    });
    add('berm on a run', 'walls up, near run', box(7, 3), 9, 5, 'up', true);
    add('walls up: cap and foot', 'far cap, near foot, berm', box(5, 4), 7, 6, 'up');
    return cells;
  },
};
