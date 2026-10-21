import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import type { Sim } from '../sim';

/**
 * The sector is "in combat" while a player ship and a ship at war with the player (hostile or rogue) are both still in play (active or disabled;
 * wrecks and ships that fled are out; a dormant pirate den does not count until provoked). Flips sim.sector.inCombat and announces the change. Consoles are only
 * manned while it is set.
 */
export function combatStateSystem(sim: Sim): void {
  let player = false;
  let hostile = false;
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled') || ship.dormant !== undefined) continue;
    if (ship.faction === 'player') player = true;
    else if (factionsHostile(ship.faction, 'player')) hostile = true;
  }
  const engaged = player && hostile;
  if (engaged === sim.sector.inCombat) return;
  sim.sector.inCombat = engaged;
  sim.events.emit({ type: engaged ? 'combat.started' : 'combat.ended' });
}
