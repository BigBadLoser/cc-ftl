import { defineComponent } from '../ecs';

/**
 * Shared contract for M2 (crew & jobs). Sim systems write these; render/ui only read them.
 * All positions are tile coordinates on a grid (x = column, y = row).
 */

/** Where an entity is. While moving, it is between (x, y) and (toX, toY) with progress 0..1. */
export interface Position {
  gridId: number;
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
  'cooking',
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

/** What a crew member is currently doing, shown in UI and used by render for animation. */
export type Activity = 'idle' | 'walking' | 'working' | 'sleeping' | 'drafted';

export interface Crew {
  name: string;
  /** Role content id, e.g. 'role.engineer'. Sets default priorities. */
  role: string;
  /** Species content id (only 'species.human' in M2). */
  species: string;
  /** Cosmetic seed for the parametric model generator (hair, face, palette). */
  appearanceSeed: number;
  activity: Activity;
}
export const CrewC = defineComponent<Crew>('crew');

/** 0 = disabled, 1 = highest ... 4 = lowest (RimWorld style). */
export type Priorities = Record<WorkCategory, number>;
export const PrioritiesC = defineComponent<Priorities>('priorities');

/** Needs on a 0..100 scale where 100 = fully satisfied. Only rest in M2. */
export interface Needs {
  rest: number;
}
export const NeedsC = defineComponent<Needs>('needs');

/** Present while the player controls this crew member directly. */
export interface Drafted {
  /** Ordered destination, if any. */
  target: { x: number; y: number } | null;
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
  /** Job kind, e.g. 'build' or 'deconstruct'. */
  kind: 'build' | 'deconstruct';
  gridId: number;
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
}
export const JobC = defineComponent<Job>('job');
