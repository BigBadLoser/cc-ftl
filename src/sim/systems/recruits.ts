import { syncRecruits } from '../galaxy/recruit';
import type { Sim } from '../sim';

/** How often (ticks) the people aboard stations are matched to the ports' candidates. */
const EVERY = 20;

/**
 * Crew for hire as real people: keeps one `ForHireC` crew member aboard each port's station per candidate (galaxy/recruit.ts). Spawns them
 * a moment after the player arrives and removes the unhired when their window turns over. After the galaxy system, which moves the turn on.
 */
export function recruitsSystem(sim: Sim): void {
  if (sim.tick % EVERY === 0) syncRecruits(sim);
}
