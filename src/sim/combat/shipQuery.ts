import type { Sim } from '../sim';
import { guardPacked } from '../packedGuard';
import { ShipC, type Ship } from './components';

/**
 * Ship lookups with no dependencies beyond the ship component: which ship an id is, whether it may act, which one is the player's home.
 * Kept apart from combat/ships.ts (spawning and stamping) so the many modules that only ask these questions don't import the spawner (#553).
 */
/** The ship with this ShipC entity id (the ship id), or undefined. */
export function shipById(sim: Sim, ship: number): Ship | undefined {
  return ship ? sim.world.get(ship, ShipC) : undefined;
}

/**
 * May this ship act on its own: fire and charge its weapons, run its AI, launch boarders and drones, jump away? Only while it is `active` and has not
 * yielded (`Ship.yielded`: its whole crew is beaten and waits on the player's answer). The one answer for the weapon, AI, boarding, drone and flee checks.
 */
export function shipCanAct(ship: Ship | undefined): boolean {
  return ship?.state === 'active' && !ship.yielded;
}

/** The player's home ship: the lowest-id ship of the player's faction (the starting ship; later ships, prizes included, have higher ids), or 0. */
export function homeShip(sim: Sim): number {
  guardPacked(sim, 'homeShip');
  let best = 0;
  for (const id of sim.world.query(ShipC)) if (sim.world.get(id, ShipC)?.faction === 'player' && (best === 0 || id < best)) best = id;
  return best;
}
