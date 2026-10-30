/**
 * Crew AI data (docs/CREW_AI.md section 3). Plain serializable data, entities by id. Phase 1: `AssignmentC` (and the legacy
 * need components `BedClaimC`, `EatC`, the crew activity) stay the saved truth; `Task` mirrors them, `Intent` is written by
 * `policy.legacy` and `Interrupt` by a read-only detector. Nothing reads these three to decide what a crew member does yet.
 */

/** What a crew member wants (a utility drive). `idle` and `leisure` are jobless. */
export type DriveId = 'work' | 'sleep' | 'eat' | 'recharge' | 'leisure' | 'idle';

/** The executor machines (section 6). `generic` covers simple jobs and jobless walks. */
export type MachineId = 'generic' | 'haul' | 'rescue' | 'eva' | 'eat' | 'sleep' | 'charge';

/** How a task may be interrupted (section 5): abandon now, at a safe point, only when done, or only by hard reasons. */
export type TaskClass = 'any' | 'safe' | 'finish' | 'hold';

export interface TileRef {
  x: number;
  y: number;
}

/** A machine's scratch data: at most three ids and two tiles, no arrays, no nesting. */
export interface Blackboard {
  target?: number;
  aux?: number;
  tile?: TileRef;
  tile2?: TileRef;
  n?: number;
  deadline?: number;
}

/** A suspended parent machine on the task stack (EVA nesting). */
export interface Frame {
  machine: MachineId;
  state: string;
  class: TaskClass;
  bb: Blackboard;
}

/** A claim the holder benefits from and owns. The root job is `Task.job`, never a hold. */
export interface Hold {
  kind: 'errand' | 'bed' | 'bay';
  id: number;
}

/** The task a crew member carries out (L3). */
export interface Task {
  /** The reserved root job, 0 for jobless tasks (needs, walks). */
  job: number;
  drive: DriveId;
  machine: MachineId;
  state: string;
  /** Tick the task started. */
  since: number;
  class: TaskClass;
  /** Suspended parents, innermost last (depth at most 2). Phase 1 derives it from the errand's `resume`. */
  stack: Frame[];
  holds: Hold[];
  bb: Blackboard;
}

/** What a crew member wants (L1). Phase 1: `policy.legacy`, decide's thresholds as flags (per-mille 0 or 1000). */
export interface Intent {
  policy: string;
  drive: DriveId;
  /** Tick the drive last changed. */
  since: number;
  /** Per-mille integer scores in the policy's drive order. */
  scores: number[];
  nextEval: number;
}

/** Why a crew member is out of the normal loop (L0), in precedence order (section 5). */
export type InterruptReason = 'dead' | 'downed' | 'carried' | 'inert' | 'stunned' | 'floating' | 'drafted' | 'heldForMend' | 'fight';

export interface Interrupt {
  reason: InterruptReason;
  mode: 'sweep' | 'abort' | 'hold';
  /** Who steers the path while it stands. */
  owner: 'executor' | 'fight' | 'drafted' | 'none';
  since: number;
}
