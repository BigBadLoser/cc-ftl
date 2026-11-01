import type { SkillName } from '../registry';
import type { Modifier } from '../stats';

/** How a trait reads on the crew card (docs/TRAITS.md section 4). */
export type TraitKind = 'behaviour' | 'phobia' | 'habit' | 'tradeoff' | 'texture';

/**
 * Behaviour a trait changes outside the stat resolver. Each field is read by the one system that owns the behaviour
 * (named per field); several traits combine by multiplying the multipliers and OR-ing the flags.
 */
export interface TraitEffects {
  /** needs.ts: hunger drains this much faster. */
  hungerMult?: number;
  /** crew/mood.ts: the food factors (well fed, hot meal) are worth this much. */
  foodMoodMult?: number;
  /** crew/eating.ts: goes to eat below this hunger instead of HUNGER_EAT_BELOW (not at a console). */
  eatBelow?: number;
  /** crew/spawn.ts: max hp at creation. */
  maxHpMult?: number;
  /** systems/vitals.ts: seconds a downed crew member lasts before bleeding out. */
  bleedMult?: number;
  /** systems/suits.ts: the suit tank lasts this much longer. */
  suitAirMult?: number;
  /** eva/conditions.ts: no walking penalty in a suit. */
  noSuitSlow?: true;
  /** crew/conditions.ts and mood: no darkness penalty; "glare" mood on bright tiles. */
  darkAdapted?: true;
  /** crew/mood.ts: a flat mood factor (keyed by the trait) of this many points. */
  mood?: number;
  /** crew/mood.ts: every other mood factor is scaled by this. */
  moodScale?: number;
  /** crew/mood.ts: other crew within MOOD_COMPANY_RADIUS get this many mood points. */
  aura?: number;
  /** crew/mood.ts: how company and loneliness feel. */
  company?: 'loner' | 'social';
  /** fight/fighter.ts, fight/surrender.ts: fights unarmed, never surrenders. */
  brave?: true;
  /** fight/fighter.ts, fight/surrender.ts: flees when hurt even armed; player crew surrender when hurt and outnumbered. */
  coward?: true;
  /** ai/policy.ts: sleeps and eats only at the urgent thresholds, like an operator at a console. */
  workaholic?: true;
  /** ai/machines/idle.ts: idle wander chance multiplier. */
  wanderMult?: number;
  /** crew/mood.ts: happy in combat or on EVA, bored after a long quiet. */
  thrill?: true;
  /** crew/mood.ts: cooped up after a long time without EVA. */
  voidHome?: true;
  /** crew/mood.ts: mood while idle (no job) for at least `afterSec` seconds. */
  idleMood?: { key: 'idle' | 'restless'; value: number; afterSec: number };
  /** story/effects.ts (and work XP later): XP gains are multiplied, for `xpSkills` only when given. */
  xpMult?: number;
  xpSkills?: readonly SkillName[];
}

/** A crew trait (content `src/content/traits.ts`, `satisfies TraitDef`). */
export interface TraitDef {
  name: string;
  /** One line of flavour. */
  flavour: string;
  kind: TraitKind;
  /** The exact effect in words, shown on hover (numbers on demand). */
  effect: string;
  /** The effect in a few words, for the inspector's one-line trait list (`effect` is on hover). */
  short: string;
  /** Roll weight: 10 common, 5 uncommon, 2 rare. */
  weight: number;
  /** Trait ids that can't be rolled together with this one (both directions are listed in content). */
  excludes?: readonly string[];
  /** False while the mechanic it needs (fear, bonds, habits) isn't built: no one rolls it. */
  rollable: boolean;
  /** Stat modifiers, applied through the stat resolver (`traitModifiers`). */
  modifiers?: readonly Modifier[];
  effects?: TraitEffects;
}
