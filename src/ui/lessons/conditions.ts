import type { Command, SimEvent } from '../../sim';
import type { LessonCtx, LessonFrame } from './types';

/**
 * Lesson conditions: what triggers a lesson and what completes a "do" step. Each kind is a shape here plus an evaluator in `CONDITION_KINDS`;
 * the engine only calls `checkCondition`. A new kind is one entry in each (the typecheck makes sure both exist), no engine change.
 */
export interface ConditionKinds {
  /** A sim event was emitted (optionally matching). */
  event: { type: SimEvent['type']; match?: (e: SimEvent, ctx: LessonCtx) => boolean };
  /** A command was issued (optionally matching): the player did something. */
  command: { type: Command['type']; match?: (c: Command, ctx: LessonCtx) => boolean };
  /** A state read from the snapshots holds now (a UI state reached, a sim condition). */
  state: { test: (ctx: LessonCtx) => boolean };
  any: { of: readonly Condition[] };
  all: { of: readonly Condition[] };
}

export type Condition = { [K in keyof ConditionKinds]: { kind: K } & ConditionKinds[K] }[keyof ConditionKinds];

type Evaluator<K extends keyof ConditionKinds> = (c: { kind: K } & ConditionKinds[K], f: LessonFrame) => boolean;

export const CONDITION_KINDS: { [K in keyof ConditionKinds]: Evaluator<K> } = {
  event: (c, f) => f.signals.some((s) => s.kind === 'event' && s.event.type === c.type && (!c.match || c.match(s.event, f.ctx))),
  command: (c, f) => f.signals.some((s) => s.kind === 'command' && s.command.type === c.type && (!c.match || c.match(s.command, f.ctx))),
  state: (c, f) => c.test(f.ctx),
  any: (c, f) => c.of.some((x) => checkCondition(x, f)),
  all: (c, f) => c.of.every((x) => checkCondition(x, f)),
};

export function checkCondition(c: Condition, f: LessonFrame): boolean {
  return (CONDITION_KINDS[c.kind] as Evaluator<typeof c.kind>)(c as never, f);
}

// Builders, so definitions read as sentences.
export const onEvent = <T extends SimEvent['type']>(type: T, match?: (e: Extract<SimEvent, { type: T }>, ctx: LessonCtx) => boolean): Condition =>
  ({ kind: 'event', type, ...(match ? { match: match as ConditionKinds['event']['match'] } : {}) });
export const onCommand = <T extends Command['type']>(type: T, match?: (c: Extract<Command, { type: T }>, ctx: LessonCtx) => boolean): Condition =>
  ({ kind: 'command', type, ...(match ? { match: match as ConditionKinds['command']['match'] } : {}) });
export const when = (test: (ctx: LessonCtx) => boolean): Condition => ({ kind: 'state', test });
export const anyOf = (...of: Condition[]): Condition => ({ kind: 'any', of });
export const allOf = (...of: Condition[]): Condition => ({ kind: 'all', of });
