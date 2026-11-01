import { CrewC, DeadC, PositionC } from '../crew/components';
import { isSubdued } from '../fight/relations';
import { AllegianceC } from '../fight/components';
import { playerReach } from '../boarding/reach';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isDormant } from './dormant';
import type { Ship } from './components';

/**
 * True when an enemy ship has nothing left to fight with: it is a hostile ship (not a machine-crewed rogue AI one, whose fabricators replace lost robots, nor a dormant den or an outpost) that
 * had crew, every one of them is subdued (surrendered, downed or inert) or dead, and the player cannot take it. Such a ship is given up: it
 * becomes a derelict.
 *
 * The player can still take it (so it is not given up) while `playerReach` says so: player crew stand aboard, or a player shuttle
 * with someone in it is docked at the ship, flying to dock or hover at it, or hovering beside it. Boarders who step off before the
 * bridge hold is complete (back into their shuttle, or out of the ship for a moment) must not turn a near-capture into a wreck;
 * the ship is wrecked only once the player has no way left to reach it.
 */
export function crewSubdued(sim: Sim, shipId: number, ship: Ship): boolean {
  // A rogue-side ship counts too when it is crewed by the living (the zealots, allied to the machines): nothing replaces its dead.
  const crewed = ship.faction === 'hostile' || (ship.faction === 'rogue' && !!ship.gen && !!sim.content.factions?.[ship.gen.faction]?.living);
  if (!crewed || ship.outpost || isDormant(ship)) return false;
  let crew = 0;
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== shipId) continue;
    const faction = sim.world.get(id, AllegianceC)?.faction;
    if (faction === 'player') {
      if (!sim.world.has(id, DeadC)) return false; // a living boarder: they are there to take the ship
      continue;
    }
    crew++;
    if (!isSubdued(sim, id)) return false;
  }
  return crew > 0 && !playerReach(sim, shipId);
}
