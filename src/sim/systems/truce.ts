import { tendTruce } from '../blackmarket/truce';
import type { Sim } from '../sim';

/**
 * Black-market truce (blackmarket/truce.ts): at a node with a truce flag, finds the player firing on or boarding anyone (a breach: a ban, standing hits),
 * turns the ships there hostile while the ban runs and puts them back when it ends. Does nothing elsewhere. It runs after the dormancy system (which wakes
 * what the player aims at) and before the combat state and enemy AI read who fights whom.
 */
export function truceSystem(sim: Sim): void {
  if (sim.sector.state !== 'active') return;
  tendTruce(sim);
}
