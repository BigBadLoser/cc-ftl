import { tendTruce } from '../blackmarket/truce';
import type { Sim } from '../sim';

/**
 * Black-market truce (blackmarket/truce.ts): at a node with a truce flag, turns the ships there hostile while a ban runs and puts them back when it ends
 * (the breach itself is a hostile act: combat/provoke.ts). Does nothing elsewhere. It runs after the dormancy system (which wakes
 * what the player aims at) and before the combat state and enemy AI read who fights whom.
 */
export function truceSystem(sim: Sim): void {
  if (sim.sector.state !== 'active') return;
  tendTruce(sim);
}
