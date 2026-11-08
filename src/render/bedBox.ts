import { Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { ART_SCALE as K, TILE_H, TILE_W } from './iso';
import { Z_PX } from './heights';

/**
 * PLACEHOLDER base for a hydroponics bed whose sheet is not in the manifest yet (the large bed): a low steel trough over the footprint, soil in the top,
 * a blue tank band on the near faces (lit when the bed runs). Anchored like a module sprite, at the footprint's front tile. Replaced as soon as the
 * manifest has the real ids.
 */
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const RIM_Z = 0.42;
const cache = new Map<string, StaticSprite>();

/** The trough sprite for a footprint `w` x `h` (rotation applied); `lit` while the bed runs. */
export function bedBox(w: number, h: number, lit: boolean): StaticSprite {
  const key = `${w}x${h}|${lit ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const Z = Math.round(RIM_Z * Z_PX);
  const N = { x: 0, y: -HH }, E = { x: w * HW, y: (w - 1) * HH }, S = { x: (w - h) * HW, y: (w + h - 1) * HH }, W = { x: -h * HW, y: (h - 1) * HH };
  const minX = W.x, minY = N.y - Z;
  const cv = document.createElement('canvas');
  cv.width = E.x - W.x + 2 * K;
  cv.height = S.y - minY + 2 * K;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  type P2 = { x: number; y: number };
  const P = (p: P2, up = 0): [number, number] => [p.x - minX + K, p.y - minY + K - up];
  const poly = (pts: [number, number][], fill: string): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = 'rgba(14,16,20,0.9)';
    g.lineWidth = K;
    g.stroke();
  };
  poly([P(W), P(S), P(S, Z), P(W, Z)], '#2c3440');
  poly([P(S), P(E), P(E, Z), P(S, Z)], '#3a4452');
  // The tank band low on both near faces.
  const band = lit ? '#3d8fd0' : '#26486a';
  poly([P(W, 3 * K), P(S, 3 * K), P(S, 9 * K), P(W, 9 * K)], band);
  poly([P(S, 3 * K), P(E, 3 * K), P(E, 9 * K), P(S, 9 * K)], band);
  poly([P(N, Z), P(E, Z), P(S, Z), P(W, Z)], '#4a5564');
  // The soil, inset a quarter tile from the rim.
  const lerp = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const c = { x: (N.x + S.x) / 2, y: (N.y + S.y) / 2 };
  const inset = (p: P2): P2 => lerp(p, c, 0.22);
  poly([P(inset(N), Z), P(inset(E), Z), P(inset(S), Z), P(inset(W), Z)], '#2a1c14');
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  const s: StaticSprite = { tex, glow: null, ax: (w - h) * HW - minX + K, ay: (w + h - 2) * HH - minY + K, footprint: [w, h] };
  cache.set(key, s);
  return s;
}
