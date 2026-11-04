import { ShipC } from '../combat/components';
import { isDormant, wake } from '../combat/dormant';
import type { Sim } from '../sim';

/**
 * Dormant ships (pirate dens, outposts) wake when provoked. A hostile act wakes them where it happens (combat/provoke.ts `hostileAct`: a shot fired at
 * them, a player crew member aboard); aiming alone does not (user ruling, #173). This system catches the rest: damage from anyone (integrity below
 * what they had when they went quiet). Until then the enemy AI leaves them alone and they do not put the node in combat. Outposts also wake on a dig
 * or breach into them (crew/handlers.ts, systems/outposts.ts); every wake goes through `wake` (combat/dormant.ts).
 */
export function dormancySystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (isDormant(ship) && ship && ship.integrity < (ship.dormant as number) - 1e-6) wake(sim, id, 'damaged');
  }
}
