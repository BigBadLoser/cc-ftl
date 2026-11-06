import { hullTone } from '../combat/hullTone';

/** The tone a Meter's `auto` gives a percentage: the 60/30 hull rule, or the caller's own cut-offs (good from `good`, warn from `warn`, bad below). */
export function meterTone(pct: number, t?: { good: number; warn: number }): 'good' | 'warn' | 'bad' {
  if (!t) return ({ green: 'good', amber: 'warn', red: 'bad' } as const)[hullTone(pct)];
  return pct >= t.good ? 'good' : pct >= t.warn ? 'warn' : 'bad';
}
