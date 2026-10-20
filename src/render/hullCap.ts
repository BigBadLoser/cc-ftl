import { Graphics, type Container } from 'pixi.js';
import { ROOF_H, wallTopPx } from './heights';
import { iso, TILE_H, TILE_W } from './iso';
import type { Layers } from './layers';
import { touchesSpace, type CutawayMode, type KindAt } from './tiles';

/**
 * Fill of a thick hull block (`solidMass`: wall tiles in a 2x2 square of wall). The tiles keep their normal wall and hull
 * pieces; this only closes the sunken pits between the cross posts with the top the walls themselves have at the current
 * view level: the black cut face at the cut / low height, the wall top with the walls up, the hull plating colour on the
 * outer skin (full-height far hull). One flat diamond per tile at wall-top height, so neighbouring posts merge into one top.
 */
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
/** Top colours sampled from the wall art (tile.wall.m10 / tile.hull.m5). */
const CUT_TOP = 0x0c1415;
const HULL_TOP = 0x1e3a52;

/** Height in art px of a mass tile's top: the walls' own top at this view level, hull-top for the outer skin. */
export function massTop(kindAt: KindAt, x: number, y: number, mode: CutawayMode): number {
  return touchesSpace(kindAt, x, y) ? ROOF_H : wallTopPx(mode);
}

/** Draw the fill of tile (x, y), sorted just under the tile's own wall pieces. */
export function addMassTop(L: Layers, x: number, y: number, key: number, kindAt: KindAt, mode: CutawayMode, parent: Container = L.sorted): Container {
  const H = massTop(kindAt, x, y, mode);
  const p = iso(x, y);
  const g = new Graphics();
  g.poly([p.x, p.y - HALF_H - H, p.x + HALF_W, p.y - H, p.x, p.y + HALF_H - H, p.x - HALF_W, p.y - H]).fill(touchesSpace(kindAt, x, y) ? HULL_TOP : CUT_TOP);
  g.zIndex = key;
  parent.addChild(g);
  return g;
}
