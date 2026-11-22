import { DeadC, PositionC } from '../crew/components';
import { AllegianceC, PrisonerC } from '../fight/components';
import { hostileAct } from '../combat/provoke';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { guestOn } from '../consent/guests';
import { isPlayers } from '../side';

/**
 * Boarding is a hostile act (combat/provoke.ts `hostileAct`): one of the player's crew standing aboard a ship that is not the player's. It breaks a
 * truce; elsewhere it turns a mobile ship that is not hostile (stations are left to their alarm, dormant dens and outposts to dormancy). Firing is the
 * other act; the firing system reports it as the shot leaves. Guests are not boarders: the party of an aid site, on the ship that invited it (away/guests.ts).
 */
export function provocationSystem(sim: Sim): void {
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    if (!isPlayers(sim, id) || sim.world.has(id, DeadC) || sim.world.has(id, PrisonerC)) continue;
    const ship = shipIdOf(sim, sim.world.get(id, PositionC) as { x: number; y: number });
    if (ship && !isPlayers(sim, ship) && !guestOn(sim, id, ship)) hostileAct(sim, ship, 'boarded');
  }
}
