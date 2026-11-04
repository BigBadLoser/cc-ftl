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
  /** Added to how willing it is to talk to the player (the hail score): a ship that has reason to deal with you answers even where its faction would not. */
  attitude?: number;
  /** The ship is a story's hidden question (the pirate ambush): the scene seed rolls whether it is a trap or honest. */
  ambush?: AmbushRecipe;
}

/**
 * A skiff that says it means well and may not (DESIGN.md "Pirate ambush"). `chance` of the seeds roll a trap: it has `crew` aboard, a boarding party of
 * `party` and its shuttle ready, and asks to dock `askAfterSec` after the scene opens. An honest one only talks and trades. Its story (`honest`, `trap`,
 * and for a trap sometimes a `tell`: the lie that does not add up) is the hail's talk and the player's to weigh.
 */
export interface AmbushRecipe {
  chance: number;
  party: number;
  crew: Range;
  askAfterSec: Range;
  /** An honest skiff comes aboard too, with a small party and its own crew (it brings its debt in person). */
  honest: { party: Range; crew: Range };
  /** What the skiff says when hailed: an honest one, a trap that holds together, and the slips a trap sometimes makes. */
  talk: { honest: string; trap: string; tells: { name: string; lag: string } };
}

/** The skiff of an ambush scene as the spec holds it: trap or honest, the line it speaks, and where its dock request stands. */
export interface Ambush {
  trap: boolean;
  /** Boarders it sends (a trap only). */
  party: number;
  /** What a hail gets (the story the crew tell): a trap's may hold a `tell` that does not add up. */
  talk: string;
  /** The slip a scan or hail can catch (a trap only, and not every trap slips). */
  tell?: 'name' | 'lag';
  /** Seconds after the scene opens that it asks to dock (a trap only), and the tick that is. */
  askAfter: number;
  askAt?: number;
  /**
   * Where its visit stands: 'asked' (a request waits for the player's answer), 'granted' (the shuttle is under way), 'aboard' (the party stands on the
   * player's ship), 'refused', 'sprung' (it turned hostile). Absent: nothing asked yet.
   */
  visit?: 'asked' | 'granted' | 'refused' | 'aboard' | 'delivered' | 'sprung';
  /** The tick the party turns on you after standing aboard (a trap), or starts home (an honest skiff's, once it has paid). */
  springAt?: number;
  /** An honest party is on its way back to the shuttle, and the tick the shuttle is home (it may leave then). */
  leaving?: true;
  home?: true;
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
  attitude?: number;
  /** A trap or an honest skiff (the pirate ambush). */
  ambush?: Ambush;
  /** Seconds it stays (rolled from `leaveAfterSec`), and the tick it moves on, set when the scene opens. */
  stay?: number;
  leaveAt?: number;
  /** Its business here is finished (an ambush skiff's visit ended, delivered or refused): it moves on whatever hold a hail put on it. */
  dismissed?: true;
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
 * (per player crew member who was alive when the scene opened and is dead now). `ambushed`: a skiff's boarding party turned on the player after it was let
 * aboard; `boardersDown`: that party is all dead or down; `delivered`: an honest skiff's party came aboard (its debt is paid); `declined`: the player refused an honest skiff's dock. `salvaged`: a salvage order stripped parts of it (or stripped it
 * away entirely); `cleared`: it had something hostile aboard when it was made, and nothing hostile is aboard now.
 */
export type SceneFact = 'traded' | 'attacked' | 'boarded' | 'captured' | 'destroyed' | 'fled' | 'left' | 'timer' | 'salvaged' | 'cleared' | 'crewLost' | 'ambushed' | 'boardersDown' | 'delivered' | 'declined';

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
  /** Only for an ambush skiff that is a trap (true) or honest (false). */
  trap?: boolean;
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
