import { defineComponent } from '../ecs';
import type { HaulData } from '../items/components';
import type { ItemQty } from '../registry';

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
  /**
   * Cross-grid journeys: when `steps` run out the crew member crosses `then[0].portal` and walks `then[0].steps` on the
   * far grid, and so on (see portals/route.ts and the portal system). Absent or empty = a single-grid path.
   */
  then?: { portal: number; steps: { x: number; y: number }[] }[];
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
  'crafting',
  'cooking',
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

/** What a crew member is currently doing, shown in UI and used by render for animation. */
/** 'inert': a robot shut down (no live AI core) or stunned. 'charging': a robot in its bay. */
export type Activity = 'idle' | 'walking' | 'working' | 'sleeping' | 'drafted' | 'downed' | 'carried' | 'dead' | 'inert' | 'charging' | 'eating';

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
  /** Ordered destination (a sector tile), if any. The grid it is on comes from the tile (`gridIdAt`). */
  target: { x: number; y: number } | null;
  /** The target the current route was planned for (so a changed target is noticed). */
  planned?: { x: number; y: number };
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
  /** For 'module' jobs: the blueprint. */
  module?: { def: string; rot: number };
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
  /** For 'assemble' jobs: the robot role being built. */
  assemble?: { role: string };
  /** For 'craft' jobs: the recipe being made. */
  craft?: { recipe: string };
  /** For suitUp: the job the crew member reserved first and picks up again once the suit is on. */
  resume?: number;
  /** For suitUp / suitOff: the crew member this personal errand belongs to (nobody else may take it). */
  errandFor?: number;
}
export const JobC = defineComponent<Job>('job');

export type JobKind =
  | 'build' | 'deconstruct' | 'module' | 'moduleDecon' | 'extinguish' | 'repair' | 'rescue' | 'haul' | 'craft' | 'operate'
  /** mend: repair a damaged robot (`target`); salvage: strip a robot wreck (`target`); hack: take over an AI core (`target`). */
  | 'mend' | 'salvage' | 'hack'
  /** assemble: build a robot of `assemble.role` in the robot bay `target`. */
  | 'assemble'
  /** suitUp / suitOff: put on or take off an EVA suit at the airlock `target`; the crew member stands ON the airlock's inside tile. */
  | 'suitUp' | 'suitOff';

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
}
export const DownedC = defineComponent<Downed>('downed');

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

/** A bed module this crew member has reserved for sleeping. */
export interface BedClaim {
  bed: number;
}
export const BedClaimC = defineComponent<BedClaim>('bedClaim');

/**
 * A hungry crew member on the way to eat (left = -1) or eating (left = ticks to go). `x, y` is the tile to stand on:
 * a galley's access tile (`galley`) or a walkable tile beside a storage crate holding `item`. The ration is taken from
 * storage when the meal starts, nutrition is added when it ends.
 */
export interface Eat {
  x: number;
  y: number;
  galley: boolean;
  item: string;
  left: number;
}
export const EatC = defineComponent<Eat>('eat');

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
  /** Seconds left of the sleep memory, and whether it was in a bed (1) or on the floor (-1). */
  sleep: number;
  bed: 1 | -1;
  /** Consecutive seconds with no other crew nearby. */
  alone: number;
  /** True while the 'very unhappy' alert is armed (set on the way down, cleared once mood recovers). */
  low: boolean;
}
export const MoodC = defineComponent<Mood>('mood');
