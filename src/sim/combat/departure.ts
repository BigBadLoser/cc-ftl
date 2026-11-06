import type { DepartReason } from '../events';
import type { Sim } from '../sim';
import { ShipC } from './components';

/**
 * Report a ship leaving the grid (`ship.departed`): the one emit point for every way out (lifted out, jumped away, wrecked), and the one rule for
 * "reported once": only a non-player ship still in play (active or disabled) is reported, so call this before the change that ends its
 * time in play (state 'fled' or 'wreck', or the lift). A ship that already left that way is never reported again.
 */
export function reportDeparted(sim: Sim, shipId: number, reason: DepartReason): void {
  const s = sim.world.get(shipId, ShipC);
  if (!s || s.faction === 'player' || (s.state !== 'active' && s.state !== 'disabled')) return;
  sim.events.emit({ type: 'ship.departed', ship: shipId, name: s.name, faction: s.faction, owner: s.gen?.owner ?? '', reason, x: s.x + s.width / 2, y: s.y + s.height / 2 });
}
