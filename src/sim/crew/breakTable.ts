import type { BreakContext, BreakKind, BreakTier } from './breakTypes';

/** The stressor and outcome tables of docs/TRAITS.md section 5, as data. Chances are per check (BREAK_INTERVAL). */

/** The chance each stressor adds per check, before the mood scale and traits. `lowMood` has no entry: its chance comes from the mood (`breakBase`). */
export const STRESSOR_P: Readonly<Record<Exclude<BreakContext, 'lowMood'>, number>> = {
  fire: 0.003, combat: 0.003, decompression: 0.005, blackout: 0.002, exhaustion: 0.002, grief: 0.005,
};

/** Outcome pools by context (weights). */
export const POOLS: Readonly<Record<BreakContext, Readonly<Partial<Record<BreakKind, number>>>>> = {
  fire: { panic: 5, freeze: 2, refusal: 2 },
  combat: { freeze: 3, hide: 4, panic: 3 },
  decompression: { panic: 6, freeze: 2 },
  blackout: { isolation: 3, panic: 1, despair: 1 },
  exhaustion: { refusal: 4, despair: 2 },
  grief: { despair: 6, isolation: 3, tantrum: 1 },
  lowMood: { refusal: 4, tantrum: 3, isolation: 3, despair: 2 },
};

/** Durations in seconds, [min, max] (the maximum is the latest end; a break ends early once its context is gone). */
export const DURATION: Readonly<Record<BreakKind, readonly [number, number]>> = {
  panic: [30, 60], freeze: [10, 20], hide: [20, 60], tantrum: [60, 90], despair: [180, 300], refusal: [120, 240], isolation: [120, 180],
};

/** The tier of an outcome: freeze is severe in combat, else moderate. */
export function tierOf(kind: BreakKind, context: BreakContext): BreakTier {
  switch (kind) {
    case 'panic': return 'severe';
    case 'freeze': return context === 'combat' ? 'severe' : 'moderate';
    case 'hide': case 'tantrum': case 'despair': return 'moderate';
    default: return 'mild';
  }
}

/** Kinds that take the crew member out of the normal loop through the interrupt layer (`break` machine). */
export const isInterruptTier = (tier: BreakTier): boolean => tier !== 'mild';

/** Kinds that are loud enough for an urgent alert (panic; a freeze in combat). Every break is logged. */
export const alertable = (kind: BreakKind, context: BreakContext): boolean => kind === 'panic' || (kind === 'freeze' && context === 'combat');
