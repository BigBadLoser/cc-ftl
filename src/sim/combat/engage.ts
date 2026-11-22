import { inEngagement, opposed } from '../galaxy/engagements';
import type { Sim } from '../sim';
import { ShipC } from './components';
import { factionsHostile, isAiFaction, rogueAlly } from './factions';
import { PLAYER } from '../side';

/**
 * Who fights whom, ship by ship (#603). The grid sides (`Ship.faction`) say how a ship stands to the player; two NPC ships fight each other
 * when their sides are at war (the rogue AI, aliens) or when they are on opposite sides of a fight going on here (galaxy/engagements.ts: two
 * fleets at war that met in the player's node, or allies taking on a ship that attacked the player). These are the one answer every
 * combat system reads.
 */

/**
 * Are the two ships foes? At war by their sides (the Rogue AI never fights its machine allies, the zealots), or on opposite sides of a fight
 * here. Symmetric. A ship is never its own foe.
 */
export function shipsHostile(sim: Sim, a: number, b: number): boolean {
  const sa = sim.world.get(a, ShipC);
  const sb = sim.world.get(b, ShipC);
  if (!sa || !sb || a === b) return false;
  if (factionsHostile(sa.faction, sb.faction)) {
    if (sa.faction === 'rogue' && rogueAlly(sim, b)) return false;
    return !(sb.faction === 'rogue' && rogueAlly(sim, a));
  }
  return opposed(sim, a, b);
}

/** Is the ship in a fight now: the player's (`sector.inCombat`, which keeps every ship at its stations as before), or a fight between NPC ships here it is part of? */
export const atBattle = (sim: Sim, ship: number): boolean => sim.sector.inCombat || inEngagement(sim, ship);

/** Is any fight on in the sector: the player's, or one between NPC ships? */
export const battleAnywhere = (sim: Sim): boolean => sim.sector.inCombat || !!sim.sector.engagements?.length;

/** Does the combat AI run this ship: a hostile or rogue side, or an NPC ship of any side in a fight here (a neutral trader runs, a neutral patrol shoots back)? Never the player's. */
export function aiRuns(sim: Sim, ship: number): boolean {
  const s = sim.world.get(ship, ShipC);
  return !!s && s.faction !== PLAYER && (isAiFaction(s.faction) || inEngagement(sim, ship));
}
