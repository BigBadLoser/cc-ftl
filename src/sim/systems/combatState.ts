import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import type { Sim } from '../sim';
import { truceHolds } from '../blackmarket/truce';
import { isDormant } from '../combat/dormant';

/**
 * The sector is "in combat" while a player ship and a ship at war with the player (hostile or rogue) are both still in play (active or disabled;
 * wrecks and ships that fled are out; a dormant ship (pirate den, outpost) is no combatant until provoked). Flips sim.sector.inCombat and announces the change. Consoles are only
 * manned while it is set.
 */
export function combatStateSystem(sim: Sim): void {
  let player = false;
  let hostile = false;
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled') || isDormant(ship)) continue;
    if (ship.faction === 'player') player = true;
    else if (factionsHostile(ship.faction, 'player')) hostile = true;
  }
  const engaged = player && hostile && !truceHolds(sim);
  if (engaged === sim.sector.inCombat) return;
  sim.sector.inCombat = engaged;
  sim.events.emit({ type: engaged ? 'combat.started' : 'combat.ended' });
}
