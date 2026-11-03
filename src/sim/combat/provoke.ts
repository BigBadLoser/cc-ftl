import { contactOf, shipmates } from '../galaxy/fleetShips';
import type { Sim } from '../sim';
import { ShipC } from './components';
import { factionsHostile } from './factions';
import { turnShip } from './turn';

/**
 * Provoked ships fight back (#173; user ruling 2026-11-03). One rule for every ship that is not hostile to the player: aiming at it does nothing, but
 * a shot fired at it (firing.ts, as the shot leaves the weapon) or the player's crew standing aboard (provocation.ts) turns it hostile, with the ships
 * that came with it (its fleet in the node or pocket, a scene's ships). They go over to their owner's combat side (`turnShip`), so the ordinary
 * combat AI fights or flees, and their crew defend with the ordinary fight code. Nothing turns them back: their descriptors keep it
 * (`Contact.provoked`), so a fleet lifted out of the node and met again is still hostile.
 */

/** True for a ship the player's fire or boarding would provoke: in play, not the player's, not already at war with the player. */
export function provokable(sim: Sim, ship: number): boolean {
  const s = sim.world.get(ship, ShipC);
  return !!s && s.faction !== 'player' && !factionsHostile(s.faction, 'player') && (s.state === 'active' || s.state === 'disabled');
}

/** Turn the ship and its shipmates hostile to the player, recording why on the ship. No-op for a ship that is not provokable. */
export function provoke(sim: Sim, ship: number, why: 'fired' | 'boarded'): void {
  if (!provokable(sim, ship)) return;
  for (const mate of shipmates(sim, ship)) {
    const s = sim.world.get(mate, ShipC);
    if (!s || !provokable(sim, mate)) continue;
    turnShip(sim, mate, sim.content.galaxy?.factions[s.gen?.owner ?? '']?.combatFaction ?? 'hostile');
    if (mate === ship) s.provoked = why;
    const c = contactOf(sim, mate);
    if (c) c.provoked = true; // it stays hostile when lifted out and made real again (spawnContact)
    sim.events.emit({ type: 'ship.provoked', ship: mate, reason: why });
  }
}
