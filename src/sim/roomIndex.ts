import type { Grid } from './grid';

interface Cached {
  rev: number;
  rooms: Map<number, number[]>;
}
const cache = new WeakMap<Grid, Cached>();

/**
 * Tile indices (y * width + x, ascending) of every room, keyed by room id. Cached per grid until
 * the `room` field changes, so systems can share it without calling each other. Read-only.
 */
export function roomTiles(grid: Grid): ReadonlyMap<number, readonly number[]> {
  const rev = grid.revision('room');
  const hit = cache.get(grid);
  if (hit && hit.rev === rev) return hit.rooms;
  const rooms = new Map<number, number[]>();
  const room = grid.raw('room');
  for (let i = 0; i < room.length; i++) {
    const r = room[i] as number;
    if (r === 0) continue;
    const list = rooms.get(r);
    if (list) list.push(i);
    else rooms.set(r, [i]);
  }
  cache.set(grid, { rev, rooms });
  return rooms;
}
