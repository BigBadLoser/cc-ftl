import { ShipC, type Ship } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { portsAt } from './portIndex';
import { repKey, tierOf } from './standing';
import { nodeState } from './state';
import {
  CAPTURE_FACTOR, CLEAR_COST_PER_POINT, KILL_NOTORIETY, KILL_REPUTATION, LAW_KINDS, NOTORIETY_DECAY, NOTORIETY_DECAY_MIN, NOTORIETY_MAX,
  STATION_NOTORIETY, WANTED_AT,
} from './tuningHeat';
import type { Contact } from './types';

/**
 * The player's notoriety (see tuningHeat.ts). One number on `GalaxyState.heat`, written only here: kills and captures the player made
 * (`tallyLosses`, from the galaxy system), story effects (`addNotoriety`), the per-turn decay and paying it off at a pirate den.
 * Kills are attributed in sim state, never from events: `wreckShip` marks a ship the player was shooting at (`Ship.killedBy`), a capture is
 * always the player's, and `Ship.tallied` keeps each one from counting twice.
 */

export const notorietyOf = (sim: Sim): number => sim.galaxy.heat.notoriety;
export const isWanted = (sim: Sim): boolean => sim.galaxy.heat.notoriety >= WANTED_AT;
export const isLaw = (sim: Sim, faction: string): boolean => LAW_KINDS.includes(sim.content.galaxy?.factions[faction]?.kind ?? '');

/**
 * Reputation the player has lost with a faction through what they did (negative reputation; a base standing is not a grudge). Factions sharing a
 * reputation key share their grudge.
 */
export const grudgeOf = (sim: Sim, faction: string): number => Math.max(0, -reputationOf(sim.story, repKey(sim, faction)));

export function addNotoriety(sim: Sim, delta: number, faction: string | null = null): void {
  const h = sim.galaxy.heat;
  const before = h.notoriety;
  h.notoriety = Math.round(Math.max(0, Math.min(NOTORIETY_MAX, before + delta)) * 100) / 100;
  if (h.notoriety === before) return;
  sim.galaxy.rev++;
  sim.events.emit({ type: 'galaxy.notoriety', value: h.notoriety, delta: Math.round((h.notoriety - before) * 100) / 100, faction });
}

/** One turn of decay. */
export function decayNotoriety(sim: Sim): void {
  const n = sim.galaxy.heat.notoriety;
  if (n <= 0) return;
  const drop = Math.max(NOTORIETY_DECAY_MIN, n * NOTORIETY_DECAY);
  const h = sim.galaxy.heat;
  h.notoriety = n <= drop ? 0 : Math.round((n - drop) * 100) / 100;
  sim.galaxy.rev++;
}

/** The galaxy faction a ship in the active sector flies for: from its node or fleet descriptor, else its combat side's faction. */
function factionOfShip(sim: Sim, id: number, ship: Ship): string | null {
  const g = sim.galaxy;
  const owns = (cs: readonly Contact[]): Contact | undefined => cs.find((c) => c.ship === id);
  const c = owns(g.event?.fleet.ships ?? []) ?? g.fleets.map((f) => owns(f.ships)).find(Boolean) ?? owns(nodeState(sim, g.current).contacts);
  if (c) return c.faction;
  // No descriptor (a debug spawn, a ship from an old archive): the galaxy faction whose combat side it is, or the only one flying its generator.
  const factions = sim.content.galaxy?.factions ?? {};
  const ids = Object.keys(factions).sort();
  const side = ids.find((f) => factions[f]?.combatFaction === ship.faction);
  if (side) return side;
  const flying = ship.gen ? ids.filter((f) => factions[f]?.ships.some((w) => w.value === ship.gen?.faction)) : [];
  return flying.length === 1 ? (flying[0] as string) : null;
}

/** What destroying (or taking) this ship costs: notoriety and the reputation the victim faction loses. */
function charge(sim: Sim, id: number, ship: Ship, captured: boolean): void {
  const faction = factionOfShip(sim, id, ship);
  const def = faction ? sim.content.galaxy?.factions[faction] : undefined;
  const tier = faction ? tierOf(sim, faction) : factionsHostile(ship.faction, 'player') ? 'hostile' : 'neutral';
  let n = ship.immobile ? STATION_NOTORIETY : def?.alwaysHostile ? 0 : KILL_NOTORIETY[tier];
  if (captured) n *= CAPTURE_FACTOR;
  if (faction) {
    const key = repKey(sim, faction);
    sim.story.reputation[key] = reputationOf(sim.story, key) - KILL_REPUTATION;
  }
  addNotoriety(sim, n, faction);
}

/** Count the ships the player destroyed or captured since the last call. Called by the galaxy system before contacts and fleets are pruned. */
export function tallyLosses(sim: Sim): void {
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC) as Ship;
    if (ship.tallied || ship.faction === 'player') continue;
    const captured = ship.state === 'prize';
    if (!captured && !(ship.state === 'wreck' && ship.killedBy === 'player')) continue;
    ship.tallied = true;
    charge(sim, id, ship, captured);
  }
}

/** What clearing all notoriety costs now. */
export const clearCost = (sim: Sim): number => Math.ceil(sim.galaxy.heat.notoriety * CLEAR_COST_PER_POINT);

/** Can the player pay off their notoriety here (a pirate den at the node they are at)? Null when yes, else the reject reason. */
export function clearBlocker(sim: Sim): string | null {
  if (sim.galaxy.heat.notoriety <= 0) return 'notNotorious';
  if (sim.sector.state !== 'active' || sim.galaxy.event) return 'notHere';
  if (!portsAt(sim, sim.galaxy.current).some((p) => p.kind === 'den')) return 'noDen';
  if (sim.trade.credits < clearCost(sim)) return 'cantAfford';
  return null;
}

/** `galaxy.clearNotoriety`: pay a pirate den to make the record go away. */
export function clearNotoriety(sim: Sim): boolean {
  const why = clearBlocker(sim);
  if (why) return (sim.events.emit({ type: 'command.rejected', command: 'galaxy.clearNotoriety', reason: why }), false);
  sim.trade.credits -= clearCost(sim);
  addNotoriety(sim, -sim.galaxy.heat.notoriety);
  return true;
}
