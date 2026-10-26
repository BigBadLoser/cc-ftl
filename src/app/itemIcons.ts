import { assetBase, loadComposed } from '../render/assets/loader';
import type { StaticAsset } from '../render/assets/manifest';
import type { UiIcon } from '../ui/api';

/** Items with no floor-stack art of their own, drawn with an existing sprite that fits (pipeline art, not code). */
const ART_FALLBACK: Record<string, string> = { 'item.parts': 'decay.debris.parts' };

/** CSS icon frames for items, cut from the medium floor-stack sprite of each (falls back to the small or the held one). */
export async function loadItemIcons(ids: readonly string[]): Promise<Record<string, UiIcon>> {
  const base = assetBase();
  const manifest = await loadComposed(base);
  const sizes = new Map<string, { w: number; h: number }>();
  const size = async (src: string) => {
    let s = sizes.get(src);
    if (!s) {
      const img = new Image();
      img.src = src;
      await img.decode();
      sizes.set(src, (s = { w: img.naturalWidth, h: img.naturalHeight }));
    }
    return s;
  };
  const out: Record<string, UiIcon> = {};
  for (const id of ids) {
    const a = [`${id}.m`, `${id}.s`, `${id}.held`, ART_FALLBACK[id] ?? ''].map((k) => manifest.assets[k]).find((x): x is StaticAsset => x?.kind === 'static');
    const sheet = a && manifest.sheets[a.sheet];
    if (!a || !sheet) continue;
    const src = base + sheet.image;
    const { w, h } = await size(src);
    // The composed frame is in world px; the CSS icon cuts the image itself, in its own pixels (a 1x sheet: resolution 0.5).
    const r = sheet.resolution ?? 1;
    out[id] = { src, x: a.frame.x * r, y: a.frame.y * r, w: a.frame.w * r, h: a.frame.h * r, sheetW: w, sheetH: h };
  }
  return out;
}
