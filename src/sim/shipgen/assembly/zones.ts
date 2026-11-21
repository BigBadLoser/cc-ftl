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

/** A room's department. */
export function deptOf(r: RoomSpec): Dept {
  if (r.role === 'weapons') return 'weapons';
  if (r.role === 'hangar') return 'flight';
  if (r.role === 'reactor' || r.role === 'shields' || r.role === 'plant' || r.role === 'core') return 'systems';
  if (r.role === 'armoury' || r.role === 'bridge') return 'command';
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
  // The forward section from the bow: command, stores, systems, each a share of its bays' floor as its rooms' (at least a bay).
  const fwd = (['command', 'stores', 'systems'] as const).filter((d) => need[d]);
  const ks = bays.flatMap((b, k) => (b.row ? [] : [k]));
  const total = fwd.reduce((t, d) => t + (need[d]?.area ?? 0), 0), floor = ks.reduce((t, k) => t + area(k), 0);
  const of = new Map<number, Dept>();
  let d = 0, upTo = 0, got = 0, slots = 0, out = 0;
  for (const [n, k] of ks.entries()) {
    // (The next department once this one has its share (nearest) and a slot a room, while enough bays are left for
    // those after it.)
    const enough = (): boolean => got + area(k) / 2 >= upTo && slots >= Math.ceil(need[fwd[d] as Dept]?.rooms ?? 0);
    while (d < fwd.length - 1 && got > 0 && (enough() || ks.length - n <= fwd.length - 1 - d)) { d++; got = 0; slots = 0; }
    if (got === 0) upTo = (floor * (need[fwd[d] as Dept]?.area ?? 0)) / total;
    of.set(k, (fwd[d] ?? 'systems') as Dept);
    got += area(k);
    slots += (bays[k] as Bay).tiers.length;
  }
  return bays.map((b, k) => {
    if (!b.row) return of.get(k) ?? 'systems';
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
