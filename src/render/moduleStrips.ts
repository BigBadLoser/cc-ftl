import { Rectangle, Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { TILE_W } from './iso';

/** Width of a depth strip of a vehicle bay sprite: one footprint diagonal, half a tile wide each side of its centre line. */
export const STRIP_W = TILE_W / 2;
const stripCache = new WeakMap<Texture, Map<string, Texture>>();
/** Columns x0..x1 of a sheet frame as a texture of their own (cached: the animation re-cuts the same strips every loop). */
export function cut(tex: Texture, x0: number, x1: number): Texture {
  let m = stripCache.get(tex);
  if (!m) stripCache.set(tex, (m = new Map()));
  const k = `${x0}:${x1}`;
  let t = m.get(k);
  if (!t) m.set(k, (t = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + x0, tex.frame.y, x1 - x0, tex.frame.height) })));
  return t;
}

/** Columns x0..x1 of a frame that a depth strip shows, and the anchor x and width of the frame they were cut from. */
export interface StripCrop {
  x0: number;
  x1: number;
  ax: number;
  w: number;
}

/**
 * The textures a depth strip shows for another frame of its layer (an animation step, a flicker): the same columns of
 * the new frame. Null when the frame does not line up with the one the strip was cut from (another anchor or width):
 * the module is rebuilt then.
 */
export function stripFrame(s: StaticSprite, c: StripCrop): { tex: Texture; glow: Texture | null } | null {
  if (s.ax !== c.ax || s.tex.width !== c.w) return null;
  return { tex: cut(s.tex, c.x0, c.x1), glow: s.glow ? cut(s.glow, c.x0, c.x1) : null };
}
