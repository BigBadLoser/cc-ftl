import { ART_SCALE } from './iso';
import { BlurFilter, Container, Rectangle, Sprite, type Renderer, type Texture } from 'pixi.js';

/** Art px of blur (sigma) baked into a halo texture; matches the old live filter at zoom 1. */
export const HALO_BLUR = 1.5 * ART_SCALE;
/** Transparent border added on every side so the blur is not clipped. */
export const HALO_PAD = 6 * ART_SCALE;

/** The live renderers that asked for halos, newest last: a renderer disposed while another is alive must not leave the bake with a dead one. */
const renderers: Renderer[] = [];
const cache = new WeakMap<Texture, Texture>();

/** Give the halo bake its renderer (Quality High only). */
export function initHalos(r: Renderer): void {
  renderers.push(r);
}

/** The renderer is going away: the bake falls back to the newest one still alive. */
export function releaseHalos(r: Renderer): void {
  const i = renderers.indexOf(r);
  if (i >= 0) renderers.splice(i, 1);
}

/** The pre-blurred, padded copy of a glow texture, baked on first use. Position it HALO_PAD px up-left of its glow. */
export function haloTex(glow: Texture): Texture {
  const hit = cache.get(glow);
  if (hit) return hit;
  const renderer = renderers[renderers.length - 1];
  if (!renderer) throw new Error('initHalos was not called');
  const w = glow.frame.width + 2 * HALO_PAD;
  const h = glow.frame.height + 2 * HALO_PAD;
  const src = new Sprite(glow);
  src.position.set(HALO_PAD, HALO_PAD);
  const box = new Container();
  box.addChild(src);
  box.filters = [new BlurFilter({ strength: HALO_BLUR, quality: 3 })];
  const tex = renderer.generateTexture({ target: box, frame: new Rectangle(0, 0, w, h), resolution: 1 });
  box.destroy({ children: true });
  cache.set(glow, tex);
  return tex;
}

/** Free the baked halo of a glow texture that is going away (its sheet was evicted). */
export function dropHalo(glow: Texture): void {
  const hit = cache.get(glow);
  if (!hit) return;
  cache.delete(glow);
  hit.destroy(true);
}

/** A glow's halo as an additive sprite for position (x, y) of the glow (x is the sprite origin; `flip` mirrors it). */
export function makeHalo(glow: Texture, x: number, y: number, flip = false): Sprite {
  const h = new Sprite(haloTex(glow));
  h.blendMode = 'add';
  h.position.set(flip ? x + HALO_PAD : x - HALO_PAD, y - HALO_PAD);
  if (flip) h.scale.x = -1;
  return h;
}
