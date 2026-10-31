import type { Command, SimEvent } from '../../sim';
import type { UiAiming, UiCombat, UiGoals, UiTrade } from '../api';
import type { Condition } from './conditions';
import type { SpeakerId } from './speakers';
import type { LessonTarget } from './targets';

/**
 * What lessons read: snapshots the UI already has. Add a field when a new lesson needs to see more (the host fills it in).
 * `busy`: something urgent holds the screen (an event decision), so a queued lesson waits.
 */
export interface LessonCtx {
  combat: UiCombat;
  aiming: UiAiming | null;
  /** Hailable ships and stations in the node (the station lesson reads who is a station and who has been hailed). */
  trade: UiTrade;
  /** The ship or station picked in the selection panel. */
  selectedShip: number | null;
  /** The goal chain (null when finished or skipped). */
  goals: UiGoals | null;
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
  /**
   * The words. A step with a speaker has `say` (their line, shown in quotes) and `keys` (the mechanics, one short line each); a plain
   * step has `text`. In all of them `[Q]` renders as a key badge and `**word**` as a strong word.
   */
  text?: string;
  say?: string;
  keys?: readonly string[];
  /** What the coach mark rings; none centres the card. */
  target?: LessonTarget;
  /** `gotIt`: the player reads and clicks Got it. A condition: a "do" step that advances when it holds (the player did the thing). */
  advance: 'gotIt' | Condition;
  /** Overrides the lesson's speaker for this step. */
  speaker?: SpeakerId;
  /** Time runs during this step (the game resumes at the player's speed); otherwise the game stays paused. */
  run?: boolean;
}

export interface LessonDef {
  /** Stable id (`lesson.combat`): the seen-state key. */
  id: string;
  title: string;
  /** Who speaks it (speakers.ts); none keeps the plain card. */
  speaker?: SpeakerId;
  /** Queues the lesson the first time it holds (once seen, never again unless replayed). */
  trigger: Condition;
  /** Real ms between the trigger and the lesson opening (the scene settles first: camera framed, art loaded). Default 0. */
  delay?: number;
  /** While this fails, a queued lesson is dropped and an open one closes unfinished (not marked seen): its situation passed. */
  while?: Condition;
  steps: readonly StepDef[];
}
