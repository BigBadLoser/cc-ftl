import { spawnShip } from './combat/ships';
import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { populateNode } from './galaxy/populate';
import { startGalaxy } from './galaxy/travel';
import { PLAYER_START } from './tuning';

/** Fallback crew for templates that list none. */
const DEFAULT_CREW = ['role.engineer', 'role.engineer', 'role.gunner', 'role.medic'];

/**
 * Create a fresh game: a Sim with the chosen ship as grid 1 (the player's, placed in the sector) and its crew. `populate` also makes the start node's
 * structures real (stations, rocks, wrecks, east of the player's ship, see galaxy/populate.ts); the app asks for it, tests that want an empty node do not.
 */
export function newGame(seed: number, content: ContentRegistry, shipId = 'ship.starter', populate = false): Sim {
  const template = content.ships[shipId];
  if (!template) throw new Error(`Unknown ship "${shipId}"`);
  const sim = new Sim(seed, content);
  sim.trade.credits = content.trade?.startCredits ?? 0;
  sim.trade.bestCredits = sim.trade.credits;
  spawnShip(sim, { crew: DEFAULT_CREW, ...template }, { faction: 'player', x: PLAYER_START.x, y: PLAYER_START.y });
  startGalaxy(sim);
  if (populate) populateNode(sim, sim.galaxy.current);
  return sim;
}
