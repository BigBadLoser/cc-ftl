import type { RoomSpec } from '../plan';
import type { Bay } from './bays';
import type { Frame } from './frame';
import type { Filler } from './roomSize';

/**
 * PROTOTYPE (#581): a lane hull's departments, each its own stretch of bays (mirrored), sized by its rooms. The forward
 * section: command at the bow, stores and the sick bay behind it, the ship's systems by the cross corridor. The side hulls: hab along the lane (the cabins)
 * and outboard of the corridor from flight ops' bays by the hangar aft to the guns, fixed in the bays by the engines. A
 * room goes only in its department's bays; floor a department leaves over is its own kind of room.
 */
export type Dept = 'command' | 'systems' | 'hab' | 'stores' | 'flight' | 'weapons';

/** Floor a forward department takes over its rooms' plan (a side's), at least: room to grow and its own spare rooms. */
const ROOM = 1.6;

/** A room's department. */
export function deptOf(r: RoomSpec): Dept {
  if (r.role === 'weapons') return 'weapons';
  if (r.role === 'hangar') return 'flight';
  if (r.role === 'reactor' || r.role === 'shields' || r.role === 'plant') return 'systems';
  if (r.role === 'core' || r.role === 'armoury' || r.role === 'bridge') return 'command';
  if (r.role === 'cargo' && r.dept !== 'commons') return 'stores';
  // (Stores and the sick bay: the forward section, by the cross corridor's airlocks.)
  if (r.role === 'industry' || r.role === 'medbay') return 'stores';
  return 'hab';
}

/**
 * Each bay's department: `flight` outboard bays from the hangar, `weapons` the bays the guns are fixed in; `need` each
 * forward department's rooms' floor and count a side, `area` a bay's floor (a side).
 */
export function zonesOf(
  fr: Frame, bays: readonly Bay[], weapons: ReadonlySet<number>, flight: number, need: Partial<Record<Dept, { area: number; rooms: number }>>, area: (k: number) => number,
): Dept[] {
  if (!fr.lane) return [];
  // The forward section from the bow: command, then stores, each as many bays as hold its rooms; systems the rest.
  const fwd: Dept[] = ['command', 'stores', 'systems'];
  let out = 0, got = 0, slots = 0, d = 0;
  const done = (): boolean => { const n = need[fwd[d] as Dept]; return !n || (got >= ROOM * n.area && slots >= n.rooms); };
  return bays.map((b, k) => {
    if (!b.row) {
      while (d < 2 && done()) { d++; got = 0; slots = 0; }
      got += area(k); slots += b.tiers.length;
      return fwd[d] as Dept;
    }
    if (b.row.dir < 0) return 'hab';
    if (weapons.has(k)) return 'weapons';
    return out++ < flight ? 'flight' : 'hab';
  });
}

/** A department's own rooms for floor left over, taken in turn (again and again), the plainest last. */
export const DEPT_FILL: Record<Dept, Filler[]> = {
  command: ['armoury', 'lab'], systems: ['battery', 'shop', 'workshop'], hab: ['lounge', 'gym', 'farm'],
  stores: ['provisions', 'hold'], flight: ['workshop', 'hold'], weapons: ['hold'],
};
