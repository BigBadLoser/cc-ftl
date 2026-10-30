import type { InterruptReason } from './types';

/** One crew member the interrupt detector and the legacy skip test disagreed on. */
export interface InterruptMismatch {
  tick: number;
  crew: number;
  /** The detector's reason, or null for none. */
  reason: InterruptReason | null;
  /** True if the legacy test (drafted, incapacitated or off duty) keeps them out of the job loop. */
  legacy: boolean;
}

/**
 * Crew-AI diagnostics. Not saved and never read by the sim (like the event buffer): tests and the inspector read it. Phase 1's
 * interrupt detector counts where its precedence list disagrees with `isOffDuty` / `isIncapacitated`.
 */
export interface AiLog {
  interruptMismatches: number;
  /** The most recent mismatches, oldest first (at most `AI_LOG_KEEP`). */
  recent: InterruptMismatch[];
}

export const AI_LOG_KEEP = 32;

export function newAiLog(): AiLog {
  return { interruptMismatches: 0, recent: [] };
}
