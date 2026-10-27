/**
 * The starmap's panels take their colours from the theme tokens in theme.css (`--cyan`, `--amber`, ...) through this module: components never
 * write a colour. (The map itself is drawn by Pixi with the same tokens, render/starmap/palette.ts.)
 */
import type { Tone } from './starmapApi';

const TONE: Record<Tone, string> = {
  cyan: 'var(--cyan)', amber: 'var(--amber)', green: 'var(--green)', red: 'var(--red)', text: 'var(--text)', dim: 'var(--dim)',
};
/** The CSS colour of a tone. */
export const toneColor = (t: Tone): string => TONE[t];

/** Danger tier colour: dim while calm (never green), then amber, then red. */
const DANGER = [
  'var(--dim)', 'var(--dim)', 'var(--dim)',
  'color-mix(in srgb, var(--dim) 45%, var(--amber))', 'var(--amber)', 'var(--amber)',
  'color-mix(in srgb, var(--amber) 50%, var(--red))', 'var(--red)', 'var(--red)', 'var(--red)',
];
export const dangerColor = (d: number): string => DANGER[Math.max(0, Math.min(DANGER.length - 1, d))] as string;
