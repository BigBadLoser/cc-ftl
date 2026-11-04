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
  /**
   * A neutral ship's business here takes this long, rolled in seconds: then it charges its drive and jumps out (`combat.flee`), unless it was hailed
   * (from the signal or in the pocket), which makes it hold station. Absent: it stays.
   */
  leaveAfterSec?: Range;
}

/** A timer of a scene: it comes due `afterSec` after the scene opens. The observer reads it (fact 'timer'); it is not a script. */
export interface SceneTimerRecipe {
  id: string;
  afterSec: number;
}

/**
 * A derelict a scene recipe asks for, made by the derelict generator (`spawnDerelict`: a generated hull, ruined). Its ruin, air, fires, jammed doors,
 * loot, torn-off containers drifting beside it and whoever moved in all come from the ruin pass on the rolled seed; the recipe only sets the odds.
 */
export interface SceneDerelictRecipe {
  /** Generator faction (`faction.*`) of the hull; absent: the node's own faction's ships, else any non-rogue faction's (as a node's derelicts). */
  shipgen?: string;
  /** How ruined it is (the ruin pass's intensity, 0 to 1), rolled. */
  intensity: Range;
  /** What killed it, one picked at random. */
  causes: RuinCauseName[];
  /** Chance that something moved in (aliens in a living faction's wreck, the rogue AI's machines in the rest); otherwise it is empty. */
  infested: number;
}

/** What killed a derelict (shipgen/ruinTypes `RuinCause`, repeated here so content needs no shipgen import). */
export type RuinCauseName = 'combat' | 'decay';

/** What a story encounter puts in its pocket (content: `EventDef.scene`). */
export interface SceneRecipe {
  persistence: Persistence;
  ships?: SceneShipRecipe[];
  derelicts?: SceneDerelictRecipe[];
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
  /** Seconds it stays (rolled from `leaveAfterSec`), and the tick it moves on, set when the scene opens. */
  stay?: number;
  leaveAt?: number;
  /** Hailed (by the signal's remote hail, or answering a hail in the pocket): it holds station. */
  hailed?: true;
  /** It jumped away: its entity is gone from the pocket and it is not respawned. */
  gone?: 'fled';
}

/** What a scan reads off a derelict (taken from its ruin pass when the scene is built): no counts, only what sensors can tell from outside. */
export interface DerelictRead {
  /** Share of its systems' integrity gone, 0 to 1. */
  ruin: number;
  cause: RuinCauseName;
  /** Share of its rooms open to vacuum, 0 to 1. */
  vacuum: number;
  fires: number;
  /** Doors jammed shut. */
  jammed: number;
  /** Egg sacs and nests (life signs), and the rogue AI's machine spawns (machine signatures). */
  sacs: number;
  machines: number;
  /** Torn-off containers drifting beside it. */
  containers: number;
}

/** One derelict of a built scene: the generator inputs `spawnDerelict` takes, and what the scan reads. */
export interface SceneDerelict {
  /** Descriptor id (from `galaxy.nextFleet`, like a scene ship's), so the observer can key its rules per derelict. */
  id: number;
  shipgen: string;
  seed: number;
  depth: number;
  intensity: number;
  cause: RuinCauseName;
  infest: 'alien' | 'robot' | 'none';
  /** The generator's name for the hull (shown before and after it exists). */
  name: string;
  read: DerelictRead;
  /** Its ship entity once made real. */
  ship?: number;
  /** Something hostile was aboard when it was made (the observer's `cleared` reads against it). */
  infested?: true;
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
  derelicts: SceneDerelict[];
  timers: SceneTimer[];
}

/**
 * What the observer can see happen, read from sim state (never from the event stream). Per scene ship or derelict, except `timer` and `crewLost`
 * (per player crew member who was alive when the scene opened and is dead now). `salvaged`: a salvage order stripped parts of it (or stripped it
 * away entirely); `cleared`: it had something hostile aboard when it was made, and nothing hostile is aboard now.
 */
export type SceneFact = 'traded' | 'attacked' | 'boarded' | 'captured' | 'destroyed' | 'fled' | 'left' | 'timer' | 'salvaged' | 'cleared' | 'crewLost';

/**
 * An observer rule (content: the shared `sceneRules`, plus an encounter's own in `SceneRecipe.rules`). The first time `on` is seen for a ship whose
 * stance is in `stance` (absent: any), its effects apply once and the log line (`{ship}` = its name) is written. A `reputation` effect whose
 * faction is 'owner' lands on the ship owner's standing.
 */
export interface SceneRuleDef {
  on: SceneFact;
  stance?: Stance[];
  /** Only for scene ships (`ship`) or only for derelicts (`derelict`); absent: both. A derelict has no stance: a `stance` rule never matches one. */
  of?: 'ship' | 'derelict';
  /** For `on: 'timer'`: the timer id. */
  timer?: string;
  effects?: EventEffect[];
  log?: string;
  tone?: 'good' | 'warn' | 'bad' | 'info';
}

/** What the observer has seen in an open scene. */
export interface SceneWatch {
  /** Rule firings so far, `<rule>#<contact id>` (`<rule>#d<derelict id>` for a derelict, `<rule>#c<crew id>` for crew lost, `<rule>` alone for a timer). */
  fired: string[];
  /** Player crew seen alive in the grid so far (`crewLost` reads against it). */
  crew?: number[];
}
