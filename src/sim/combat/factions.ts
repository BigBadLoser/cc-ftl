import type { Sim } from '../sim';
import type { Faction } from './components';
import { ShipC } from './components';

/**
 * The allegiance model: are two factions at war? Different factions are, except that neutral is at war with nobody,
 * but the rogue AI and aliens are at war with everyone (neutral included). The same faction never is.
 */
export function factionsHostile(a: Faction | undefined, b: Faction | undefined): boolean {
  if (!a || !b || a === b) return false;
  if (a === 'rogue' || b === 'rogue' || a === 'alien' || b === 'alien') return true;
  return a !== 'neutral' && b !== 'neutral';
}

/** True for factions whose ships an AI doctrine runs (everything but the player and neutrals). */
export function isAiFaction(f: Faction): boolean {
  return f === 'hostile' || f === 'rogue';
}

/** Is the ship generator-built by a faction whose crews never surrender (the zealots)? Such a ship is never taken as a prize. */
export function neverSurrenders(sim: Sim, shipId: number): boolean {
  const gen = sim.world.get(shipId, ShipC)?.gen?.faction;
  return !!gen && !!sim.content.factions?.[gen]?.neverSurrender;
}

/**
 * Is the ship a machine ally: not on the rogue side itself, but fielded by a galaxy faction that flies on it (the zealots)? Such a ship may sit on the
 * neutral side while the player's standing with it is good, and the Rogue AI still never fights it, whatever that standing.
 */
export function rogueAlly(sim: Sim, shipId: number): boolean {
  const ship = sim.world.get(shipId, ShipC);
  const owner = ship?.gen?.owner;
  return !!ship && ship.faction !== 'rogue' && !!owner && sim.content.galaxy?.factions[owner]?.combatFaction === 'rogue';
}
