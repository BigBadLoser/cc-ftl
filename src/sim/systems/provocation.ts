import { DeadC, PositionC } from '../crew/components';
import { AllegianceC, PrisonerC } from '../fight/components';
import { ShipC } from '../combat/components';
import { provokable, provoke } from '../combat/provoke';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Boarding is a hostile act (combat/provoke.ts): a ship not hostile to the player turns when one of the player's crew stands aboard it. Stations are left
 * to their alarm (stationAlarm.ts: the player's crew are invited there while a trade run is docked, and intruders are wanted), dormant dens and
 * outposts to dormancy. Firing is the other act; the firing system provokes as the shot leaves.
 */
export function provocationSystem(sim: Sim): void {
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    if (sim.world.get(id, AllegianceC)?.faction !== 'player' || sim.world.has(id, DeadC) || sim.world.has(id, PrisonerC)) continue;
    const ship = shipIdOf(sim, sim.world.get(id, PositionC) as { x: number; y: number });
    const s = ship ? sim.world.get(ship, ShipC) : undefined;
    if (s && !s.immobile && s.dormant === undefined && provokable(sim, ship)) provoke(sim, ship, 'boarded');
  }
}
