import type { Command, SimEvent } from '../../sim';
import type { UiAiming, UiCombat } from '../api';
import type { Condition } from './conditions';
import type { LessonTarget } from './targets';

/**
 * What lessons read: snapshots the UI already has. Add a field when a new lesson needs to see more (the host fills it in).
 * `busy`: something urgent holds the screen (an event decision), so a queued lesson waits.
 */
export interface LessonCtx {
  combat: UiCombat;
  aiming: UiAiming | null;
  busy: boolean;
}

/** A discrete happening since the last update: a sim event, or a command issued (by the player, or the sim's own AI). */
export type LessonSignal = { kind: 'event'; event: SimEvent } | { kind: 'command'; command: Command };

/** One update's view: the context now and the signals since the last update. Conditions evaluate against it. */
export interface LessonFrame {
  ctx: LessonCtx;
  signals: readonly LessonSignal[];
}

export interface StepDef {
  title: string;
  /** A line or two. `[Q]` renders as a key badge. */
  text: string;
  /** What the coach mark rings; none centres the card. */
  target?: LessonTarget;
  /** `gotIt`: the player reads and clicks Got it. A condition: a "do" step that advances when it holds (the player did the thing). */
  advance: 'gotIt' | Condition;
  /** Time runs during this step (the game resumes at the player's speed); otherwise the game stays paused. */
  run?: boolean;
}

export interface LessonDef {
  /** Stable id (`lesson.combat`): the seen-state key. */
  id: string;
  title: string;
  /** Queues the lesson the first time it holds (once seen, never again unless replayed). */
  trigger: Condition;
  /** Real ms between the trigger and the lesson opening (the scene settles first: camera framed, art loaded). Default 0. */
  delay?: number;
  /** While this fails, a queued lesson is dropped and an open one closes unfinished (not marked seen): its situation passed. */
  while?: Condition;
  steps: readonly StepDef[];
}
