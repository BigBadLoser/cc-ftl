import { tickStory } from '../story/engine';
import { tickGoals } from '../story/goals';
import { TICK_HZ } from '../time';
import type { Sim } from '../sim';

/**
 * Events: lapse old lead notices, draw the periodic pool (outside combat, while no decision is open) and start
 * queued events that came due; once a second, the tutorial goal chain (story/goals.ts). Reads only story state, crew and stock; never grids.
 */
export function storySystem(sim: Sim): void {
  tickStory(sim);
  // The tutorial goal chain: checked once a second.
  if (sim.tick % TICK_HZ === 0) tickGoals(sim);
}
