import { tickStory } from '../story/engine';
import type { Sim } from '../sim';

/**
 * Events: lapse old lead notices, draw the periodic pool (outside combat, while no decision is open) and start
 * queued events that came due. Reads only story state, crew and stock; never grids.
 */
export function storySystem(sim: Sim): void {
  tickStory(sim);
}
