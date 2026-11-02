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
  /** A drive that wants to act but whose `requires` failed with `onMissing: 'block'` (it keeps its score; alerts and the inspector read it). */
  blocked?: DriveId;
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

// --- Policies (docs/CREW_AI.md section 8): content data, interpreted by ai/utility.ts -------------------------------------

/**
 * A registered drive input (`INPUTS` in ai/utility.ts): an integer where high means satisfied, absent (`undefined`) when the
 * crew member has no such need. Needs are read in tenths of their 0..100 scale (0..1000), floored once at the reader; the
 * predicates (`food`, `robotUpkeep`) read 1000 (fine) or 0. A new input is a reader in that table plus its name here.
 */
export type DriveInput = 'rest' | 'hunger' | 'charge' | 'robotUpkeep' | 'health' | 'air' | 'mood' | 'food';

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
}
