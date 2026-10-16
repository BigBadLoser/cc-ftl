import { Texture } from 'pixi.js';

export interface DiamondTextures {
  /** Filled 64x32 diamond (white, tint it). */
  fill: Texture;
  /** 2 px outline of the 64x32 diamond. */
  outline: Texture;
  /** Small 32x16 outline used as a crew ring. */
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
      const edge = x < w / 2 - hw + 2 || x >= w / 2 + hw - 2;
      if (filled || edge || r === 0 || r === h - 1) set(x, r);
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
  c.width = 22;
  c.height = 11;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const img = g.createImageData(22, 11);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 22; x++) {
      const d = Math.hypot((x - 10.5) / 11, (y - 5) / 5.5);
      img.data[(y * 22 + x) * 4 + 3] = d < 1 ? (d < 0.62 ? 120 : 70) : 0;
    }
  g.putImageData(img, 0, 0);
  return nearest(c);
}

let cache: DiamondTextures | undefined;
export function diamondTextures(): DiamondTextures {
  cache ??= { fill: bake(32, true), outline: bake(32, false), ring: bake(16, false), shadow: bakeShadow() };
  return cache;
}
