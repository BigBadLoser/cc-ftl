import type { Tone } from '../ui/starmapApi';

/** Territory tint by what kind of power holds it. */
export const toneOf = (kind: string | undefined): Tone =>
  kind === 'government' ? 'cyan' : kind === 'corporation' ? 'amber' : kind === 'civilian' ? 'green' : kind === 'pirates' ? 'red' : kind === 'rogue' ? 'text' : 'dim';
