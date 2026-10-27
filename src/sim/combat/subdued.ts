import { CrewC, DeadC, PositionC } from '../crew/components';
import { isSubdued } from '../fight/relations';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isDormant } from './dormant';
import type { Ship } from './components';

/**
 * True when an enemy ship has nothing left to fight with: it is a hostile ship (not a rogue AI one, whose fabricators replace lost robots, nor a dormant den or an outpost) that
 * had crew, every one of them is subdued (surrendered, downed or inert) or dead, and no player crew stand aboard (boarders going for a capture
 * must be left to take the ship; see capture/control). Such a ship is given up: it becomes a derelict.
 */
export function crewSubdued(sim: Sim, shipId: number, ship: Ship): boolean {
  if (ship.faction !== 'hostile' || ship.outpost || isDormant(ship)) return false;
  let crew = 0;
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== shipId) continue;
    const faction = sim.world.get(id, AllegianceC)?.faction;
    if (faction === 'player') {
      if (!sim.world.has(id, DeadC)) return false;
      continue;
    }
    crew++;
    if (!isSubdued(sim, id)) return false;
  }
  return crew > 0;
}
