/**
 * Crew AI data (docs/CREW_AI.md section 3). Plain serializable data, entities by id. A job task mirrors `AssignmentC` (still the
 * saved truth for jobs); a need task is its own truth (the sleep's bed claim is its hold, the meal its blackboard; Phase 3).
 * `Intent` is written by the utility engine (ai/utility.ts) and `Interrupt` by the forced-state detector (ai/interrupt.ts).
 */

/** What a crew member wants (a utility drive). `idle` and `leisure` are jobless. */
export type DriveId = 'work' | 'sleep' | 'eat' | 'recharge' | 'leisure' | 'air' | 'return' | 'idle';

/** The executor machines (section 6). `generic` covers simple jobs and jobless walks. */
export type MachineId = 'generic' | 'haul' | 'rescue' | 'eva' | 'eat' | 'sleep' | 'charge' | 'escape' | 'leisure' | 'return';

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
  /** An item content id (the eat task's ration). */
  item?: string;
  /**
   * The eat task's meal is at a galley (a hot meal, a mood bonus). Plain data, not the galley's id: a meal outlives its galley
   * (dismantled mid-meal, or left on the other side of a cut by `sector/refs.ts`).
   */
  hot?: boolean;
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

/** What a crew member wants (L1), written by the utility engine (ai/utility.ts) from their policy (content/policies.ts). */
export interface Intent {
  policy: string;
  /** The drive served: the best-scoring one whose task could start (a need with no bed, bay or food falls through to the next). */
  drive: DriveId;
  /** Tick the drive last changed. */
  since: number;
  /** Per-mille integer scores in the policy's drive order. */
  scores: number[];
  nextEval: number;
  /** Bit i set: drive i of the policy is latched on (Schmitt trigger between `enter` and `exit`). */
  latched?: number;
  /** A job the scheduler does not give this crew member until the tick (left for a hazard on its site: no walking straight back). */
  avoid?: { job: number; until: number };
  /** A drive that wants to act but whose `requires` failed with `onMissing: 'block'` (it keeps its score; alerts and the inspector read it). */
  blocked?: DriveId;
  /**
   * The air drive's search (ai/airNeed.ts): ticks to the nearest air source (-1: none can be reached), found at tick `at` and
   * kept for AIR_EVAL_TICKS. Saved, so a load reads the same numbers as the uninterrupted run.
   */
  air?: { at: number; ticks: number };
}

/** Why a crew member is out of the normal loop (L0), in precedence order (section 5). */
export type InterruptReason = 'dead' | 'downed' | 'carried' | 'inert' | 'stunned' | 'floating' | 'hazard' | 'drafted' | 'heldForMend' | 'fight';

export interface Interrupt {
  reason: InterruptReason;
  mode: 'sweep' | 'abort' | 'hold';
  /** Who steers the path while it stands. */
  owner: 'executor' | 'fight' | 'drafted' | 'none';
  since: number;
}

// --- Policies (docs/CREW_AI.md section 8): content data, interpreted by ai/utility.ts -------------------------------------

/**
 * A registered drive input (`INPUTS` in ai/utility.ts): an integer where high means satisfied, absent (`undefined`) when the
 * crew member has no such need. Needs are read in tenths of their 0..100 scale (0..1000), floored once at the reader; the
 * predicates (`food`, `robotUpkeep`) read 1000 (fine) or 0. A new input is a reader in that table plus its name here.
 */
export type DriveInput = 'rest' | 'hunger' | 'charge' | 'robotUpkeep' | 'health' | 'air' | 'airMargin' | 'airSource' | 'awayReturn' | 'mood' | 'food';

/** Which crew a policy is for (ai/utility.ts `crewKind`): battery robots, station crew, the player's colonists, anyone else. */
export type CrewKind = 'robot' | 'station' | 'colonist' | 'npc';

/** Trait effects that replace a drive's `enter` threshold, in need units (0..100). */
export type DriveTraitKey = 'eatBelow';

export interface DriveDef {
  id: DriveId;
  /** Read for the curve and thresholds. Absent: the drive has no input and scores its curve's first point (work). */
  input?: DriveInput;
  /** Integer piecewise-linear score (0..1000) over the input, points sorted by input; flat beyond the ends. */
  curve: [number, number][];
  /**
   * Schmitt latch, in input units: the drive engages when the input falls below `enter` and lets go once it reaches `exit`
   * (`exit` >= `enter`; absent: `enter`, no hysteresis). While it is not engaged the drive scores 0. No `enter`: no latch.
   */
  enter?: number;
  exit?: number;
  /** A trait effect that replaces `enter` when the crew member has it (a Glutton eats sooner); `exit` still holds, never below it. */
  enterTrait?: DriveTraitKey;
  /**
   * Below this input the drive is urgent: it overrides a `hold` task (an operator at a console leaves it) and is the only
   * threshold for a driven crew member (holding a console, or a Workaholic), who ignores the drive above it. `breaksFinish`
   * also overrides a `finish` task (a carried patient is set down); only a drive that must (air) sets it.
   */
  urgent?: { below: number; breaksFinish?: true };
  /** The need does harm to the crew member when it reaches zero (starving, suffocating). Between two urgent drives the one that harms sooner goes first (`secToHarm`). */
  harmsAtZero?: true;
  /** A challenger must beat the current drive's score by this much to replace it. */
  margin?: number;
  /** Ticks the current drive is kept before a challenger may replace it (an urgent drive ignores it). */
  minDwell?: number;
  /** Inputs that must read above 0 for the drive to act. */
  requires?: DriveInput[];
  /** When `requires` fails: `damp` scores the drive 0 (default); `block` keeps the score and sets `Intent.blocked`. */
  onMissing?: 'damp' | 'block';
  /** While the drive's own task is under way it keeps its score whatever the input reads (a meal being walked to). */
  keepWhileTask?: true;
  /** The machine the drive starts (`job` hands the crew member to the scheduler). */
  task: MachineId | 'job';
}

export interface PolicyDef {
  id: string;
  /** Crew kinds that run this policy; the first policy in content order that lists a kind wins. */
  crew: CrewKind[];
  /** The drives, in tie-break order (an equal score goes to the earlier drive); also the order of `Intent.scores`. */
  drives: DriveDef[];
  /** Walk off a tile that harms them (the `hazard` interrupt, ai/hazard.ts), drafted or not. Absent: stand where they are. */
  escapeHazards?: true;
}
