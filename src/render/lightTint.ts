import { LIGHT_DARK_BELOW } from '../sim/tuning';

/** Linear blend of two 0..1 triples. */
const mix = (a: readonly number[], b: readonly number[], t: number): number[] =>
  [0, 1, 2].map((i) => (a[i] as number) + ((b[i] as number) - (a[i] as number)) * t);
const pack = (c: readonly number[]): number =>
  (Math.round(Math.min(1, Math.max(0, c[0] as number)) * 255) << 16) |
  (Math.round(Math.min(1, Math.max(0, c[1] as number)) * 255) << 8) |
  Math.round(Math.min(1, Math.max(0, c[2] as number)) * 255);

/** Strong cool darkening for unlit tiles; still readable. */
const DARK: readonly number[] = [0.5, 0.6, 0.82];
const WHITE: readonly number[] = [1, 1, 1];
/** Light level at which a tile counts as fully lit. */
const FULL = 150;
const COLD: readonly number[] = [0.7, 0.86, 1];

/**
 * Multiplicative sprite tint for a tile: from its `light` level (0..255), a cold bluish cast in vacuum, and the
 * emergency red pulse (`pulse` in 0..1, or -1 for none) on dark tiles of an unpowered ship.
 */
export function lightTint(light: number, vacuum: boolean, pulse: number): number {
  const t = Math.min(1, light / FULL);
  let c = mix(DARK, WHITE, t * t * (3 - 2 * t));
  if (pulse >= 0 && light < LIGHT_DARK_BELOW) c = mix(c, [0.45 + 0.55 * pulse, 0.2, 0.22], 0.6);
  if (vacuum) c = [(c[0] as number) * COLD[0]!, (c[1] as number) * COLD[1]!, (c[2] as number) * COLD[2]!];
  return pack(c);
}

/** Scale a packed colour's brightness. */
export function dim(color: number, f: number): number {
  const r = ((color >> 16) & 255) * f;
  const g = ((color >> 8) & 255) * f;
  const b = (color & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Per-channel product of two packed colours. */
export function mulColor(a: number, b: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Emergency pulse phase 0..1, stepped at 10 fps so tints update cheaply. */
export function pulsePhase(nowMs: number): number {
  const step = Math.floor(nowMs / 100);
  return 0.5 + 0.5 * Math.sin(step * 0.5);
}
