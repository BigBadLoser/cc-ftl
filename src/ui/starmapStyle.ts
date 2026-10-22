/**
 * Everything the starmap draws with comes from the theme tokens in theme.css (`--cyan`, `--amber`, ...) through this one module:
 * components never write a colour. SVG presentation attributes cannot hold `var()`, so colours are applied through `style` or
 * CSS (`fill: var(--c)`), where these strings work.
 */
import type { Tone } from './starmapApi';

const TONE: Record<Tone, string> = {
  cyan: 'var(--cyan)', amber: 'var(--amber)', green: 'var(--green)', red: 'var(--red)', text: 'var(--text)', dim: 'var(--dim)',
};
/** The CSS colour of a tone. */
export const toneColor = (t: Tone): string => TONE[t];

/** Structure badge colours by badge letter: trade, military, research, asteroids, derelict. */
export const BADGE: Record<string, string> = { T: 'var(--green)', M: 'var(--cyan)', R: 'var(--text)', A: 'var(--dim)', D: 'var(--amber)' };

/** Danger tier colour: dim while calm (never green), then amber, then red. */
const DANGER = [
  'var(--dim)', 'var(--dim)', 'var(--dim)',
  'color-mix(in srgb, var(--dim) 45%, var(--amber))', 'var(--amber)', 'var(--amber)',
  'color-mix(in srgb, var(--amber) 50%, var(--red))', 'var(--red)', 'var(--red)', 'var(--red)',
];
export const dangerColor = (d: number): string => DANGER[Math.max(0, Math.min(DANGER.length - 1, d))] as string;

/** A sector's central body: the glow tone, the disc tone and the halo radius in body radii. */
export const BODY_LOOK: Record<string, { core: string; glow: string; halo: number }> = {
  star: { core: 'var(--text)', glow: 'var(--amber)', halo: 1.9 },
  red_dwarf: { core: 'var(--red)', glow: 'var(--red)', halo: 1.8 },
  blue_giant: { core: 'var(--text)', glow: 'var(--cyan)', halo: 2 },
  gas_giant: { core: 'color-mix(in srgb, var(--amber) 55%, var(--bg))', glow: 'var(--amber)', halo: 1.6 },
  nebula: { core: 'none', glow: 'var(--dim)', halo: 1.8 },
  black_hole: { core: 'var(--bg)', glow: 'var(--amber)', halo: 1.8 },
};

const rgbCache = new Map<string, [number, number, number]>();
/** A theme token as rgb numbers (for painting the nebula image on a canvas, which cannot use `var()`). */
export function tokenRgb(name: string): [number, number, number] {
  const hit = rgbCache.get(name);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  let out: [number, number, number] = [54, 212, 255];
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
