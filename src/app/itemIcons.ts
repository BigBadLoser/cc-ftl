import { assetBase, loadComposed } from '../render/assets/loader';
import type { StaticAsset } from '../render/assets/manifest';
import type { UiIcon } from '../ui/api';

/** An item's floor-stack frames for a CSS icon, best first: the medium stack, the small one, the stack unit, the held one. */
const FLOOR = ['m', 's', 'unit', 'held'];

/**
 * CSS icon frames for items: the item's own UI icon (`<item>.icon`, drawn 1:1) when it has one, its floor-stack sprite otherwise. An item with
 * a UI icon keeps the floor frame too (`floor`), for boxes too small to show the icon at 1x.
 */
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
  const frame = async (keys: readonly string[]): Promise<UiIcon | undefined> => {
    const a = keys.map((k) => manifest.assets[k]).find((x): x is StaticAsset => x?.kind === 'static');
    const sheet = a && manifest.sheets[a.sheet];
    if (!a || !sheet) return undefined;
    const src = base + sheet.image;
    const { w, h } = await size(src);
    // The composed frame is in world px; the CSS icon cuts the image itself, in its own pixels (a 1x sheet: resolution 0.5).
    const r = sheet.resolution ?? 1;
    return { src, x: a.frame.x * r, y: a.frame.y * r, w: a.frame.w * r, h: a.frame.h * r, sheetW: w, sheetH: h };
  };
  const out: Record<string, UiIcon> = {};
  for (const id of ids) {
    const floor = await frame(FLOOR.map((s) => `${id}.${s}`));
    const ui = await frame([`${id}.icon`]);
    const icon = ui ? { ...ui, ui: true, ...(floor ? { floor } : {}) } : floor;
    if (icon) out[id] = icon;
  }
  return out;
}
