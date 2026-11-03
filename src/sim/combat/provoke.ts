import { banned, breachTruce, truceHolds } from '../blackmarket/truce';
import { markProvoked, shipmates } from '../galaxy/groups';
import type { Sim } from '../sim';
import { ShipC } from './components';
import { factionsHostile } from './factions';
import { turnShip } from './turn';

/**
 * Hostile acts (#173; user ruling 2026-11-03). One rule, and this the one entry point: only a shot that leaves a player weapon (firing.ts) or the
 * player's crew standing aboard (provocation.ts) is a hostile act. Aiming is not: nothing reads an aim as aggression.
 *
 * - At a black-market truce node the act breaks the truce (`breachTruce`: the ban turns everyone there for its length, then lets them go).
 * - Elsewhere a ship that is not hostile to the player is provoked: it and the ships that came with it (its fleet, a scene's ships) go over to their
 *   owner's combat side (`turnShip`, its people included), so the ordinary combat AI fights or flees and their crew defend. The group is recorded
 *   once (`galaxy.provoked`, galaxy/groups.ts), and every ship of it made real later comes in hostile from that record. Nothing turns them back.
 */

/** True for a ship the player's fire or boarding would provoke: in play, not the player's, not already at war with the player. */
export function provokable(sim: Sim, ship: number): boolean {
  const s = sim.world.get(ship, ShipC);
  return !!s && s.faction !== 'player' && !factionsHostile(s.faction, 'player') && (s.state === 'active' || s.state === 'disabled');
}

/**
 * A hostile act on a ship. `boarded` acts leave stations (their alarm: stations/alarm) and dormant ships (dormancy) to their own rules, except that
 * any act breaks a truce, as before.
 */
export function hostileAct(sim: Sim, ship: number, why: 'fired' | 'boarded'): void {
  const s = sim.world.get(ship, ShipC);
  if (!s || s.faction === 'player' || (s.state !== 'active' && s.state !== 'disabled')) return;
  if (truceHolds(sim)) return breachTruce(sim);
  if (banned(sim)) return; // the ban has every ship there for its length, and gives them back after
  if (why === 'boarded' && (s.immobile || s.dormant !== undefined)) return;
  provoke(sim, ship, why);
}

/** Turn the ship and its group hostile to the player and record the group; `why` is kept on the ship itself. No-op for a ship that is not provokable. */
function provoke(sim: Sim, ship: number, why: 'fired' | 'boarded'): void {
  if (!provokable(sim, ship)) return;
  markProvoked(sim, ship);
  for (const mate of shipmates(sim, ship)) {
    const s = sim.world.get(mate, ShipC);
    if (!s || !provokable(sim, mate)) continue;
    turnShip(sim, mate, sim.content.galaxy?.factions[s.gen?.owner ?? '']?.combatFaction ?? 'hostile');
    if (mate === ship) s.provoked = why;
    sim.events.emit({ type: 'ship.provoked', ship: mate, reason: why });
  }
}
