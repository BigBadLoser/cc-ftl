import { defineComponent } from '../ecs';

/**
 * Crew interactions as data (docs/TRAITS.md section 6). `InteractionDef` (content/interactions.ts, `satisfies InteractionDef`) says when
 * an interaction can begin, how likely it is, how it can go and what each outcome does; the bond system (systems/relationship.ts,
 * crew/interact.ts) is the one reader. Deep talks, jokes, insults or comforting a grieving friend are more content, not more code.
 */

/** Where a crew member is when it can begin: eating (`meal`), resting on a leisure break (`break`), standing about with nothing to do (`idle`), or anywhere able (`near`). */
export type InteractionWhere = 'meal' | 'break' | 'idle' | 'near';

export interface InteractionOutcome {
  id: string;
  /** Weight of this outcome among the def's: `base` plus `compat` x the pair's compatibility plus `mood` x (their mean mood - 50) / 50. Never under 0.02. */
  weight: { base: number; compat?: number; mood?: number };
  /** Change in each one's opinion of the other, before traits: positive changes grow by `1 + compatScale x c` (floored at 0.3). */
  delta: number;
  compatScale?: number;
  /** The bond reason id (the UI words it). */
  reason: string;
  /** The overhead cue: a bubble icon id (placeholder drawing until the art pass). */
  icon: string;
  /** The mood counter both feel for a while (`chat` lifts, `row` dips). */
  mood?: 'chat' | 'row';
  /** True: a log line (milestones only). */
  log?: boolean;
}

export interface InteractionDef {
  id: string;
  name: string;
  /** Where it can begin, each with a chance multiplier. */
  where: Partial<Record<InteractionWhere, number>>;
  /** The chance per bond pass (every BOND_INTERVAL ticks) for a pair that can. */
  chance: number;
  /** Tiles the pair must be within. */
  radius: number;
  /** The initiator's opinion of the partner must lie in this range (absent: any). */
  opinion?: { min?: number; max?: number };
  /** Chance multipliers for a trait either one has (by trait id); the biggest applies once. */
  traitMult?: Record<string, number>;
  /** Chance multiplier when either one's mood is under MOOD_LOW. */
  lowMood?: number;
  /** Seconds before the same pair can do it again; seconds the cue shows. */
  cooldownSec: number;
  durationSec: number;
  outcomes: InteractionOutcome[];
}

/** An interaction under way, on both crew members (so the renderer can draw it and nobody starts a second). */
export interface Interaction {
  id: string;
  outcome: string;
  icon: string;
  /** The other crew member (entity). */
  with: number;
  since: number;
  until: number;
}
export const InteractionC = defineComponent<Interaction>('interaction');
