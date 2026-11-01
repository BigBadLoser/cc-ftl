import { abortTask } from '../ai/task';
import { releaseBedOwner } from '../crew/beds';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { EvaFloatC } from '../eva/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Stranded parties are lost. When a hostile ship leaves (it jumps away: `how` 'fled', or it is lifted out of the node with the
 * fleet: 'lifted'), the player crew still standing on it go with it and are gone for good: they leave the world with a
 * `crew.leftWithShip` event each (no story hook yet). Crew floating outside it in a suit are not aboard and stay, and a
 * destroyed ship needs no such rule: `wreckShip` kills everyone on its grid, the player's boarders included.
 * Returns the crew lost.
 */
export function loseStrandedCrew(sim: Sim, shipId: number, how: 'fled' | 'lifted'): number[] {
  const lost: number[] = [];
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC) || sim.world.has(id, EvaFloatC) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC)) === shipId) lost.push(id);
  }
  for (const id of lost) {
    abortTask(sim, id, 'removed');
    releaseBedOwner(sim, id);
    sim.events.emit({ type: 'crew.leftWithShip', crew: id, ship: shipId, how });
    sim.world.destroyEntity(id);
  }
  return lost;
}
