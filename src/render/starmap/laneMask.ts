/**
 * Lanes fade out toward the edges of the view, so long lanes leaving the sector do not crowd the frame: an elliptical gradient mask over
 * the view rectangle (the old SVG luminance mask: `--text` out to half the radius, then fading to `--panel-2`), as a sprite whose alpha
 * is that luminance. It is stretched over the view each time the camera moves.
 */
import { ImageSource, Sprite, Texture } from 'pixi.js';
import { tokenRgb } from './palette';
import type { View } from './kit';

const N = 128;
const lum = (c: readonly number[]) => (0.2125 * c[0]! + 0.7154 * c[1]! + 0.0721 * c[2]!) / 255;

export function createLaneMask(): { sprite: Sprite; fit(v: View): void; destroy(): void } {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const a = tokenRgb('--text');
  const b = tokenRgb('--panel-2');
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const d = Math.hypot((i + 0.5) / N - 0.5, (j + 0.5) / N - 0.5) / 0.5;
      const t = Math.max(0, Math.min(1, (d - 0.5) / 0.5));
      const L = lum(a) + (lum(b) - lum(a)) * t;
      const k = (j * N + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(L * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Not premultiplied: the mask reads the straight alpha, so the colour channels must not shrink with it a second time.
  const tex = new Texture({ source: new ImageSource({ resource: c, alphaMode: 'no-premultiply-alpha' }) });
  const sprite = new Sprite({ texture: tex, roundPixels: true });
  sprite.eventMode = 'none';
  return {
    sprite,
    fit(v) {
      sprite.position.set(v.x0, v.y0);
      sprite.width = v.x1 - v.x0;
      sprite.height = v.y1 - v.y0;
    },
    destroy() {
      sprite.destroy();
      tex.destroy(true);
    },
  };
}
