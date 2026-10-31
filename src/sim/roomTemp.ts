import { ShipC } from './combat/components';
import type { Grid } from './grid';
import { roomTiles } from './roomIndex';
import type { Sim } from './sim';
import { isAirless } from './structure';
import { NORMAL_TEMP, SPACE_TEMP } from './tuning';

/** A stored room temperature this close to NORMAL_TEMP is dropped (absent means normal), so settled rooms cost nothing to save. Far below one tick of heat, so small inputs accumulate. */
export const ROOM_TEMP_EPSILON = 1e-3;

/** Temperature of room `room` on ship `ship`: absent entries are NORMAL_TEMP. */
export function roomTemp(sim: Sim, ship: number, room: number): number {
  return sim.world.get(ship, ShipC)?.roomTemp?.[room] ?? NORMAL_TEMP;
}

/** Set a room's temperature. Only the temperature system drops entries (once settled at NORMAL_TEMP), so small heat inputs add up. */
export function setRoomTemp(sim: Sim, ship: number, room: number, temp: number): void {
  const s = sim.world.get(ship, ShipC);
  if (s && room !== 0) (s.roomTemp ??= {})[room] = temp;
}

/** Forget a room's entry: it is at NORMAL_TEMP. */
export function clearRoomTemp(sim: Sim, ship: number, room: number): void {
  const s = sim.world.get(ship, ShipC);
  if (s?.roomTemp) delete s.roomTemp[room];
}

/** Add `heat` degrees-times-tiles to a room: its temperature rises by `heat` / the room's tile count. Tiles outside a room (doors) give nothing. */
export function addRoomHeat(sim: Sim, ship: number, grid: Grid, room: number, heat: number): void {
  const n = room ? roomTiles(grid).get(room)?.length : 0;
  if (n) setRoomTemp(sim, ship, room, roomTemp(sim, ship, room) + heat / n);
}

/**
 * The temperature a tile feels: its room's value; airless tiles (Space, rock ground) are SPACE_TEMP; a tile in no room
 * (a door, a corridor wall gap) is NORMAL_TEMP.
 */
export function tempAt(sim: Sim, ship: number, grid: Grid, x: number, y: number): number {
  if (isAirless(grid.get('struct', x, y))) return SPACE_TEMP;
  const room = grid.get('room', x, y);
  return room ? roomTemp(sim, ship, room) : NORMAL_TEMP;
}
