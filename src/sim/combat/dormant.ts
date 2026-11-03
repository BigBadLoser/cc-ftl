import type { Sim } from '../sim';
import { discoverOutpost } from '../outposts/state';
import { shieldCapacity } from './ships';
import { newHeat } from './heat';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import { CombatC, ShipC, WeaponC, type Combat, type Ship } from './components';

/**
 * Dormant ships (pirate dens, asteroid outposts): quiet until provoked. `ShipC.dormant` holds the integrity the ship had when
 * it went quiet. A dormant ship is no combatant: the enemy AI leaves it alone and it does not put the node in combat, whatever
 * its faction (combatState, enemy AI, alerts, auto-target and the hostile count all test `isDormant`). It may or may not have
 * a `CombatC`: dens do, outposts get one on waking.
 */

/** Why a dormant ship woke: aimed at, damaged, boarded (dormancySystem); dug into or breached (outpost-only triggers). */
export type WakeReason = 'aimed' | 'damaged' | 'boarded' | 'dug' | 'breach';

/** True for a ship that has not been provoked: never a combatant. */
export function isDormant(ship: Ship | undefined): boolean {
  return ship?.dormant !== undefined;
}

/**
 * The one wake path: clear `dormant`, reveal a hidden outpost, give the ship a `CombatC` if it has none, and announce
 * `ship.provoked`. No-op if the ship is not dormant.
 */
export function wake(sim: Sim, id: number, reason: WakeReason): void {
  const s = sim.world.get(id, ShipC);
  if (!s || !isDormant(s)) return;
  delete s.dormant;
  discoverOutpost(sim, id, 'provoked');
  if (!sim.world.has(id, CombatC)) {
    const layers = shieldCapacity(sim, id, false);
    const combat: Combat = {
      hold: false, volley: false, target: null, doctrine: 'random', ftl: 0,
      shield: { layers, max: layers, timer: 0 }, heat: newHeat(), evasion: 0, pilot: 0, cruisePilot: 0, cruiseEvasion: 0, aiTimer: 0,
    };
    sim.world.add(id, CombatC, combat);
  }
  sim.events.emit({ type: 'ship.provoked', ship: id, reason });
}

/** Ships a player ship aims at, ship-wide or with any weapon: what counts as being fired on (dormancy wakes on it, the scene observer reads it). */
export function aimedByPlayer(sim: Sim): Set<number> {
  const aimedAt = new Set<number>();
  for (const id of sim.world.query(ShipC, CombatC)) {
    if (sim.world.get(id, ShipC)?.faction !== 'player') continue;
    const t = sim.world.get(id, CombatC)?.target;
    if (t?.ship) aimedAt.add(t.ship);
  }
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const t = sim.world.get(id, WeaponC)?.target;
    if (!t?.ship) continue;
    if (sim.world.get(shipIdOf(sim, sim.world.get(id, ModuleC)), ShipC)?.faction === 'player') aimedAt.add(t.ship);
  }
  return aimedAt;
}
