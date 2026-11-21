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

/** A department's rooms a side: floor, slots, and whether one has an annex (a bay of two tiers). */
export type Need = { area: number; rooms: number; deep?: boolean };

const FWD: readonly Dept[] = ['command', 'stores', 'systems'];

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
  fr: Frame, bays: readonly Bay[], weapons: ReadonlySet<number>, flight: number, need: Partial<Record<Dept, Need>>, area: (k: number) => number,
): Dept[] {
  if (!fr.lane) return [];
  // The forward section: command at the bow, then stores and systems (either way round), each a run of bays. Of every
  // cut, one where each has a slot a room (a department with an annex a two-tier bay), the floor nearest its share.
  const ks = bays.flatMap((b, k) => (b.row ? [] : [k])), tiers = (k: number): number => (bays[k] as Bay).tiers.length;
  const total = FWD.reduce((t, d) => t + (need[d]?.area ?? 0), 0), floor = ks.reduce((t, k) => t + area(k), 0);
  let best: { cost: number; of: Dept[] } | null = null;
  for (const order of [['command', 'stores', 'systems'], ['command', 'systems', 'stores']] as const) {
    for (let c1 = 1; c1 < ks.length - 1; c1++) for (let c2 = c1 + 1; c2 < ks.length; c2++) {
      const runs = [ks.slice(0, c1), ks.slice(c1, c2), ks.slice(c2)];
      let cost = 0;
      for (const [n, d] of order.entries()) {
        const run = runs[n] as number[], nd = need[d];
        const slots = run.reduce((t, k) => t + tiers(k), 0), got = run.reduce((t, k) => t + area(k), 0);
        if (nd && (slots < Math.ceil(nd.rooms) || (nd.deep && !run.some((k) => tiers(k) > 1)))) cost += 1000;
        cost += Math.abs(got / floor - (nd?.area ?? 0) / total);
      }
      if (!best || cost < best.cost) best = { cost, of: runs.flatMap((r, n) => r.map(() => order[n] as Dept)) };
    }
  }
  const of = new Map<number, Dept>(ks.map((k, n) => [k, best?.of[n] ?? 'systems']));
  let out = 0;
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
