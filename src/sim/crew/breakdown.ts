import { hash32, unit } from '../galaxy/hash';
import type { Sim } from '../sim';
import {
  BREAK_BASE_BELOW, BREAK_BASE_LOWER, BREAK_BASE_P, BREAK_CONTEXT_COOLDOWN_SEC, BREAK_COOLDOWN_SEC, BREAK_DRAFT_MULT, BREAK_INTERVAL, BREAK_P_MAX,
  BREAK_SCALE_HIGH, BREAK_SCALE_HIGH_FROM, BREAK_SCALE_LOW,
} from '../tuning';
import { TICK_HZ } from '../time';
import { DURATION, POOLS, tierOf } from './breakTable';
import { BreakMemoryC, type BreakContext, type BreakKind, type BreakTier, type Tile2 } from './breakTypes';
import { breakdownRisk } from './mood';
import { stressors, susceptibility } from './stress';
import { traitDefs } from './traits';
import type { Mood } from './components';

/**
 * The break roll (docs/TRAITS.md section 5, "The check"): pure functions of the sim state and the hashed seed, never `sim.rng`.
 * `systems/breakdown.ts` calls `rollBreak` every BREAK_INTERVAL ticks per crew member and applies what it returns.
 */

/** Salts of the hashed rolls: whether, which context, which outcome, how long. */
const SALT_ROLL = 0xb4ea01, SALT_CONTEXT = 0xb4ea02, SALT_OUTCOME = 0xb4ea03, SALT_DURATION = 0xb4ea04;

/** The low-mood chance per check: 0 from mood 35 up, then 0.1%, 0.4% and 1.5% (`breakdownRisk`, mood under 10). */
export function breakBase(sim: Sim, id: number, mood: number): number {
  if (breakdownRisk(sim, id)) return BREAK_BASE_P.risk;
  return mood < BREAK_BASE_LOWER ? BREAK_BASE_P.lower : mood < BREAK_BASE_BELOW ? BREAK_BASE_P.low : 0;
}

/** The same stressor is worse at low mood: x1.5 below 35, x1 up to 65, x0.5 above. */
export const stressScale = (mood: number): number => (mood < BREAK_BASE_BELOW ? BREAK_SCALE_LOW : mood > BREAK_SCALE_HIGH_FROM ? BREAK_SCALE_HIGH : 1);

/** A context's contribution to the chance and the outcomes it can produce (weights after traits, the draft and cooldowns). */
export interface Term {
  context: BreakContext;
  p: number;
  pool: [BreakKind, number][];
  src?: Tile2;
}

/** Outcome pool of a context for this crew member: trait weights applied, a draft keeps only severe outcomes, zero weights dropped. */
function poolOf(sim: Sim, id: number, context: BreakContext, drafted: boolean): [BreakKind, number][] {
  const defs = traitDefs(sim, id);
  const out: [BreakKind, number][] = [];
  for (const [kind, w] of Object.entries(POOLS[context]) as [BreakKind, number][]) {
    if (drafted && tierOf(kind, context) !== 'severe') continue;
    let weight = w;
    for (const d of defs) weight *= d.effects?.breakBy?.[kind] ?? 1;
    if (weight > 0) out.push([kind, weight]);
  }
  return out;
}

/** Ticks since the last break ended (the crew member's, or from `context`); Infinity when there was none. */
function since(sim: Sim, id: number, context?: BreakContext): number {
  const mem = sim.world.get(id, BreakMemoryC);
  const at = context ? mem?.byContext[context] : mem?.last;
  return at === undefined ? Infinity : sim.tick - at;
}

/** True while the crew member is on a cooldown for any break (10 min after one ends). */
export const onCooldown = (sim: Sim, id: number): boolean => since(sim, id) < BREAK_COOLDOWN_SEC * TICK_HZ;

/**
 * The terms of the chance now: the low-mood base and each stressor present, scaled by mood, with the contexts on their own cooldown
 * (20 min) or with an empty pool dropped. A drafted crew member keeps only the severe outcomes of each pool.
 */
export function breakTerms(sim: Sim, id: number, m: Mood, drafted: boolean): Term[] {
  const scale = stressScale(m.value);
  const terms: Term[] = [];
  const base = breakBase(sim, id, m.value);
  const consider = (context: BreakContext, p: number, src?: Tile2): void => {
    if (p <= 0 || since(sim, id, context) < BREAK_CONTEXT_COOLDOWN_SEC * TICK_HZ) return;
    const pool = poolOf(sim, id, context, drafted);
    if (pool.length > 0) terms.push({ context, p, pool, src });
  };
  consider('lowMood', base);
  for (const s of stressors(sim, id, m)) consider(s.context, s.p * scale, s.src);
  return terms;
}

/** The chance of a break in this check: the terms' sum, times susceptibility (and the draft's steadying), capped. */
export function breakChance(sim: Sim, id: number, terms: readonly Term[], drafted: boolean): number {
  const sum = terms.reduce((n, t) => n + t.p, 0);
  return Math.min(BREAK_P_MAX, sum * susceptibility(sim, id) * (drafted ? BREAK_DRAFT_MULT : 1));
}

export interface BreakPick {
  kind: BreakKind;
  tier: BreakTier;
  context: BreakContext;
  /** Duration in ticks. */
  ticks: number;
  src?: Tile2;
}

/** The hashed roll for this check: whether a break starts, and which. Depends only on the seed, the crew id, the check's number and the state read. */
export function rollBreak(sim: Sim, id: number, m: Mood, drafted: boolean): BreakPick | null {
  const terms = breakTerms(sim, id, m, drafted);
  if (terms.length === 0) return null;
  const check = Math.floor(sim.tick / BREAK_INTERVAL);
  if (unit(sim.seed, SALT_ROLL, id, check) >= breakChance(sim, id, terms, drafted)) return null;
  let r = unit(sim.seed, SALT_CONTEXT, id, check) * terms.reduce((n, t) => n + t.p, 0);
  let term = terms[terms.length - 1] as Term;
  for (const t of terms) {
    if (r < t.p) {
      term = t;
      break;
    }
    r -= t.p;
  }
  let w = unit(sim.seed, SALT_OUTCOME, id, check) * term.pool.reduce((n, [, x]) => n + x, 0);
  let kind = (term.pool[term.pool.length - 1] as [BreakKind, number])[0];
  for (const [k, x] of term.pool) {
    if (w < x) {
      kind = k;
      break;
    }
    w -= x;
  }
  const [lo, hi] = DURATION[kind];
  const sec = lo + (hi - lo) * unit(sim.seed, SALT_DURATION, id, check);
  return { kind, tier: tierOf(kind, term.context), context: term.context, ticks: Math.round(sec * TICK_HZ), src: term.src };
}

/** A hash of the roll inputs, for tests that pin determinism per seed. */
export const rollKey = (sim: Sim, id: number): number => hash32(sim.seed, SALT_ROLL, id, Math.floor(sim.tick / BREAK_INTERVAL));
