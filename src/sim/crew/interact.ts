import { TaskC } from '../ai/components';
import { strHash, unit } from '../galaxy/hash';
import { FighterC } from '../fight/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { BOND_CHAT_MOOD_SEC, BOND_INTERVAL, MOOD_LOW } from '../tuning';
import { bondBoth, onCooldownFor, opinionOf, personOf } from './bonds';
import { compatibility } from './compat';
import { AssignmentC, CrewC, DraftedC, MoodC, PathC } from './components';
import { isIncapacitated } from './helpers';
import { InteractionC, type InteractionDef, type InteractionWhere } from './interactionTypes';
import { BreakdownC } from './breakTypes';
import { ensureMood } from './mood';
import { hasTrait } from './traits';

/**
 * Playing the interactions (content/interactions.ts) between two crew members: whether a crew member is free for one and where, the
 * hashed roll (never `sim.rng`, so a replay agrees and the rest of the sim's random stream is untouched), the outcome, and what it does.
 * The bond system (systems/relationship.ts) calls `tryInteractions` for each pair that is close enough on its pass.
 */

const SALT_CHANCE = 0xb0d101, SALT_OUTCOME = 0xb0d102;

/** True when a crew member can take part in an interaction at all: up, awake, not breaking, not fighting, not already in one. */
export function available(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  if (!crew || isIncapacitated(sim, id) || sim.world.has(id, InteractionC) || sim.world.has(id, BreakdownC)) return false;
  if (crew.activity === 'sleeping' || crew.activity === 'carried' || crew.activity === 'drafted' || crew.activity === 'dead') return false;
  const f = sim.world.get(id, FighterC);
  return !f || f.mode === 'idle';
}

/** Where a free crew member is for the purpose of chatting: eating, resting on a break, standing about; null when busy (working, walking). */
export function spotOf(sim: Sim, id: number): InteractionWhere | null {
  const crew = sim.world.get(id, CrewC);
  if (!crew) return null;
  if (crew.activity === 'eating') return 'meal';
  const task = sim.world.get(id, TaskC);
  if (task?.machine === 'leisure' && task.state === 'Relax') return 'break';
  if (crew.activity !== 'idle' || sim.world.has(id, AssignmentC) || sim.world.has(id, DraftedC)) return null;
  return (sim.world.get(id, PathC)?.steps.length ?? 0) === 0 ? 'idle' : null;
}

const mood = (sim: Sim, id: number): number => sim.world.get(id, MoodC)?.value ?? 50;

/** The def's chance for this pair now, or 0 when it cannot happen: the place, the opinion window, the traits, the mood. */
function chanceOf(sim: Sim, def: InteractionDef, a: number, b: number, op: number): number {
  let w: number;
  if (def.where.near !== undefined) w = def.where.near;
  else {
    const sa = spotOf(sim, a), sb = spotOf(sim, b);
    const wa = sa && def.where[sa], wb = sb && def.where[sb];
    if (!wa || !wb) return 0;
    w = Math.min(wa, wb);
  }
  if (def.opinion && ((def.opinion.min !== undefined && op < def.opinion.min) || (def.opinion.max !== undefined && op > def.opinion.max))) return 0;
  let p = def.chance * w;
  if (def.traitMult) {
    let best = 1;
    for (const [t, m] of Object.entries(def.traitMult)) if ((hasTrait(sim, a, t) || hasTrait(sim, b, t)) && Math.abs(Math.log(m)) > Math.abs(Math.log(best))) best = m;
    p *= best;
  }
  if (def.lowMood && (mood(sim, a) < MOOD_LOW || mood(sim, b) < MOOD_LOW)) p *= def.lowMood;
  return p;
}

/**
 * Try every interaction for a pair on this pass; the first that rolls in begins (at most one per pair per pass). `dist` is their
 * Chebyshev distance in tiles. Returns the def that began, if any.
 */
export function tryInteractions(sim: Sim, a: number, b: number, dist: number): InteractionDef | null {
  const defs = sim.content.interactions;
  if (!defs || !available(sim, a) || !available(sim, b)) return null;
  const pa = personOf(sim, a), pb = personOf(sim, b);
  if (!pa || !pb) return null;
  const check = Math.floor(sim.tick / BOND_INTERVAL);
  const c = compatibility(sim, a, b);
  const opAB = opinionOf(sim, pa, pb)?.score ?? 0, opBA = opinionOf(sim, pb, pa)?.score ?? 0;
  for (const def of Object.values(defs)) {
    if (dist > def.radius || onCooldownFor(sim, a, b, def.id, def.cooldownSec)) continue;
    const p = chanceOf(sim, def, a, b, Math.min(opAB, opBA));
    if (p <= 0) continue;
    const h = strHash(def.id), lo = Math.min(pa, pb), hi = Math.max(pa, pb);
    if (unit(sim.seed, SALT_CHANCE, h, lo, hi, check) >= p) continue;
    const mean = (mood(sim, a) + mood(sim, b)) / 2;
    const weights = def.outcomes.map((o) => Math.max(0.02, o.weight.base + (o.weight.compat ?? 0) * c + (o.weight.mood ?? 0) * ((mean - 50) / 50)));
    let r = unit(sim.seed, SALT_OUTCOME, h, lo, hi, check) * weights.reduce((n, x) => n + x, 0);
    let pick = def.outcomes.length - 1;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]!) { pick = i; break; }
      r -= weights[i]!;
    }
    begin(sim, def, pick, a, b, c);
    return def;
  }
  return null;
}

/** Begin outcome `pick` of `def` between `a` and `b` now (the roll's result, and the screenshot hook's way to force one). */
export function begin(sim: Sim, def: InteractionDef, pick: number, a: number, b: number, c: number): void {
  const o = def.outcomes[pick]!;
  const until = sim.tick + Math.round(def.durationSec * TICK_HZ);
  sim.world.add(a, InteractionC, { id: def.id, outcome: o.id, icon: o.icon, with: b, since: sim.tick, until });
  sim.world.add(b, InteractionC, { id: def.id, outcome: o.id, icon: o.icon, with: a, since: sim.tick, until });
  const delta = o.delta > 0 ? o.delta * Math.max(0.3, 1 + (o.compatScale ?? 0) * c) : o.delta;
  bondBoth(sim, a, b, delta, o.reason, { source: def.id });
  if (o.mood) for (const id of [a, b]) ensureMood(sim, id)[o.mood] = BOND_CHAT_MOOD_SEC;
  if (o.log) sim.events.emit({ type: 'crew.interaction', crew: a, other: b, id: def.id, outcome: o.id });
}

/** Drop the interactions whose time is up, or whose other half is gone or has moved off (checked every tick: there are few). */
export function endInteractions(sim: Sim): void {
  for (const id of sim.world.query(InteractionC)) {
    const i = sim.world.get(id, InteractionC)!;
    const other = sim.world.get(i.with, InteractionC);
    if (sim.tick >= i.until || !other || other.with !== id || !sim.world.has(i.with, CrewC) || isIncapacitated(sim, id)) sim.world.remove(id, InteractionC);
  }
}
