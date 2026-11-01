import { shipById } from '../combat/ships';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { AllegianceC } from '../fight/components';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';

/** Where the player's crew stand on another ship: for the friendly-fire warning ("Your crew aboard") and the room marks. */
export interface PlayerAboard {
  /** Living player crew on the ship (downed ones included: they are still there to be hit), ascending ids. */
  crew: number[];
  /** The distinct tiles they occupy (the end of the step in progress, as damage reads it), ascending by y then x. */
  tiles: { x: number; y: number }[];
  /** The distinct rooms those tiles belong to (room ids of the ship's grid; a doorway or corridor tile with no room adds none), ascending. */
  rooms: number[];
}

/**
 * Read helper for the HUD: which rooms and tiles of a ship other than the player's hold player crew right now (boarders, a party
 * ordered to sabotage, a recalled party on its way to the shuttle). The weapon effects that hit tiles (`crewDamage`) hurt every
 * crew member in reach whatever their side, so these are the tiles where the player's own fire can kill their own boarders.
 * Empty for the player's own ships. Reads only.
 */
export function playerCrewAboard(sim: Sim, shipId: number): PlayerAboard {
  const out: PlayerAboard = { crew: [], tiles: [], rooms: [] };
  const grid = shipGrid(sim, shipId);
  if (!grid || shipById(sim, shipId)?.faction === 'player') return out;
  const seen = new Set<number>();
  const rooms = new Set<number>();
  for (const id of sim.world.query(CrewC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player' || shipIdOf(sim, pos) !== shipId) continue;
    out.crew.push(id);
    const t = origin(pos);
    const key = t.y * 100000 + t.x;
    if (!seen.has(key)) {
      seen.add(key);
      out.tiles.push({ x: t.x, y: t.y });
    }
    const room = grid.has('room') && grid.inBounds(t.x, t.y) ? grid.get('room', t.x, t.y) : 0;
    if (room) rooms.add(room);
  }
  out.crew.sort((a, b) => a - b);
  out.tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  out.rooms = [...rooms].sort((a, b) => a - b);
  return out;
}
