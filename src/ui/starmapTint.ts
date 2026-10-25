/**
 * Owner tint for starmap icons. Stations, the den and fleets paint their livery in the crew key colours (`team.cloth`,
 * `team.accent`, five shade steps each); this swaps them for the owner's colour on the same shade ramp as the crew filter
 * (`render/assets/palette.ts`, a port of its `swapColor`), on a canvas cut of the icon's frame, cached as an image URL.
 */
import type { UiStarArt } from './starmapApi';
import { tokenRgb } from './starmapStyle';

type Rgb = [number, number, number];

/** The pipeline's key colours (manifest `keyColors`). */
export const KEY_CLOTH: Rgb = [1, 1, 0];
export const KEY_ACCENT: Rgb = [0, 1, 1];

const MULT = [0.42, 0.62, 0.82, 1, 1.22];
const KEY_MIN = 0.2;
const DARK_TOL = 0.02;

function ramp(col: Rgb, s: number): Rgb {
  const lv = Number(s > 0.385) + Number(s > 0.555) + Number(s > 0.73) + Number(s > 0.91);
  const m = MULT[lv] as number;
  const cool = m < 1 ? [0.88, 0.96, 1.18].map((t) => t ** ((1 - m) * 1.5)) : m > 1 ? [1.04, 1, 0.92] : [1, 1, 1];
  return col.map((c, i) => c * m * (cool[i] as number)) as Rgb;
}

/** One pixel (0..1 rgb): the owner colour on the ramp if it is a shade of a key, else unchanged. */
export function swapPixel(p: Rgb, keys: readonly Rgb[], repl: readonly Rgb[]): Rgb {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i] as Rgb;
    const kk = k[0] * k[0] + k[1] * k[1] + k[2] * k[2];
    const s = (p[0] * k[0] + p[1] * k[1] + p[2] * k[2]) / kk;
    const d = Math.hypot(p[0] - s * k[0], p[1] - s * k[1], p[2] - s * k[2]);
    if (s > KEY_MIN && s < 1.4 && d < (s < 0.385 ? DARK_TOL : 0.14 * Math.max(s, 0.5))) {
      return ramp(repl[i] as Rgb, s).map((c) => Math.min(1, Math.max(0, c))) as Rgb;
    }
  }
  return p;
}

/** Swap the key colours of RGBA bytes in place (pixels of alpha above half only, like the crew filter). */
export function swapPixels(data: Uint8ClampedArray, keys: readonly Rgb[], repl: readonly Rgb[]): void {
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] as number) < 128) continue;
    const out = swapPixel([(data[i] as number) / 255, (data[i + 1] as number) / 255, (data[i + 2] as number) / 255], keys, repl);
    data[i] = Math.round(out[0] * 255);
    data[i + 1] = Math.round(out[1] * 255);
    data[i + 2] = Math.round(out[2] * 255);
  }
}

const sheets = new Map<string, Promise<HTMLImageElement>>();
const urls = new Map<string, string>();

function loadSheet(src: string): Promise<HTMLImageElement> {
  let p = sheets.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    sheets.set(src, (p = img.decode().then(() => img)));
  }
  return p;
}

/** A frame of the colour sheet (or its glow twin) as its own image URL, the size of the frame: for SVG patterns, which cannot crop. */
export async function frameUrl(art: UiStarArt, id: string, glow = false): Promise<string | null> {
  const f = art.frames[id];
  const src = glow ? art.glow : art.src;
  if (!f || !src) return null;
  const key = `${id}|${glow ? 'glow' : 'colour'}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const img = await loadSheet(src);
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const url = c.toDataURL();
  urls.set(key, url);
  return url;
}

/** An icon's frame with its key colours swapped for `cloth` and `accent` (0..1 rgb), as an image URL the size of the frame. */
export async function tintedFrame(art: UiStarArt, id: string, cloth: Rgb, accent: Rgb): Promise<string | null> {
  const f = art.frames[id];
  if (!f) return null;
  const key = `${id}|${cloth.join(',')}|${accent.join(',')}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const img = await loadSheet(art.src);
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const px = ctx.getImageData(0, 0, f.w, f.h);
  swapPixels(px.data, [KEY_CLOTH, KEY_ACCENT], [cloth, accent]);
  ctx.putImageData(px, 0, 0);
  const url = c.toDataURL();
  urls.set(key, url);
  return url;
}

/** A tone's livery: the owner colour for the panels and a lighter one for the trim (0..1 rgb), from the theme tokens. */
export function toneTint(tone: string): { cloth: Rgb; accent: Rgb } {
  const [r, g, b] = tokenRgb(`--${tone}`).map((v) => v / 255) as Rgb;
  return { cloth: [r, g, b], accent: [r + (1 - r) * 0.45, g + (1 - g) * 0.45, b + (1 - b) * 0.45] };
}
