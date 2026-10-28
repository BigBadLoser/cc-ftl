import { shipGrid } from '../sim/regions';
import { CombatC, PositionC, ShipC, roomTiles, type Grid, type Sim } from '../sim';
import { factionsHostile } from '../sim/combat/factions';
import type { UiSubject } from '../ui/api';

/** Helpers that name what an event is about, so log entries and alerts can jump to it (UI-side, read-only). */
export const tileAt = (x: number, y: number): UiSubject => ({ kind: 'tile', x, y });

export function roomCentre(grid: Grid | undefined, room: number): UiSubject | null {
  const tiles = grid ? roomTiles(grid).get(room) : undefined;
  if (!grid || !tiles?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const i of tiles) {
    sx += grid.x0 + (i % grid.width);
    sy += grid.y0 + Math.floor(i / grid.width);
  }
  return tileAt(Math.round(sx / tiles.length), Math.round(sy / tiles.length));
}

export const roomOf = (sim: Sim, ship: number, room: number): UiSubject | null => roomCentre(shipGrid(sim, ship), room);

/** A crew member, or null when they are gone. */
export const crewSubject = (sim: Sim, id: number): UiSubject | null => (sim.world.has(id, PositionC) ? { kind: 'crew', id } : null);

/** Where a crew member stands, as a tile (for the dead: the entity may be gone by the time anyone clicks). */
export function crewTile(sim: Sim, id: number): UiSubject | null {
  const p = sim.world.get(id, PositionC);
  return p ? tileAt(Math.round(p.x), Math.round(p.y)) : null;
}

export function shipSubject(sim: Sim, ship: number): UiSubject | null {
  const s = sim.world.get(ship, ShipC);
  return s ? { kind: 'ship', id: ship } : null;
}

/** The nearest-by-id hostile ship that is in combat with the player: what `combat.started` jumps to. */
export function enemyShip(sim: Sim, home: number): UiSubject | null {
  const me = sim.world.get(home, ShipC);
  for (const id of sim.world.query(ShipC, CombatC)) {
    if (id === home) continue;
    if (factionsHostile(sim.world.get(id, ShipC)?.faction, me?.faction ?? 'player')) return { kind: 'ship', id };
  }
  return null;
}
