import type { Faction } from '../combat/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ensureTrader } from '../trade/traders';
import { spawnContact } from '../galaxy/arrivals';
import type { SceneShip, SceneSpec, Stance } from './types';

/**
 * Making a scene real in its pocket: its ships through the node-contact path (`spawnContact`: the generator, the deploy bounds, the gap rule), on the
 * side their stance gives, with the crew, stock and wallet the spec rolled; its timers start. The scene sets conditions only: what happens next is
 * the sim's.
 */

/** The combat side a stance puts a ship on: hostile ones on their owner's side, the rest neutral. */
function sideOf(sim: Sim, owner: string, stance: Stance): Faction {
  return stance === 'hostile' ? sim.content.galaxy?.factions[owner]?.combatFaction ?? 'hostile' : 'neutral';
}

/** Spawn one scene ship (false: no room yet, retried by `tendScene`). Its trade stock and wallet are the scene's when it rolled them. */
function spawnSceneShip(sim: Sim, s: SceneShip): boolean {
  const opts = { side: sideOf(sim, s.contact.faction, s.stance), ...(s.crew !== undefined ? { crew: s.crew } : {}) };
  if (!spawnContact(sim, sim.galaxy.current, s.contact, opts) || s.contact.ship === undefined) return false;
  if (s.cargo || s.credits !== undefined) {
    const t = ensureTrader(sim, s.contact.ship);
    if (t && s.cargo) t.stock = s.cargo.map((q) => ({ ...q }));
    if (t && s.credits !== undefined) t.credits = s.credits;
  }
  return true;
}

/** Open a scene in the (fresh) event grid: spawn its ships and start its timers. */
export function openScene(sim: Sim, spec: SceneSpec): void {
  for (const s of spec.ships) if (s.contact.ship === undefined) spawnSceneShip(sim, s);
  for (const t of spec.timers) t.at = sim.tick + Math.round(t.afterSec * TICK_HZ);
}

/** Retry the scene's ships that found no room. True when one came. */
export function tendScene(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
  for (const s of spec.ships) if (s.contact.ship === undefined && spawnSceneShip(sim, s)) changed = true;
  return changed;
}
