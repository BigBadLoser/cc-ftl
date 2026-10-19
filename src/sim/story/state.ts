import { Rng } from '../rng';
import type { PhysicalOutcome, StoryContext } from './defs';

/** A decision that is open right now (the game is paused on it in the UI). */
export interface ActiveEvent {
  event: string;
  since: number;
}

export interface QueuedEvent {
  event: string;
  due: number;
  /** Skip eligibility and once/cooldown checks (chains and debug fires). */
  force?: true;
}

/** An in-world notice. A lead opens its decision when tapped. */
export interface Notice {
  id: number;
  event: string;
  expires: number;
}

/** What the last choice did, for the result card. */
export interface Resolution {
  tick: number;
  event: string;
  choice: string;
  /** null = no skill check. */
  success: boolean | null;
  text: string;
  lines: string[];
}

/** A physical outcome waiting for the sector layer. Nothing consumes these yet; a later system removes them as it realises each. */
export interface PhysicalEntry {
  id: number;
  tick: number;
  event: string;
  outcome: PhysicalOutcome;
}

/**
 * All event state. Plain data on the Sim (saved with it), independent of grids. Story rolls use their own Rng
 * (`rng`) so events never disturb the simulation's random stream.
 */
export interface StoryState {
  flags: Record<string, number>;
  reputation: Record<string, number>;
  context: StoryContext;
  /** Seconds between periodic draws; 0 = periodic events off. */
  periodicSec: number;
  nextPeriodic: number;
  seen: Record<string, { count: number; last: number }>;
  active: ActiveEvent | null;
  queue: QueuedEvent[];
  notices: Notice[];
  nextId: number;
  last: Resolution | null;
  physical: PhysicalEntry[];
  rng: number;
}

/** Most physical entries kept (a stub's log is bounded). */
export const PHYSICAL_LOG_MAX = 50;

export function newStory(seed: number): StoryState {
  return {
    flags: {}, reputation: {}, context: { danger: 0, faction: null }, periodicSec: 0, nextPeriodic: 0,
    seen: {}, active: null, queue: [], notices: [], nextId: 1, last: null, physical: [],
    rng: (seed ^ 0x5eed5eed) >>> 0,
  };
}

/** Run `fn` with the story Rng and store its advanced state. */
export function withRng<T>(story: StoryState, fn: (rng: Rng) => T): T {
  const rng = new Rng(story.rng);
  const out = fn(rng);
  story.rng = rng.getState();
  return out;
}

export const flagValue = (story: StoryState, flag: string): number => story.flags[flag] ?? 0;
export const reputationOf = (story: StoryState, faction: string): number => story.reputation[faction] ?? 0;
