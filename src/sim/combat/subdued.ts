import { CrewC, DeadC, PositionC } from '../crew/components';
import { isInvader, isSubdued } from '../fight/relations';
import { inEngagement } from '../galaxy/engagements';
import { boardersReach } from '../boarding/reach';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isDormant } from './dormant';
import type { Ship } from './components';

/**
 * A crewed ship someone fights, so it can be beaten: a hostile one (not a machine-crewed rogue AI one, whose fabricators replace lost robots; the living
 * zealots count), or any ship in a fight between NPC ships here (#603: its foe answers as the player would). The one answer for `crewSubdued` and `hopeless`.
 */
export function crewedFoe(sim: Sim, shipId: number, ship: Ship): boolean {
  return ship.faction === 'hostile' || (ship.faction === 'rogue' && !!ship.gen && !!sim.content.factions?.[ship.gen.faction]?.living) || inEngagement(sim, shipId);
}

/**
 * True when an enemy ship has nothing left to fight with: it is a ship someone fights (`crewedFoe`; not a dormant den or an outpost) that
 * had crew, every one of them is subdued (surrendered, downed or inert) or dead, and no boarder can take it (`boardersReach`). Such a ship is given up: it
 * becomes a derelict.
 *
 * The player can still take it (so it is not given up) while boarders can: boarders stand aboard, or a foe's shuttle
 * with someone in it is docked at the ship, flying to dock or hover at it, or hovering beside it. Boarders who step off before the
 * bridge hold is complete (back into their shuttle, or out of the ship for a moment) must not turn a near-capture into a wreck;
 * the ship is given up only once no boarder has a way left to reach it.
 */
export function crewSubdued(sim: Sim, shipId: number, ship: Ship): boolean {
  // A rogue-side ship counts too when it is crewed by the living (the zealots, allied to the machines): nothing replaces its dead.
  if (!crewedFoe(sim, shipId, ship) || ship.outpost || isDormant(ship)) return false;
  let crew = 0;
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== shipId) continue;
    if (isInvader(sim, id)) {
      if (!sim.world.has(id, DeadC)) return false; // a living boarder: they are there to take the ship
      continue;
    }
    crew++;
    if (!isSubdued(sim, id)) return false;
  }
  return crew > 0 && !boardersReach(sim, shipId);
}
