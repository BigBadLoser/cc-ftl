import { assetBase } from '../render/assets/loader';
import type { Manifest, StaticAsset } from '../render/assets/manifest';
import type { UiIcon } from '../ui/api';

/** CSS icon frames for items, cut from the medium floor-stack sprite of each (falls back to the small or the held one). */
export async function loadItemIcons(ids: readonly string[]): Promise<Record<string, UiIcon>> {
  const base = assetBase();
  const manifest = (await (await fetch(`${base}manifest.json`)).json()) as Manifest;
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
    const a = [`${id}.m`, `${id}.s`, `${id}.held`].map((k) => manifest.assets[k]).find((x): x is StaticAsset => x?.kind === 'static');
    const sheet = a && manifest.sheets[a.sheet];
    if (!a || !sheet) continue;
    const src = base + sheet.image;
    const { w, h } = await size(src);
    out[id] = { src, x: a.frame.x, y: a.frame.y, w: a.frame.w, h: a.frame.h, sheetW: w, sheetH: h };
  }
  return out;
}
