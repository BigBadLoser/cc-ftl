import type { Layout } from './layout';
import type { RoomRole } from './types';

/** Rooms open to passers-by: a door between two of these (not two corridors) becomes an archway. */
const OPEN: readonly RoomRole[] = ['hall', 'support', 'plaza', 'garden', 'drill'];

/**
 * Archways (stations): a door that joins a corridor to a mess or courtyard, or two such rooms, is taken out and left
 * as a gap in the wall (user decision: nobody needs privacy there, and fewer doors read cleaner). Doors between two
 * corridors stay, as bulkheads, and so does every door of a room that is not open. The whole door goes (a wide door
 * leaves a wide gap). Runs after fit-out, so the tiles behind the gap are already clear. The sim reads the joined
 * floor as one room (one air space). Edits `lay.cells` and `lay.roomOf` in place; returns the tiles opened.
 */
export function openArchways(lay: Layout): number {
  const { w } = lay;
  const seen = new Uint8Array(lay.cells.length);
  let opened = 0;
  for (let i = 0; i < lay.cells.length; i++) {
    if (lay.cells[i] !== 'D' || seen[i]) continue;
    const tiles: number[] = [];
    const rooms = new Set<number>();
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const j = stack.pop() as number;
      tiles.push(j);
      for (const n of lay.neighbours(j)) {
        if (lay.cells[n] === 'D' && !seen[n]) { seen[n] = 1; stack.push(n); }
        else if (lay.cells[n] === '_' && (lay.roomOf[n] as number) >= 0) rooms.add(lay.roomOf[n] as number);
      }
    }
    const roles = [...rooms].map((r) => lay.roles[r] as RoomRole);
    if (rooms.size < 2 || !roles.every((r) => OPEN.includes(r)) || roles.every((r) => r === 'hall')) continue;
    // Only a door in a straight partition: wall both sides along it, so the gap stays a passage, not a hole in a corner.
    if (!tiles.every((t) => straight(lay, t, w))) continue;
    const to = [...rooms].find((r) => lay.roles[r] !== 'hall') as number;
    for (const t of tiles) { lay.cells[t] = '_'; lay.roomOf[t] = to; }
    opened += tiles.length;
  }
  return opened;
}

/** A door tile with floor across it on one axis and wall or door along the other. */
function straight(lay: Layout, i: number, w: number): boolean {
  const c = (j: number): string => lay.cells[j] ?? '.';
  const across = (d: number): boolean => c(i + d) === '_' && c(i - d) === '_';
  const along = (d: number): boolean => (c(i + d) === '#' || c(i + d) === 'D') && (c(i - d) === '#' || c(i - d) === 'D');
  return (across(1) && along(w)) || (across(w) && along(1));
}
