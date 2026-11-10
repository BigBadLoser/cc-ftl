import { spawnShip } from './combat/ships';
import { powerSystem } from './systems/power';
import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { populateNode } from './galaxy/populate';
import { startGalaxy } from './galaxy/travel';
import { PLAYER_START } from './tuning';
import { defaultPicks, rollStartingCrew, type CrewPick } from './crew/roll';

/** Fallback crew for templates that list none. */
const DEFAULT_CREW = ['role.engineer', 'role.engineer', 'role.gunner', 'role.medic'];

/** The crew roles a ship starts with (its template's list, or the fallback): the slots of the crew screen. */
export function startingRoles(content: ContentRegistry, shipId = 'ship.starter'): string[] {
  return [...(content.ships[shipId]?.crew ?? DEFAULT_CREW)];
}

/**
 * Create a fresh game: a Sim with the chosen ship as grid 1 (the player's, placed in the sector) and its crew. `populate` also makes the start node's
 * structures real (stations, rocks, wrecks, east of the player's ship, see galaxy/populate.ts); the app asks for it, tests that want an empty node do not.
 * `crew`: the crew-screen picks (one per berth, kinds as `startingRoles`), or 'rolled' for unrerolled picks. People are then rolled
 * (crew/roll.ts: background, skills, traits) from their own RNG and become `role.crew`; without it the berths' kinds spawn as they are,
 * with the kinds' skills and no traits (what most tests want: fixed fixtures).
 */
export function newGame(seed: number, content: ContentRegistry, shipId = 'ship.starter', populate = false, crew?: readonly CrewPick[] | 'rolled'): Sim {
  const template = content.ships[shipId];
  if (!template) throw new Error(`Unknown ship "${shipId}"`);
  const sim = new Sim(seed, content);
  sim.trade.credits = content.trade?.startCredits ?? 0;
  sim.trade.bestCredits = sim.trade.credits;
  const picks = crew === 'rolled' ? defaultPicks(startingRoles(content, shipId)) : crew;
  const rolls = picks && rollStartingCrew(seed, picks, content);
  spawnShip(sim, { crew: DEFAULT_CREW, ...template, ...(rolls ? { crew: rolls.map((r) => r.role) } : {}) }, {
    faction: 'player', x: PLAYER_START.x, y: PLAYER_START.y, ...(rolls ? { rolls } : {}),
  });
  startGalaxy(sim);
  // Modules spawn unpowered and the first tick has not run: allocate power now, so nothing (the "Low power" alert) reads a ship that is dark only because the game has not started.
  powerSystem(sim);
  if (populate) populateNode(sim, sim.galaxy.current);
  return sim;
}
