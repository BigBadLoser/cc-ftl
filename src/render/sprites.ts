import { Sprite, type Container } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import type { Layers } from './layers';
import { iso } from './iso';
import { makeHalo } from './haloTex';

/**
 * Place a static asset so its anchor sits on tile (gx, gy)'s floor centre (front-most footprint tile).
 * Glow goes in the same parent with additive blending, just above the sprite. Returns every created display object.
 */
export function addStatic(L: Layers, s: StaticSprite, gx: number, gy: number, key: number, parent: Container = L.sorted): Sprite[] {
  const p = iso(gx, gy);
  const x = Math.round(p.x - s.ax);
  const y = Math.round(p.y - s.ay);
  const spr = new Sprite(s.tex);
  spr.position.set(x, y);
  spr.zIndex = key;
  parent.addChild(spr);
  const out = [spr];
  if (s.glow) {
    const g = new Sprite(s.glow);
    g.blendMode = 'add';
    g.position.set(x, y);
    g.zIndex = key + 0.01;
    parent.addChild(g);
    out.push(g);
    if (L.halos) {
      const h = makeHalo(s.glow, x, y);
      h.zIndex = key + 0.015;
      parent.addChild(h);
      out.push(h);
    }
  }
  return out;
}
