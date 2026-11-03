import type { ItemQty } from '../registry';
import type { EventEffect } from '../story/defs';
import type { Contact } from '../galaxy/types';

/**
 * Physical encounters (DESIGN.md "Physical encounters"; #173). A scene says what exists in a deep-space pocket and under what conditions, never how
 * it ends. Three parts, kept apart: triggers (the transit draw, story/), scene specs (`SceneRecipe` is content, `SceneSpec` the deterministic
 * result for one signal, spec.ts) and the outcome observer (observer.ts: rules as data, facts read from sim state).
 */

/** How a scene's ships start out towards the player. Neutral ships trade and mind their business; helpless ones cannot run or fight. */
export type Stance = 'hostile' | 'neutral' | 'helpless';

/** Transient scenes (traders, ambushes) are wiped on leave; discoveries (derelicts, facilities) keep a stable key to come back to later (wiped too for now). */
export type Persistence = 'transient' | 'discovery';

/** A rolled range [min, max], both inclusive. */
export type Range = [number, number];

/** A ship a scene recipe asks for. The generator and the owner decide its hull and name; the counts are rolled from the scene seed. */
export interface SceneShipRecipe {
  /** The galaxy faction that owns it (its reputation key and ship names). */
  owner: string;
  /** Generator faction (`faction.*`) and, optionally, the hull family a seed is searched for (as fleet rosters do). */
  shipgen: string;
  family?: string;
  stance: Stance;
  /** Crew aboard, rolled (absent: the generator's own crew). */
  crew?: Range;
  /** Its trade stock: `lines` entries drawn from `pool` without repeats, each a count in [min, max] (absent: its trader kind's own roll). */
  cargo?: { lines: Range; pool: { item: string; min: number; max: number }[] };
  /** Its wallet (absent: its trader kind's). */
  credits?: Range;
}

/** A timer of a scene: it comes due `afterSec` after the scene opens. The observer reads it (fact 'timer'); it is not a script. */
export interface SceneTimerRecipe {
  id: string;
  afterSec: number;
}

/** What a story encounter puts in its pocket (content: `EventDef.scene`). */
export interface SceneRecipe {
  persistence: Persistence;
  ships?: SceneShipRecipe[];
  timers?: SceneTimerRecipe[];
  /** Observer rules this encounter adds (a new id) or overrides (a shared id; null switches a shared rule off here). */
  rules?: Record<string, SceneRuleDef | null>;
}

/** One ship of a built scene: a contact (the node-contact descriptor `spawnContact` takes) plus the scene's conditions on it. */
export interface SceneShip {
  contact: Contact;
  stance: Stance;
  /** Hull family the seed was searched for (a scan reads it). */
  family?: string;
  crew?: number;
  cargo?: ItemQty[];
  credits?: number;
}

export interface SceneTimer {
  id: string;
  /** Seconds after the scene opens; `at` is the tick it comes due, set when it opens. */
  afterSec: number;
  at?: number;
}

/**
 * A scene: what one pocket holds. Built deterministically: a story scene from the world seed, the event id and the hop (`storySpec`), a fleet
 * encounter from its fleet (`fleetSpec`). Saved with the signal and the event grid.
 */
export interface SceneSpec {
  /** Stable scene id: `story:<event>:<hash>` (the same signal gives the same scene) or `fleet:<encounter id>`. */
  key: string;
  persistence: Persistence;
  /** The story event it came from. */
  event?: string;
  /** A fleet's ships make up the scene (fleet encounters): they are materialised from the fleet, as in a node, all with this stance. */
  fleet?: { id: number; stance: Stance };
  ships: SceneShip[];
  timers: SceneTimer[];
}

/** What the observer can see happen, read from sim state (never from the event stream). Per scene ship, except `timer`. */
export type SceneFact = 'traded' | 'attacked' | 'boarded' | 'captured' | 'destroyed' | 'fled' | 'left' | 'timer';

/**
 * An observer rule (content: the shared `sceneRules`, plus an encounter's own in `SceneRecipe.rules`). The first time `on` is seen for a ship whose
 * stance is in `stance` (absent: any), its effects apply once and the log line (`{ship}` = its name) is written. A `reputation` effect whose
 * faction is 'owner' lands on the ship owner's standing.
 */
export interface SceneRuleDef {
  on: SceneFact;
  stance?: Stance[];
  /** For `on: 'timer'`: the timer id. */
  timer?: string;
  effects?: EventEffect[];
  log?: string;
  tone?: 'good' | 'warn' | 'bad' | 'info';
}

/** What the observer has seen in an open scene: per ship (index into the scene's ships, fleet ships after them) the integrity it started with. */
export interface SceneWatch {
  /** Rule firings so far, `<rule>#<ship index>` (`<rule>` alone for a timer). */
  fired: string[];
  /** Integrity of each ship when first seen (its contact id -> 0..1): a drop below it means it was hit. */
  hull: Record<number, number>;
}
