import type { Rng } from '../rng';
import type { RoomSpec } from './plan';
import { byPull, pullOf } from './stationDistricts';

/**
 * Departments on round stations ([docs/STATIONFLOWS.md](../../../docs/STATIONFLOWS.md), step 1): the station plan's rooms
 * regrouped by job before the layout. Freight: the plan's many small crate rooms (`cargoSpec`, six crates each) and the
 * kind's stores merge into a few warehouses, large rectangles laid out in aisles at fit-out, that stand as machine-like
 * rooms between the rings instead of as band segments stretched along the ring.
 */

/** Crates a warehouse holds at most; more make a second one. */
const WAREHOUSE = 24;

/** The plan's cargo rooms merged into warehouses (pinned rooms stay as they are); the other rooms unchanged. */
export function warehoused(rooms: readonly RoomSpec[]): RoomSpec[] {
  const cargo = rooms.filter((r) => r.role === 'cargo' && !r.pinned);
  if (cargo.length < 2) return [...rooms];
  const mods = cargo.flatMap((r) => r.mods);
  const k = Math.max(1, Math.ceil(mods.length / WAREHOUSE));
  const area = cargo.reduce((t, r) => t + r.w * r.h, 0) / k;
  const out: RoomSpec[] = rooms.filter((r) => !cargo.includes(r));
  for (let i = 0; i < k; i++) {
    const mine = mods.filter((_, j) => j % k === i);
    const items = cargo.flatMap((r) => r.items ?? []).filter((_, j) => j % k === i);
    // Wide and shallow (about 8:5), at least five deep for two aisles of racks.
    const h = Math.max(5, Math.round(Math.sqrt(area / 1.6)));
    const w = Math.max(h, Math.ceil(area / h));
    out.push({ role: 'cargo', mods: mine, w, h, stock: true, warehouse: true, ...(items.length > 0 ? { items } : {}) });
  }
  return out;
}

const area = (r: RoomSpec): number => r.w * r.h + 4;

/** A room's department on a round station. */
export type Dept = 'harbour' | 'habitation' | 'commons' | 'freight' | 'secure' | 'defence' | 'works';

export function deptOf(r: RoomSpec): Dept {
  if (r.warehouse || r.role === 'cargo') return 'freight';
  switch (r.role) {
    case 'bridge': case 'armoury': case 'dock': return 'harbour';
    case 'quarters': case 'support': return 'habitation';
    case 'reactor': case 'shields': case 'core': return 'secure';
    case 'weapons': return 'defence';
    case 'industry': case 'farm': case 'hangar': return 'works';
    default: return 'commons';
  }
}

/** Rooms tagged with their department (role swaps keep to it: roleSwap.ts). */
export const tagged = (rooms: readonly RoomSpec[]): RoomSpec[] => rooms.map((r) => ({ ...r, dept: deptOf(r) }));

/**
 * Where departments go on a round station with dock banks north and south, as quadrants (0 north-east, 1 south-east,
 * 2 south-west, 3 north-west; each touches one dock face and one of the east and west spokes):
 *   secure   the side of the east or west spoke its rooms stand either side of (west only with no west dock bank);
 *   freight  the dock spokes its warehouses stand beside;
 *   quiet    the quadrants habitation takes in the outer band.
 */
export interface RingPlan { secure: 'e' | 'w'; freight: ('n' | 's')[]; quiet: number[]; market: boolean }

/** Quadrants beside a spoke: north 0 and 3, south 1 and 2, east 0 and 1, west 2 and 3. */
const SIDE: Record<'n' | 's' | 'e' | 'w', number[]> = { n: [0, 3], s: [1, 2], e: [0, 1], w: [2, 3] };

/**
 * A small search over the department placements (docs/STATIONFLOWS.md, step 2). Hard: the secure core never beside a
 * dock bank's spoke, warehouses beside a dock spoke. Preferred: the secure core on the stern (east), freight at the main
 * (north) dock, habitation away from the secure core and the warehouses. A little noise, so stations of a kind differ.
 */
export function planRing(rng: Rng, rooms: readonly RoomSpec[], westDocks: boolean, market = false): RingPlan {
  const houses = rooms.filter((r) => r.warehouse).length;
  const secures: ('e' | 'w')[] = westDocks ? ['e'] : ['e', 'w'];
  // A market takes the south concourse: freight stays at the north (trade) dock, with the office and the customs post.
  const freights: ('n' | 's')[][] = houses === 0 ? [[]] : market ? [['n']] : houses === 1 ? [['n'], ['s']] : [['n', 's']];
  const pairs = [[0, 1], [1, 2], [2, 3], [3, 0]];
  let best: RingPlan | null = null, top = -Infinity;
  for (const secure of secures) for (const freight of freights) for (const quiet of pairs) {
    const near = (q: number, sides: readonly ('n' | 's' | 'e' | 'w')[]): number => sides.filter((s) => SIDE[s].includes(q)).length;
    let v = (secure === 'e' ? 1 : 0) + (freight.includes('n') ? 0.5 : 0);
    // Habitation away from the secure core, the warehouses and the main (north) dock, where the harbour stands.
    for (const q of quiet) v -= near(q, [secure]) + 0.5 * near(q, freight) + 0.5 * near(q, ['n']);
    v += rng.next() * 0.8;
    if (v > top) { top = v; best = { secure, freight, quiet, market }; }
  }
  return best as RingPlan;
}

/** The quadrant of an angle (0 north-east ... 3 north-west; north is -pi/2, angles grow clockwise on screen). */
export const quadrantOf = (a: number): number => Math.floor(((((a + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2));

/**
 * Band rooms dealt to the four quadrant arcs by department: habitation to the quiet quadrants, the rest (harbour first)
 * to the others, each quadrant filled to about its share of the band's floor before the next best takes over. Inside a
 * quadrant, rooms that want the docks stand at its dock end (with doors towards it), the quiet ones at its spoke end.
 */
export function quadrantRooms(rooms: readonly RoomSpec[], plan: RingPlan, lengths: readonly number[], starts: readonly number[]): RoomSpec[][] {
  const total = lengths.reduce((t, l) => t + l, 0) || 1;
  const sum = rooms.reduce((t, r) => t + area(r), 0);
  const cap = lengths.map((l) => (l / total) * sum * 1.1);
  const load = lengths.map(() => 0);
  const groups: RoomSpec[][] = lengths.map(() => []);
  const quadOf = starts.map(quadrantOf);
  const rank = (r: RoomSpec): number[] => {
    const quiet = deptOf(r) === 'habitation';
    // Harbour rooms take the main (north) bank's quadrants whatever else is there.
    const score = (i: number): number => (quiet === plan.quiet.includes(quadOf[i] as number) ? 2 : 0)
      + (deptOf(r) === 'harbour' && SIDE.n.includes(quadOf[i] as number) ? 3 : 0);
    return lengths.map((_, i) => i).sort((a, b) => score(b) - score(a) || a - b);
  };
  let office = -1;
  for (const r of byPull(rooms)) {
    const order = rank(r);
    // Pinned harbour rooms (the office, the customs post) stand together, in the office's quadrant.
    const pinnedHarbour = r.pinned && deptOf(r) === 'harbour';
    // The office opens the north-east quadrant: the run of band rooms starts there, at the main bank.
    const ne = quadOf.indexOf(0);
    const i = pinnedHarbour ? (office >= 0 ? office : ne >= 0 ? ne : (order[0] as number))
      : order.find((k) => (load[k] as number) + area(r) <= (cap[k] as number)) ?? (order[0] as number);
    if (pinnedHarbour && office < 0) office = i;
    (groups[i] as RoomSpec[]).push(r);
    load[i] = (load[i] as number) + area(r);
  }
  return groups.map((g, i) => {
    // Quadrants 0 and 2 start at their dock face, 1 and 3 end at it.
    const dockFirst = (quadOf[i] as number) % 2 === 0;
    const busy = byPull(g.filter((r) => pullOf(r) > 0)).map((r) => ({ ...r, doorLean: (dockFirst ? -1 : 1) as -1 | 1 }));
    const sorted = [...busy, ...interleave(g.filter((r) => pullOf(r) <= 0))];
    return dockFirst ? sorted : sorted.reverse();
  });
}

/** Quiet rooms with the messes and other rooms spaced evenly among the quarters, so no cabin is far from one. */
function interleave(quiet: readonly RoomSpec[]): RoomSpec[] {
  const q = quiet.filter((r) => r.role === 'quarters'), o = quiet.filter((r) => r.role !== 'quarters');
  if (o.length === 0 || q.length === 0) return [...o, ...q];
  const out: RoomSpec[] = [];
  const step = q.length / (o.length + 1);
  let k = 0;
  q.forEach((r, i) => {
    out.push(r);
    while (k < o.length && i + 1 >= step * (k + 1)) out.push(o[k++] as RoomSpec);
  });
  return [...out, ...o.slice(k)];
}
