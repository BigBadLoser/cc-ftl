import { defineComponent } from '../ecs';
import type { HaulData } from '../items/components';
import type { ItemQty, ScrapType } from '../registry';

/**
 * Shared contract for M2 (crew & jobs). Sim systems write these; render/ui only read them.
 * All positions are tile coordinates on a grid (x = column, y = row).
 */

/** Where an entity is. While moving, it is between (x, y) and (toX, toY) with progress 0..1. */
export interface Position {
  x: number;
  y: number;
  /** Next tile while moving; equals (x, y) when standing still. */
  toX: number;
  toY: number;
  /** 0..1 along the current step from (x, y) to (toX, toY). */
  progress: number;
  /** Facing as one of 8 directions, 0 = +x, counter-clockwise in grid space (2 = +y). */
  facing: number;
}
export const PositionC = defineComponent<Position>('position');

/** Remaining path (excluding the current tile), consumed by the movement system. */
export interface Path {
  steps: { x: number; y: number }[];
}
export const PathC = defineComponent<Path>('path');

/** Work categories crew can be prioritized for. Order is display order in the priority grid. */
export const WORK_CATEGORIES = [
  'firefighting',
  'medical',
  'operating',
  'repair',
  'construction',
  'hauling',
  /** Raw materials into materials (the refinery). */
  'refining',
  /** Materials into items (fabricator, workbench; a recipe's `category` can override: refining, cooking). */
  'crafting',
  /** Working the ship's active research project at a research module (sim/research). */
  'research',
  'cooking',
  /** Planting and harvesting hydroponics beds (sim/farm). */
  'farming',
  /** Walking a patrol (station guards; patrol jobs come from a ship's director, see stations/director). */
  'patrol',
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

/** What a crew member is currently doing, shown in UI and used by render for animation. */
/** 'inert': a robot shut down (no live AI core) or stunned. 'charging': a robot in its bay. */
export type Activity = 'idle' | 'walking' | 'working' | 'sleeping' | 'drafted' | 'downed' | 'carried' | 'dead' | 'inert' | 'charging' | 'eating' | 'recovering';

export interface Crew {
  name: string;
  /** Role content id, e.g. 'role.engineer'. Sets default priorities. */
  role: string;
  /** Species content id (e.g. 'species.human', 'species.robot'). */
  species: string;
  /** Cosmetic seed for the parametric model generator (hair, face, palette). */
  appearanceSeed: number;
  activity: Activity;
}
export const CrewC = defineComponent<Crew>('crew');

/** 0 = disabled, 1 = highest ... 4 = lowest (RimWorld style). */
export type Priorities = Record<WorkCategory, number>;
export const PrioritiesC = defineComponent<Priorities>('priorities');

/**
 * Work this crew member cannot do, whatever their priorities say: each entry a work category and why (`'scene'`: a scene ship's crew that lack the
 * hands for it, scene/open.ts; traits and conditions add their own reasons). Job picks skip jobs of a blocked category (crew/jobFit.ts); the priority
 * grid shows it dim with the reason. Written through crew/workBlock.ts.
 */
export interface WorkBlock {
  category: WorkCategory;
  why: string;
}
export interface WorkBlocks {
  blocked: WorkBlock[];
}
export const WorkBlockC = defineComponent<WorkBlocks>('workBlock');

/** Needs on a 0..100 scale where 100 = fully satisfied. */
export interface Needs {
  rest: number;
  /** Hunger 0..100 (100 = fed) for species with SpeciesDef.hunger on the player's side; created on first use for old saves. */
  hunger?: number;
  /** Battery 0..100 for species with SpeciesDef.charge (robots); absent otherwise. */
  charge?: number;
}
export const NeedsC = defineComponent<Needs>('needs');

/** Present while the player controls this crew member directly. */
export interface Drafted {
  /** Ordered destination (a sector tile), if any. The grid it is on comes from the tile (`shipIdAt`). */
  target: { x: number; y: number } | null;
  /** The target the current route was planned for (so a changed target is noticed). */
  planned?: { x: number; y: number };
  /**
   * A hold the away-site code put on for a float to or from a site's shuttle (not the player's). `awaySystem` releases it once no float or
   * boarding is behind it, so it can never outlive them; a player's draft order takes it over (the mark goes).
   */
  away?: true;
}
export const DraftedC = defineComponent<Drafted>('drafted');

/** The job a crew member has reserved/is doing. */
export interface Assignment {
  jobId: number;
}
export const AssignmentC = defineComponent<Assignment>('assignment');

/** A unit of work at a tile. Jobs are entities. */
export interface Job {
  category: WorkCategory;
  /**
   * Job kind. Player-made: build/deconstruct (struct), module (blueprint), moduleDecon.
   * Auto-made by the autojobs system: extinguish (fire at x,y), repair (module `target`),
   * rescue (downed crew `target`), operate (console module `target`; x, y is its access tile, which the
   * operator stands ON; the job never finishes, it is dropped when the console is not needed).
   */
  kind: JobKind;
  x: number;
  y: number;
  /** For build jobs: the StructKind to place. */
  struct: number;
  /** Ticks of work needed at base work speed. */
  work: number;
  /** Work done so far. */
  progress: number;
  /** Crew entity that reserved it, or 0. */
  reservedBy: number;
  /** For 'operate' jobs: the tick since which nobody holds it (absent while someone does). Crew with a low operating priority relieve it after RELIEF_AFTER_SEC. */
  freeSince?: number;
  /** For 'module' jobs: the blueprint. */
  module?: { def: string; rot: number };
  /** For 'module' and 'repair' jobs: the rotated footprint [w, h] from (x, y); the crew work from beside it, never on it. */
  size?: [number, number];
  /** Entity the job acts on: module (moduleDecon, repair) or downed crew (rescue). */
  target?: number;
  /** For 'rescue': the bed module reserved for the patient, or 0. */
  bed?: number;
  /** Materials still to be delivered before work may start (build, module, craft). Absent = none needed. */
  needs?: ItemQty[];
  /** Materials delivered so far; consumed when the job completes, dropped as floor stacks if it is cancelled. */
  delivered?: ItemQty[];
  /** Tick of the last 'job.missingMaterials' / 'storage.full' warning (debounce). */
  warnedAt?: number;
  /** For 'haul' jobs: what moves where. */
  haul?: HaulData;
  /** For 'fit' jobs: the upgrade item to install (null = take the fitted one out). */
  fit?: { item: string | null };
  /** For 'assemble' jobs: the robot role being built (in a robot bay), or the vehicle (in a vehicle bay). */
  assemble?: { role?: string; vehicle?: string };
  /** For 'craft' jobs: the recipe being made. */
  craft?: { recipe: string };
  /** For 'plant' jobs: the crop (CropDef id) going into the bed `target`. */
  crop?: string;
  /** For suitUp: the job the crew member reserved first and picks up again once the suit is on. */
  resume?: number;
  /** For a refill that parked a job (`resume`): the tick it did; after NEST_HOLD_SEC the parked job is let go. */
  heldSince?: number;
  /** For suitUp / suitOff: the crew member this personal errand belongs to (nobody else may take it). */
  errandFor?: number;
  /** For a shipyard order's build jobs: the order (`YardOrder.id`) that paid for them (yard/). */
  yard?: number;
  /** The job's row out from the ship (`YardOrder.rank`): the yard's crew work the nearest open row and the one after it. */
  yardRank?: number;
  /** The yard's closing wall: only the yard's own crew take it (anyone else might wall themselves in). */
  yardOnly?: true;
  /** Derelict salvage: a deconstruct or moduleDecon job of the salvage order; finishing it spills scrap of this type instead of the refund. */
  scrap?: ScrapType;
  /** Only the party of this shuttle (`AwayC.vehicle`) take the job, and they take no other (a contraband inspection's search and seizure, inspect/). */
  party?: number;
  /** For 'passage' jobs: the away site (ShipC entity) the seat goes to. */
  site?: number;
  /**
   * forceDoor: the drafted crew member ordered to force the door (absent on the undrafted construction job).
   * sabotage: the boarder ordered to wreck `target`. Kept after the reservation is released, so the end of the order can name them.
   * passage: the crew member of a named party the seat is for (only they take it, `AwaySite.invited`).
   */
  holder?: number;
}
export const JobC = defineComponent<Job>('job');

export type JobKind =
  | 'build' | 'deconstruct' | 'module' | 'moduleDecon' | 'extinguish' | 'repair' | 'rescue' | 'haul' | 'craft' | 'research' | 'operate'
  /** plant / harvest: sow or cut the crop of the hydroponics bed `target` (farm/work.ts). */
  | 'plant' | 'harvest'
  /** refuel: load fuel into the reactor `target` (modules/refuel.ts). */
  | 'refuel'
  /** mend: repair a damaged robot (`target`); salvage: strip a robot wreck (`target`); hack: take over an AI core (`target`). */
  | 'mend' | 'salvage' | 'hack'
  /** sabotage: a boarder wrecks the hostile ship's module `target` from beside it (boarding/sabotage.ts). */
  | 'sabotage'
  /** assemble: build a robot of `assemble.role` in the robot bay `target`, or a vehicle of `assemble.vehicle` in the vehicle bay `target`. */
  | 'assemble'
  /** fit: install (or remove) a module upgrade; `target` is the module, `fit` says what (upgrades/fit.ts). */
  | 'fit'
  /** suitUp / suitOff: put on or take off an EVA suit at the airlock `target`; the crew member stands ON the airlock's inside tile. */
  | 'suitUp' | 'suitOff'
  /** refill: fill the suit's tank at the airlock `target`'s suit tile, or (target a shuttle) at the hull tile its hatch reaches, then drift out and back. */
  | 'refill'
  /** patrol: walk to a patrol stop and stand watch there for `work` ticks (a ship director posts them for its guards). */
  | 'patrol'
  /** forceDoor: free a jammed door at (x, y) (player-ordered, worked from beside it). */
  | 'forceDoor'
  /** passage: a seat on the shuttle `target` serving the away site `site`, taken at its boarding tile (x, y) (away/passage.ts). */
  | 'passage'
  /** search: an inspector searches the module `target` for contraband from beside it (inspect/search.ts). */
  | 'search';

/** Hit points of a crew member. At 0 they are downed (see DownedC). */
export interface Health {
  hp: number;
  max: number;
}
export const HealthC = defineComponent<Health>('health');

/** Present while a crew member is at 0 hp but alive. Bleeds out unless stabilized in a bed. */
export interface Downed {
  /** Seconds until death while not stabilized. */
  bleed: number;
  stabilized: boolean;
  /** Bed module the patient is reserved for / lying in, or 0. */
  bed: number;
  /** First aid on the floor (a medic drone): the bleeding has stopped, so the bleed-out timer is paused. No bed healing; rescue still applies. */
  patched?: true;
  /** A medicinal item was used on this stay in a medical bed (crew/treatment.ts): it heals faster until they get up. Its multiplier. */
  treated?: number;
}
export const DownedC = defineComponent<Downed>('downed');

/**
 * Present while a crew member lies in a recovery pod (`ModuleDef.recovery`, crew/recovery.ts), hurt but not (or no longer) downed: they heal to full
 * hp, out of action meanwhile. The pod holds them: `bed` is the pod module (reserved to them). A downed patient carried to a pod stays `Downed` until
 * `GET_UP_HP`, then becomes this and carries on to full.
 */
export interface Recovering {
  bed: number;
  /** A medicinal item was used on this stay (crew/treatment.ts): its heal multiplier, as `Downed.treated`. */
  treated?: number;
}
export const RecoveringC = defineComponent<Recovering>('recovering');

/** Corpse marker. The Crew data stays; no AI components remain. */
export interface Dead {
  /** Tick of death. */
  tick: number;
}
export const DeadC = defineComponent<Dead>('dead');

/** The crew member is being carried; their Position follows the carrier's. */
export interface Carried {
  carrier: number;
}
export const CarriedC = defineComponent<Carried>('carried');

/**
 * The bed module a crew member owns: assigned by the bed-owner pass (nearest unowned bed on their ship) and kept until the
 * bed is lost or they change ship. Tired crew walk to it first (the sleep task's bed hold is the temporary reservation for one sleep).
 */
export interface BedOwner {
  bed: number;
}
export const BedOwnerC = defineComponent<BedOwner>('bedOwner');

/** One named reason for the mood score: `key` names it (the UI labels it), `value` is its points. */
export interface MoodFactor {
  key: string;
  value: number;
}

/**
 * Mood of a crew member with SpeciesDef.mood: `value` 0..100 (MOOD_BASE plus the factors), recomputed every few ticks
 * by the mood system. The counters give the factors memory: seconds since a hot meal, since a sleep and what kind it
 * was, and how long nobody has been near.
 */
export interface Mood {
  value: number;
  factors: MoodFactor[];
  /** Seconds left of the hot-meal bonus. */
  meal: number;
  /** The item of that meal (its `food.mood` sets the factor); absent = a plain hot meal. */
  mealItem?: string;
  /** Seconds left of the bonus from a break (the leisure drive); absent = none. */
  relax?: number;
  /** Seconds left of "enjoying the work" (an interest, docs/TRAITS.md 10.7), and its points (+2 keen, +4 passionate). */
  enjoy?: number;
  enjoyPts?: number;
  /** Seconds left of the sleep memory, and whether it was in a bed (1) or on the floor (-1). */
  sleep: number;
  bed: 1 | -1;
  /** Consecutive seconds with no other crew nearby. */
  alone: number;
  /** True while the 'very unhappy' alert is armed (set on the way down, cleared once mood recovers). */
  low: boolean;
  /** Trait memory (crew/traitMood.ts), kept only for traits that read it: seconds idle without a job, since combat or EVA, since EVA. */
  idle?: number;
  quiet?: number;
  inside?: number;
  /** Stressor counters for mental breaks (crew/stress.ts), reset when a break ends: seconds with a hostile in sight within range, and in a dark room. */
  underFire?: number;
  dark?: number;
  /** Seconds left of the "let it out" lift after a break, and of the "made a scene" dip from a crew member's tantrum nearby. */
  letOut?: number;
  scene?: number;
  /** Seconds left of grief for a friend's death, of the lift from a good chat and of the dip from a row (crew/bondMood.ts). */
  grief?: number;
  chat?: number;
  row?: number;
}
export const MoodC = defineComponent<Mood>('mood');
