/**
 * The loader closes a sheet's decoded bitmap once it is on the GPU. The roof damage art (roofDamage/view.ts) composes from
 * the roof sheet's plating and structure on the CPU, so that sheet keeps its RGBA here, keyed by its texture source and
 * dropped with it when the sheet is evicted.
 */
export interface SheetPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** Sheets that keep their pixels (manifest sheet names). */
export const PIXEL_SHEETS: ReadonlySet<string> = new Set(['roof']);

const kept = new WeakMap<object, SheetPixels>();

type Ctx = { drawImage(...a: unknown[]): void; getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } };

/** RGBA of an image, or null if it cannot be read (no canvas). */
export function readPixels(src: unknown, w: number, h: number): SheetPixels | null {
  try {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = c.getContext('2d', { willReadFrequently: true }) as unknown as Ctx | null;
    if (!g) return null;
    g.drawImage(src, 0, 0);
    return { w, h, data: g.getImageData(0, 0, w, h).data };
  } catch {
    return null;
  }
}

export function keepPixels(source: object, p: SheetPixels): void {
  kept.set(source, p);
}

/** The kept RGBA of a texture source's sheet, if it keeps any. */
export function pixelsOf(source: object): SheetPixels | undefined {
  return kept.get(source);
}
