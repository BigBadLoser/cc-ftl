import { Graphics, type Container } from 'pixi.js';
import type { Atlas } from './assets/loader';
import { ROOF_H } from './heights';
import { iso, TILE_H, TILE_W } from './iso';
import type { Layers } from './layers';
import { roofTile } from './roofArt';
import { addStatic } from './sprites';

/**
 * Solid cap of a thick hull block (`solidMass`): one flat plate at the wall view's top height (the roof plating art,
 * `roof.c*`, lowered), with plain dark side faces wherever the next tile in front is not part of the mass, so a
 * block of hull reads as one continuous mass with only its outer edges showing sides. The side faces are a PLACEHOLDER:
 * art id wanted `tile.hull.cap.side.e|s` (a 64x80 face to the +x / +y of a cap tile, hull plating).
 */
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
const SIDE_E = 0x1d2733;
const SIDE_S = 0x27384a;

/** Draw the cap of tile (x, y); `massAt` says whether a neighbour is cap too. Returns the display objects (all in `parent`, sorted by `key`). */
export function addHullCap(L: Layers, atlas: Atlas, x: number, y: number, key: number, massAt: (x: number, y: number) => boolean, height: number, parent: Container = L.sorted): Container[] {
  const out: Container[] = [];
  const g = new Graphics();
  const p = iso(x, y);
  const H = height;
  if (!massAt(x + 1, y)) g.poly([p.x + HALF_W, p.y - H, p.x, p.y + HALF_H - H, p.x, p.y + HALF_H, p.x + HALF_W, p.y]).fill(SIDE_E);
  if (!massAt(x, y + 1)) g.poly([p.x - HALF_W, p.y - H, p.x, p.y + HALF_H - H, p.x, p.y + HALF_H, p.x - HALF_W, p.y]).fill(SIDE_S);
  g.zIndex = key;
  parent.addChild(g);
  out.push(g);
  const plate = atlas.stat(roofTile(x, y).id) ?? atlas.stat('roof.c0b.00');
  if (plate) {
    const made = addStatic(L, plate, x, y, key + 0.0001, parent);
    for (const o of made) o.y += ROOF_H - H; // the roof plate is modelled at roof height: lower it to the level's top
    out.push(...made);
  }
  return out;
}

