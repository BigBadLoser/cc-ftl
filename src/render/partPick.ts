import type { Texture } from 'pixi.js';
import { ALPHA_MIN, opaqueAt } from './assets/alphaMask';

/** The part of a module sprite that picking needs. */
export interface PickPart {
  spr: { texture: Texture };
  rect: { x0: number; y0: number; x1: number; y1: number };
  key: number;
  flip: boolean;
}

/** Alpha channel of a sprite's frame, cut lazily from its sheet: the fallback for sheets with no kept mask (their bitmap is still open). */
const alphaCache = new WeakMap<Texture, Uint8ClampedArray | null>();
function alphaOf(tex: Texture): Uint8ClampedArray | null {
  if (alphaCache.has(tex)) return alphaCache.get(tex) ?? null;
  let out: Uint8ClampedArray | null = null;
  try {
    // The frame is in world px; the bitmap is in art px (a 1x sheet has resolution 0.5): cut and index it in art px.
    const r = tex.source.resolution ?? 1;
    const x = Math.round(tex.frame.x * r);
    const y = Math.round(tex.frame.y * r);
    const width = Math.round(tex.frame.width * r);
    const height = Math.round(tex.frame.height * r);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d', { willReadFrequently: true });
    const src = tex.source.resource as CanvasImageSource;
    if (g) {
      g.drawImage(src, x, y, width, height, 0, 0, width, height);
      const d = g.getImageData(0, 0, width, height).data;
      out = new Uint8ClampedArray(width * height);
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] as number;
    }
  } catch {
    out = null;
  }
  alphaCache.set(tex, out);
  return out;
}

/** True unless the pixel (u, v) of the sprite's frame is known to be transparent. */
function solid(tex: Texture, u: number, v: number): boolean {
  // (u, v) is in world px of the frame: one art px covers 1 / resolution of them.
  const r = tex.source.resolution ?? 1;
  const au = Math.floor(u * r);
  const av = Math.floor(v * r);
  const kept = opaqueAt(tex.source, Math.round(tex.frame.x * r) + au, Math.round(tex.frame.y * r) + av);
  if (kept !== null) return kept;
  const a = alphaOf(tex);
  return !a || (a[av * Math.round(tex.frame.width * r) + au] as number) >= ALPHA_MIN;
}

/** Entity whose topmost sprite is opaque at an art-px point, or null. */
export function pickParts(mods: Iterable<[number, { parts: readonly PickPart[] }]>, ax: number, ay: number): number | null {
  let best: number | null = null;
  let bestKey = -Infinity;
  for (const [id, e] of mods)
    for (const p of e.parts)
      if (ax >= p.rect.x0 && ax < p.rect.x1 && ay >= p.rect.y0 && ay < p.rect.y1 && p.key > bestKey) {
        const u = Math.floor(p.flip ? p.rect.x1 - ax : ax - p.rect.x0);
        const v = Math.floor(ay - p.rect.y0);
        if (!solid(p.spr.texture, u, v)) continue;
        bestKey = p.key;
        best = id;
      }
  return best;
}
