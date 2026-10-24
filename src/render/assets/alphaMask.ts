/**
 * Click-picking needs to know where a sprite is opaque, but the loader closes a sheet's decoded bitmap once it is on the
 * GPU. So before closing, the sheets that host pickable sprites keep a 1-bit-per-pixel opacity mask (1/32 of the decoded
 * RGBA size). The mask is keyed by the texture source and dropped with it when the sheet is evicted.
 */
export const ALPHA_MIN = 40;
const STRIP = 256;

export interface AlphaMask {
  w: number;
  h: number;
  bits: Uint8Array;
}

const masks = new WeakMap<object, AlphaMask>();

type Ctx = { clearRect(x: number, y: number, w: number, h: number): void; drawImage(...a: unknown[]): void; getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> } };
type CtxFactory = (w: number, h: number) => Ctx | null;

function defaultCtx(w: number, h: number): Ctx | null {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c.getContext('2d', { willReadFrequently: true }) as unknown as Ctx | null;
}

/** Opacity bits (alpha >= ALPHA_MIN) of an image, read in strips so the temporary RGBA stays small. Null if it cannot be read. */
export function buildMask(src: unknown, w: number, h: number, mk: CtxFactory = defaultCtx): AlphaMask | null {
  try {
    const g = mk(w, Math.min(STRIP, h));
    if (!g) return null;
    const bits = new Uint8Array(Math.ceil((w * h) / 8));
    for (let y0 = 0; y0 < h; y0 += STRIP) {
      const sh = Math.min(STRIP, h - y0);
      g.clearRect(0, 0, w, sh);
      g.drawImage(src, 0, y0, w, sh, 0, 0, w, sh);
      const d = g.getImageData(0, 0, w, sh).data;
      for (let i = 0, n = w * sh; i < n; i++) {
        if ((d[i * 4 + 3] as number) >= ALPHA_MIN) {
          const p = y0 * w + i;
          bits[p >> 3] = (bits[p >> 3] as number) | (1 << (p & 7));
        }
      }
    }
    return { w, h, bits };
  } catch {
    return null;
  }
}

export function keepMask(source: object, m: AlphaMask): void {
  masks.set(source, m);
}

/** Opacity of pixel (x, y) of a texture source's sheet; null when no mask was kept for it. */
export function opaqueAt(source: object, x: number, y: number): boolean | null {
  const m = masks.get(source);
  if (!m) return null;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const p = y * m.w + x;
  return ((m.bits[p >> 3] as number) & (1 << (p & 7))) !== 0;
}
