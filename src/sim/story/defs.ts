import type { ItemQty, SkillName } from '../registry';

/**
 * Event content types. Events are data: when they can fire, who may see them, their text and their choices.
 * Everything here is independent of grids and sectors. The world enters only through `StoryContext` (danger tier and
 * faction territory, plain parameters set by command) and through the stubbed physical outcomes (see story/state.ts).
 */

/** What the pool draws from: danger tier (0 = calm) and the faction whose territory the player is in (null = open space). */
export interface StoryContext {
  danger: number;
  faction: string | null;
}

/** When an event may start. An event lists any number of triggers. */
export type EventTrigger =
  /** Drawn (weighted) when the player arrives somewhere (`story.arrive`). */
  | { kind: 'arrival'; weight: number }
  /** Drawn (weighted) when the player crosses a hyperlane with a mid-lane anchor (starmap), instead of an arrival draw. */
  | { kind: 'transit'; weight: number }
  /** Drawn (weighted) every `periodicSec` of play, outside combat. */
  | { kind: 'periodic'; weight: number }
  /** Queued `delaySec` after the flag first reaches `atLeast` (default 1); eligibility is checked when it comes due. */
  | { kind: 'flag'; flag: string; atLeast?: number; delaySec?: number }
  /** Never drawn: only a `chain` effect or the debug command reaches it. */
  | { kind: 'chain' };

/** A condition on the player's ship, crew, stock or story state. Used for eligibility and for choice requirements. */
export type Requirement =
  /** At least `count` (default 1) living crew of the species. */
  | { kind: 'species'; species: string; count?: number }
  /** A living crew member carrying the implant. */
  | { kind: 'implant'; implant: string }
  /** A living crew member whose skill is at least `level`. */
  | { kind: 'skill'; skill: SkillName; level: number }
  /** At least `count` (default 1) modules of the def on player ships. */
  | { kind: 'module'; def: string; count?: number }
  /** At least `count` of the item in stock (it is kept, not spent: use `ChoiceDef.cost` to spend). */
  | { kind: 'item'; item: string; count: number }
  /** Standing with a faction within [min, max] (either bound optional). */
  | { kind: 'reputation'; faction: string; min?: number; max?: number }
  /** A persistent flag/counter within [min, max]. Default `min` is 1 (when no `max`), so `{ kind: 'flag', flag }` means "is set"; `max: 0` means "not set". */
  | { kind: 'flag'; flag: string; min?: number; max?: number }
  /** At least this many living crew. */
  | { kind: 'crew'; count: number };

/** Whom a crew effect lands on. 'actor' = whoever made the skill check (else a random crew member). */
export type CrewTarget = 'random' | 'all' | 'actor';

/** A physical outcome. Stubbed: recorded in `StoryState.physical` for a later sector-aware system to realise. */
export type PhysicalOutcome =
  | { kind: 'derelict'; template: string }
  | { kind: 'boarders'; template: string; size: number }
  | { kind: 'fire'; where: 'random' | 'reactor' | 'cargo' }
  | { kind: 'combat'; template: string };

/** One change an outcome makes. Applied in order; each emits `story.effect`. */
export type EventEffect =
  /** Gain (positive) or lose (negative) items in the player's storage. */
  | { type: 'items'; item: string; count: number }
  | { type: 'crewDamage'; amount: number; who?: CrewTarget }
  | { type: 'crewHeal'; amount: number; who?: CrewTarget }
  /** Skill experience: every 100 xp is one level. */
  | { type: 'skillXp'; skill: SkillName; amount: number; who?: CrewTarget }
  | { type: 'reputation'; faction: string; delta: number }
  /** `set` (default) writes `value` (default 1); `add` adds `value` (a counter); `clear` removes it. */
  | { type: 'flag'; flag: string; op?: 'set' | 'add' | 'clear'; value?: number }
  /** Start another event, `delaySec` later (default at once). It queues behind a decision already open. */
  | { type: 'chain'; event: string; delaySec?: number }
  | { type: 'physical'; outcome: PhysicalOutcome };

/** What a choice does: text shown afterwards and the effects. */
export interface Outcome {
  text?: string;
  effects?: EventEffect[];
}

/** A skill check. Odds = clamp(base + perLevel * (level - difficulty), min, max); the best fit crew member rolls. */
export interface SkillCheck {
  skill: SkillName;
  /** Skill level at which the odds equal `base`. */
  difficulty: number;
  base?: number;
  perLevel?: number;
}

export interface ChoiceDef {
  /** Unique within the event. */
  id: string;
  label: string;
  /** A short second line (shown dim). */
  hint?: string;
  /** All must hold or the choice shows greyed with the reason. */
  requires?: Requirement[];
  /** Items spent when chosen (also required up front). */
  cost?: ItemQty[];
  /** With a check the outcome is `success` or `failure`; without, `outcome`. */
  check?: SkillCheck;
  outcome?: Outcome;
  success?: Outcome;
  failure?: Outcome;
}

export interface EventDef {
  title: string;
  text: string;
  /** 'decision' pauses the game in a modal; 'notice' arrives in-world and may be ignored. */
  mode: 'decision' | 'notice';
  triggers: EventTrigger[];
  /** Only a danger tier inside this range (inclusive) draws it. */
  danger?: { min?: number; max?: number };
  /** Only these faction territories draw it; absent = anywhere. `null` in the list = open space. */
  factions?: (string | null)[];
  /** All must hold for the event to start. */
  eligible?: Requirement[];
  /** Fires at most once per game. */
  once?: true;
  /** Minimum seconds between two firings. */
  cooldownSec?: number;
  /** Decisions: the options (at least one). */
  choices?: ChoiceDef[];
  /** Notices: applied the moment it arrives. */
  effects?: EventEffect[];
  /** Notices: tapping the notice opens this decision event. */
  lead?: string;
  /** Notices: seconds before an unopened lead lapses (default NOTICE_LIFE_SEC). */
  expireSec?: number;
}
