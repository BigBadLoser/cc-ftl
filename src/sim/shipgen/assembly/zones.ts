import type { DeptRules, ShipDept } from '../outlineRecipe';
import type { RoomSpec } from '../plan';
import type { Bay } from './bays';
import type { Frame } from './frame';
import type { BayPart } from './parts';
import type { Filler } from './roomSize';

/**
 * PROTOTYPE (#581): a lane hull's departments, each its own stretch of bays (mirrored), sized by its rooms. The forward
 * section: command at the bow, stores and the sick bay behind it, the ship's systems by the cross corridor. The side hulls: hab along the lane (the cabins)
 * and outboard of the corridor from flight ops' bays by the hangar aft to the guns, fixed in the bays by the engines. A
 * room goes only in its department's bays; floor a department leaves over is its own kind of room.
 */
export type Dept = ShipDept;

/** A department's rooms a side: floor, slots, and whether one has an annex (a bay of two tiers). */
export type Need = { area: number; rooms: number; deep?: boolean };

/** A room's department by default (a recipe's `DeptRules.of` over it). */
function deptOf(r: RoomSpec): Dept {
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
  part: BayPart['zones'], orders: Depts['forward'],
): Dept[] {
  if (!part) return [];
  // The forward section: its departments in one of the recipe's orders (command at the bow, then stores and systems,
  // either way round), each a run of bays. Of every cut, one where each has a slot a room (a department with an annex a
  // two-tier bay), the floor nearest its share.
  // (Which bays, the layout's part says: passenger decks the bays ahead of the airlocks.)
  const ks = bays.flatMap((b, k) => (part.forward(b, fr) ? [k] : [])), tiers = (k: number): number => (bays[k] as Bay).tiers.length;
  const floor = ks.reduce((t, k) => t + area(k), 0);
  let best: { cost: number; of: Dept[] } | null = null;
  for (const order of orders) {
    const total = order.reduce((t, d) => t + (need[d]?.area ?? 0), 0);
    for (const cuts of cutsOf(ks.length, order.length - 1, 1)) {
      const at = [0, ...cuts, ks.length], runs = order.map((_, n) => ks.slice(at[n], at[n + 1]));
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
  const z = { weapons, flight, out: { n: 0 } };
  return bays.map((b, k) => of.get(k) ?? part.other(b, k, z));
}

/** Every `k` cuts of `n` bays into non-empty runs, the first cut from `from`, in order. */
function cutsOf(n: number, k: number, from: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let c = from; c <= n - k; c++) for (const rest of cutsOf(n, k - 1, c + 1)) out.push([c, ...rest]);
  return out;
}

/** A department's own rooms for floor left over, taken in turn (again and again), the plainest last. */
const FILL: Record<Dept, readonly Filler[]> = {
  command: ['armoury', 'lab'], systems: ['battery', 'shop', 'workshop'], hab: ['lounge', 'gym', 'farm'],
  stores: ['provisions', 'hold'], flight: ['workshop', 'hold'], weapons: ['hold'],
};

/** A recipe's departments, resolved: each room's, each department's fillers, the once-a-ship ones, the spare rooms. */
export interface Depts {
  of: (r: RoomSpec) => Dept; fill: Record<Dept, readonly Filler[]>; once: readonly Filler[]; spare: readonly Filler[];
  forward: readonly (readonly Dept[])[];
}

/** A recipe's `DeptRules` over the defaults. */
export function deptsOf(d: DeptRules = {}): Depts {
  return {
    of: (r) => d.of?.[r.role] ?? deptOf(r),
    fill: { ...FILL, ...d.fill },
    once: d.once ?? ['lounge', 'gym', 'workshop', 'farm'],
    spare: d.spare ?? ['armoury', 'battery', 'shop', 'lab', 'provisions', 'workshop', 'lounge', 'gym', 'farm'],
    forward: d.forward ?? [['command', 'stores', 'systems'], ['command', 'systems', 'stores']],
  };
}
