import { ShipC, type Ship } from '../combat/components';
import { regions } from '../regions';
import { roomTiles } from '../roomIndex';
import { ROOM_TEMP_EPSILON, clearRoomTemp, setRoomTemp } from '../roomTemp';
import type { Sim } from '../sim';
import type { Grid } from '../grid';
import { isAirless } from '../structure';
import { NORMAL_TEMP, SPACE_TEMP, TEMP_AMBIENT_LOSS, TEMP_BREACH_COOL, TEMP_VACUUM_O2 } from '../tuning';
import { TICK_HZ } from '../time';

/** Per-ship cache of which rooms touch Space, valid for one (room, struct) revision pair. Derived from the grid alone, never saved; keyed by sim so a load recomputes it. */
interface Exposure {
  room: number;
  struct: number;
  open: Map<number, boolean>;
}
/** The vacuum scan (every tile of every room) runs once in this many ticks; `Ship.roomVacuum` holds its result between scans. */
const VACUUM_SCAN_TICKS = 10;
const cache = new WeakMap<Sim, Map<number, Exposure>>();

/** Rooms that touch Space or rock ground (a breach). */
function breachedRooms(sim: Sim, ship: number, grid: Grid): ReadonlyMap<number, boolean> {
  let perShip = cache.get(sim);
  if (!perShip) cache.set(sim, (perShip = new Map()));
  const room = grid.revision('room');
  const struct = grid.revision('struct');
  const hit = perShip.get(ship);
  if (hit && hit.room === room && hit.struct === struct) return hit.open;
  const kinds = grid.load('struct');
  const w = grid.width;
  const airless = (j: number): boolean => j >= 0 && j < kinds.length && isAirless(kinds[j] as number);
  const open = new Map<number, boolean>();
  for (const [r, tiles] of roomTiles(grid)) {
    open.set(r, tiles.some((i) => airless(i - w) || airless(i + w) || (i % w > 0 && airless(i - 1)) || (i % w < w - 1 && airless(i + 1))));
  }
  perShip.set(ship, { room, struct, open });
  return open;
}

/** Rooms with a vacuum tile (vented air, a sealed wreck): the last scan's result, rescanned every VACUUM_SCAN_TICKS ticks. Kept on the ship so a load continues it exactly. */
function vacuumRooms(sim: Sim, s: Ship, grid: Grid): readonly number[] {
  if (s.roomVacuum && sim.tick % VACUUM_SCAN_TICKS !== 0) return s.roomVacuum;
  const o2 = grid.load('o2');
  const found: number[] = [];
  for (const [r, tiles] of roomTiles(grid)) if (tiles.some((i) => (o2[i] as number) < TEMP_VACUUM_O2)) found.push(r);
  return (s.roomVacuum = found);
}

/**
 * One temperature per room (stored on the ship, roomTemp.ts). Fire and reactors add heat to their room earlier in the tick.
 * Here every room relaxes toward NORMAL_TEMP (radiators), and a room with a vacuum tile (a breach) also cools toward
 * SPACE_TEMP, slower the bigger the room. Rooms with no entry are at NORMAL_TEMP and, if sealed, cost nothing.
 */
export function temperatureSystem(sim: Sim): void {
  for (const { grid, ship } of regions(sim)) {
    if (!grid.has('room') || !grid.has('o2')) continue;
    const s = sim.world.get(ship, ShipC);
    if (!s) continue;
    const temps = s.roomTemp;
    const breached = breachedRooms(sim, ship, grid);
    const open = new Set<number>(vacuumRooms(sim, s, grid));
    for (const [r, b] of breached) if (b) open.add(r);
    const tiles = roomTiles(grid);
    // Settled rooms drop out of the map as they relax, so only the warm and cold ones are walked, plus every open room (they cool from normal).
    const rooms = new Set<number>(temps ? Object.keys(temps).map(Number) : []);
    for (const r of open) rooms.add(r);
    for (const r of rooms) {
      const n = tiles.get(r)?.length ?? 0;
      let t = temps?.[r] ?? NORMAL_TEMP;
      if (n === 0) {
        clearRoomTemp(sim, ship, r); // a stale entry for a room that no longer exists
        continue;
      }
      t += (NORMAL_TEMP - t) * TEMP_AMBIENT_LOSS;
      if (open.has(r)) t += (SPACE_TEMP - t) * Math.min(1, TEMP_BREACH_COOL / TICK_HZ / n);
      if (Math.abs(t - NORMAL_TEMP) < ROOM_TEMP_EPSILON && !open.has(r)) clearRoomTemp(sim, ship, r);
      else setRoomTemp(sim, ship, r, t);
    }
  }
}
