import { Texture } from 'pixi.js';
import { ART_SCALE as S, TILE_H } from './iso';

export interface DiamondTextures {
  /** Filled tile-sized diamond (white, tint it). */
  fill: Texture;
  /** 2 art-px outline of the tile diamond. */
  outline: Texture;
  /** Half-tile outline used as a crew ring. */
  ring: Texture;
  /** Soft blob shadow under crew. */
  shadow: Texture;
}

/** Pixel-stepped 2:1 diamond: half-width at row r is 2 * (distance from the nearer end + 1). */
function bake(h: number, filled: boolean): Texture {
  const w = h * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const img = g.createImageData(w, h);
  const set = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    img.data.fill(255, i, i + 4);
  };
  for (let r = 0; r < h; r++) {
    const hw = 2 * (Math.min(r, h - 1 - r) + 1);
    for (let x = w / 2 - hw; x < w / 2 + hw; x++) {
      const edge = x < w / 2 - hw + 2 * S || x >= w / 2 + hw - 2 * S;
      if (filled || edge || r < S || r >= h - S) set(x, r);
    }
  }
  g.putImageData(img, 0, 0);
  return nearest(c);
}

function nearest(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

function bakeShadow(): Texture {
  const c = document.createElement('canvas');
  const W = 22 * S, H = 11 * S;
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - (W - 1) / 2) / (W / 2), (y - (H - 1) / 2) / (H / 2));
      img.data[(y * W + x) * 4 + 3] = d < 1 ? (d < 0.62 ? 120 : 70) : 0;
    }
  g.putImageData(img, 0, 0);
  return nearest(c);
}

let cache: DiamondTextures | undefined;
export function diamondTextures(): DiamondTextures {
  cache ??= { fill: bake(TILE_H, true), outline: bake(TILE_H, false), ring: bake(TILE_H / 2, false), shadow: bakeShadow() };
  return cache;
}
