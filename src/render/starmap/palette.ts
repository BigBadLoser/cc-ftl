/**
 * The theme tokens (theme.css) as numbers for Pixi, read once from the page's computed style. Tones map to the same tokens the
 * UI's `toneColor` uses, and the two `color-mix` colours (danger tiers, the gas giant's code colour) are mixed in sRGB like CSS does.
 */
import type { Tone } from '../../ui/starmapApi';

type Rgb = [number, number, number];
const rgbCache = new Map<string, Rgb>();

/** A theme token (`--cyan`) as rgb bytes (a canvas parses whatever colour syntax the token holds). */
export function tokenRgb(name: string): Rgb {
  const hit = rgbCache.get(name);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  let out: Rgb = [54, 212, 255];
  if (ctx) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (value) {
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0] as number, d[1] as number, d[2] as number];
    }
  }
  rgbCache.set(name, out);
  return out;
}

const hex = (c: Rgb): number => (c[0] << 16) | (c[1] << 8) | c[2];
/** A theme token as a 0xRRGGBB number. */
export const token = (name: string): number => hex(tokenRgb(name));
/** `a` over `b` by `pct` percent of `a` (CSS `color-mix(in srgb, a pct%, b)`). */
const mix = (a: Rgb, b: Rgb, pct: number): Rgb => a.map((v, i) => Math.round(v * pct + (b[i] as number) * (1 - pct))) as Rgb;

/** The colours the starmap draws with. */
export interface Palette {
  cyan: number; amber: number; green: number; red: number; text: number; dim: number; bg: number; panel3: number;
  tone(t: Tone): number;
  badge(letter: string): number;
  danger(d: number): number;
}

/** The palette of the current theme. */
export function readPalette(): Palette {
  const t = (n: string) => token(`--${n}`);
  const tones: Record<Tone, number> = { cyan: t('cyan'), amber: t('amber'), green: t('green'), red: t('red'), text: t('text'), dim: t('dim') };
  const badges: Record<string, number> = { T: tones.green, M: tones.cyan, R: tones.text, A: tones.dim, D: tones.amber };
  const dim = tokenRgb('--dim');
  const amber = tokenRgb('--amber');
  const red = tokenRgb('--red');
  const dangers = [
    tones.dim, tones.dim, tones.dim, hex(mix(dim, amber, 0.45)), tones.amber, tones.amber, hex(mix(amber, red, 0.5)), tones.red, tones.red, tones.red,
  ];
  return {
    ...tones, bg: t('bg'), panel3: t('panel-3'),
    tone: (x) => tones[x],
    badge: (l) => badges[l] ?? tones.dim,
    danger: (d) => dangers[Math.max(0, Math.min(dangers.length - 1, d))] as number,
  };
}
