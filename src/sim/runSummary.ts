import type { Sim } from './sim';
import { TICK_HZ } from './time';

/** What the game-over screen tells about the run. All of it comes from state the sim keeps anyway. */
export interface RunSummary {
  /** Game time survived, in seconds (the sim's own clock: it stops when paused and runs faster at higher speeds). */
  seconds: number;
  /** FTL jumps made. */
  jumps: number;
  /** The most credits held at once. */
  bestCredits: number;
  /** Credits at the end. */
  credits: number;
}

export function runSummary(sim: Sim): RunSummary {
  const credits = sim.trade.credits;
  return { seconds: Math.floor(sim.tick / TICK_HZ), jumps: sim.galaxy.jumps, bestCredits: Math.max(sim.trade.bestCredits ?? 0, credits), credits };
}
