import type { ItemQty, SkillName } from '../registry';
import type { SceneRecipe } from '../scene/types';

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
  /** Drawn (weighted) at a hop of a hyperspace trip (see galaxy/hyperspace.ts `storyAtHop`). The only drawn pool: nothing starts while the ship idles in a node. */
  | { kind: 'transit'; weight: number }
  /** Queued `delaySec` after the flag first reaches `atLeast` (default 1); eligibility is checked when it comes due. A decision waits for the ship to be in hyperspace. */
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
  | { kind: 'crew'; count: number }
  /** A player shuttle stowed in its bay; `eva`: one fit for EVA work (it can hover beside a wreck and suit its crew out). */
  | { kind: 'shuttle'; eva?: boolean }
  /** The open decision's remote action of this kind is done (a scene's offer of help is made over the hail). */
  | { kind: 'remote'; action: RemoteAction };

/** Whom a crew effect lands on. 'actor' = whoever made the skill check (else a random crew member). */
export type CrewTarget = 'random' | 'all' | 'actor';

/** A remote action on a scene's signal (`ChoiceDef.remote`). */
export type RemoteAction = 'hail' | 'scan' | 'probe';

/** A physical outcome. Stubbed: recorded in `StoryState.physical` for a later sector-aware system to realise. */
export type PhysicalOutcome =
  | { kind: 'derelict'; template: string }
  | { kind: 'boarders'; template: string; size: number }
  | { kind: 'fire'; where: 'random' | 'reactor' | 'cargo' }
  | { kind: 'combat'; template: string };

/** One change an outcome makes. Applied in order; each emits `story.effect`. */
export type EventEffect =
  /** Gain (positive) or lose (negative) items in the player's storage. */
  /** `at: 'visitAirlock'`: a scene visitor's delivery, put on the floor just inside the airlock its shuttle is docked at (for haulers to carry); else straight to storage. */
  | { type: 'items'; item: string; count: number; at?: 'visitAirlock' }
  | { type: 'crewDamage'; amount: number; who?: CrewTarget }
  | { type: 'crewHeal'; amount: number; who?: CrewTarget }
  /** Skill experience: every 100 xp is one level. */
  | { type: 'skillXp'; skill: SkillName; amount: number; who?: CrewTarget }
  | { type: 'reputation'; faction: string; delta: number }
  /** Credits to the player: `amount`, or absent, what the rule's subject carries (a person the player helped pays their purse). */
  | { type: 'credits'; amount?: number }
  /** The rule's subject (a passenger) asks to be taken home: a passage card is posted for the player to accept or refuse (galaxy/passage.ts). */
  | { type: 'passage' }
  /** `set` (default) writes `value` (default 1); `add` adds `value` (a counter); `clear` removes it. */
  | { type: 'flag'; flag: string; op?: 'set' | 'add' | 'clear'; value?: number }
  /** Start another event, `delaySec` later (default at once). It queues behind a decision already open. */
  | { type: 'chain'; event: string; delaySec?: number }
  | { type: 'physical'; outcome: PhysicalOutcome }
  /** Investigate: the trip drops out into the event's scene (its `EventDef.scene`) once the decision closes. `aid`: help is agreed with its helpless ships first. */
  | { type: 'scene'; aid?: true }
  /** A scene ship's thanks (`ctx.ship`, an observer rule): `lines` lines of its trade stock (default 1), half of each (at least 1), into the player's storage. */
  | { type: 'gift'; lines?: number };

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
  /**
   * A remote action on a scene's signal (DESIGN.md "Physical encounters"): it reveals facts about the scene (a hail its ships' stock, a scan
   * their crew and hull; a probe is a deep scan that also reads counts and cargo) and the decision stays open. Each is taken once.
   */
  remote?: RemoteAction;
  /** With a check the outcome is `success` or `failure`; without, `outcome`. */
  check?: SkillCheck;
  outcome?: Outcome;
  success?: Outcome;
  failure?: Outcome;
}

export interface EventDef {
  title: string;
  /** What the signal's comms window shows of this event (UI only, no sim logic): `showWares: false` hides the hailed ship's stock and wallet. */
  comms?: { showWares?: boolean };
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
  /** A physical encounter: what its pocket holds, if the player investigates (a `scene` effect). */
  scene?: SceneRecipe;
  /** Notices: applied the moment it arrives. */
  effects?: EventEffect[];
  /** Notices: tapping the notice opens this decision event. */
  lead?: string;
  /** Notices: seconds before an unopened lead lapses (default NOTICE_LIFE_SEC). */
  expireSec?: number;
}

/** What finishes a goal (the tutorial goal chain, content/goals.ts). */
export type GoalCheck =
  /** A `stat.<stat>` counter (story/goals.ts `bumpStat`) reached `atLeast` (default 1). */
  | { kind: 'stat'; stat: string; atLeast?: number }
  /** The player has been to at least `count` nodes (the start node counts). */
  | { kind: 'visited'; count: number }
  /** The player is in a cluster other than the one the game started in. */
  | { kind: 'otherCluster' };

export interface GoalDef {
  id: string;
  title: string;
  /** One line on how to do it. */
  text: string;
  check: GoalCheck;
}

/** One act of the goal chain: its goals, done in any order, and what finishing them all gives. */
export interface GoalActDef {
  id: string;
  title: string;
  goals: GoalDef[];
  reward: { credits?: number; items?: ItemQty[]; reputation?: number };
}
