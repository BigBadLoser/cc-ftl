import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { gridFromTemplate } from './ship';

/** Create a fresh game: a Sim with the chosen ship as grid 1. */
export function newGame(seed: number, content: ContentRegistry, shipId = 'ship.starter'): Sim {
  const template = content.ships[shipId];
  if (!template) throw new Error(`Unknown ship "${shipId}"`);
  const sim = new Sim(seed, content);
  sim.grids.set(1, gridFromTemplate(1, template));
  return sim;
}
