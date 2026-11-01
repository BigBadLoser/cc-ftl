import { assetBase, loadComposed } from '../render/assets/loader';
import type { UiStarArt } from '../ui/starmapApi';

/** The starmap family's sheet (colour and glow) and every `starmap.*` frame in the sheet's own pixels, for the SVG starmap. */
export async function loadStarmapArt(): Promise<UiStarArt | null> {
  const base = assetBase();
  const manifest = await loadComposed(base);
  const sheet = manifest.sheets['starmap'];
  if (!sheet) return null;
  const src = base + sheet.image;
  const img = new Image();
  img.src = src;
  await img.decode();
  // Composed frames are in world px; the SVG cuts the image itself, in its own pixels (resolution 0.5: world px are twice the file's).
  const r = sheet.resolution ?? 1;
  const frames: UiStarArt['frames'] = {};
  for (const [id, a] of Object.entries(manifest.assets)) {
    if (a.kind !== 'static' || a.sheet !== 'starmap') continue;
    frames[id] = { x: a.frame.x * r, y: a.frame.y * r, w: a.frame.w * r, h: a.frame.h * r, glow: !!a.glow };
  }
  return { src, glow: sheet.glow ? base + sheet.glow : null, w: img.naturalWidth, h: img.naturalHeight, frames };
}
