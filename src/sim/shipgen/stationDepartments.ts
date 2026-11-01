import type { Rng } from '../rng';
import type { RoomSpec } from './plan';
import { arcsBetween } from './stationDocks';
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

/**
 * System rooms keep rectangles (gun bays, shield generators, the core, reactors, shuttle bays and refinery floors need
 * square floor: a refinery is 3 x 4 with ore bins flush against it; a farm's bays stand in rows): they stand off the
 * band, inboard of the ring or beyond it.
 */
const SYSTEM: readonly string[] = ['weapons', 'shields', 'core', 'reactor', 'hangar', 'industry', 'farm'];
export const isSystem = (r: RoomSpec): boolean => SYSTEM.includes(r.role) || !!r.warehouse;
export const isDock = (r: RoomSpec): boolean => r.role === 'dock';
/** The secure core: reactors, shield rooms, the AI core. */
export const isSecure = (r: RoomSpec): boolean => r.role === 'reactor' || r.role === 'shields' || r.role === 'core';

/**
 * A round ring's facility requirements (docs/STATIONGEN2.md, "Target stages"): what the outer ring must hold, sorted by
 * how it stands. Band rooms are ring segments; the rest are rectangles: the clinic lines a spoke, the secure core (in
 * two sides, see `secureSides`) and the gun bays line the secure spoke, warehouses stand beside the dock spokes, works
 * rooms in the busy quadrants.
 */
export interface RingProgram {
  band: RoomSpec[];
  clinic: RoomSpec[];
  secure: [RoomSpec[], RoomSpec[]];
  guns: RoomSpec[];
  houses: RoomSpec[];
  works: RoomSpec[];
}

/** The program of an outer ring from its band rooms and its system rooms (docks are reserved apart). */
export function ringProgram(bandIn: readonly RoomSpec[], sys: readonly RoomSpec[]): RingProgram {
  const inner = sys.filter((r) => r.role !== 'weapons');
  return {
    band: bandIn.filter((r) => !r.clinic),
    clinic: bandIn.filter((r) => r.clinic),
    secure: secureSides(inner.filter(isSecure)),
    guns: sys.filter((r) => r.role === 'weapons'),
    houses: inner.filter((r) => r.warehouse),
    works: inner.filter((r) => !isSecure(r) && !r.warehouse),
  };
}

/**
 * The secure core split either side of its spoke: reactor and shield pairs dealt to the shorter side, the AI core
 * whole on one side. In each pair the doors lean towards each other (a reactor and its shield room share a door end).
 */
function secureSides(rooms: RoomSpec[]): [RoomSpec[], RoomSpec[]] {
  const of = (role: string): RoomSpec[] => rooms.filter((r) => r.role === role);
  const reactors = of('reactor'), shields = of('shields');
  const sides: [RoomSpec[], RoomSpec[]] = [[], []];
  const len = (rs: RoomSpec[]): number => rs.reduce((t, r) => t + Math.max(r.w, r.h) + 2, 0);
  const add = (rs: RoomSpec[]): void => { (len(sides[0]) <= len(sides[1]) ? sides[0] : sides[1]).push(...rs); };
  add(of('core'));
  for (let i = 0; i < Math.max(reactors.length, shields.length); i++) {
    const r = reactors[i], q = shields[i];
    add(r && q ? [{ ...r, doorLean: 1 }, { ...q, doorLean: -1 }] : [r ?? q].filter((x): x is RoomSpec => !!x));
  }
  return sides;
}

/** A room's department on a round station. */
export type Dept = 'harbour' | 'habitation' | 'commons' | 'freight' | 'secure' | 'defence' | 'works';

export function deptOf(r: RoomSpec): Dept {
  if (r.warehouse || r.role === 'cargo') return 'freight';
  switch (r.role) {
    case 'bridge': case 'armoury': case 'dock': return 'harbour';
    case 'quarters': case 'support': case 'medbay': return 'habitation';
    case 'reactor': case 'shields': case 'core': case 'plant': return 'secure';
    case 'weapons': return 'defence';
    case 'industry': case 'farm': case 'hangar': return 'works';
    default: return 'commons';
  }
}

/** Rooms tagged with their department (role swaps keep to it: roleSwap.ts), with medbays and plant rooms added. */
export const tagged = (rooms: readonly RoomSpec[]): RoomSpec[] => withPlant(withMedbays(rooms)).map((r) => ({ ...r, dept: deptOf(r) }));

/**
 * Plant rooms: the engineering band on the secure core's side of the outer ring (one for every reactor room, two at
 * least), so the core's district has working rooms round it rather than cabins.
 */
function withPlant(rooms: readonly RoomSpec[]): RoomSpec[] {
  const reactors = rooms.filter((r) => r.role === 'reactor').length;
  if (reactors === 0) return [...rooms];
  return [...rooms, ...Array.from({ length: Math.max(2, reactors) }, (): RoomSpec => ({ role: 'plant', mods: ['module.lifeSupport'], w: 5, h: 4, pinned: true }))];
}

/**
 * Medbays: one for every five crew quarters rooms (at least one where there are quarters), two to four cots each; pinned,
 * so they keep their planned size in a cabin band with floor to spare.
 */
function withMedbays(rooms: readonly RoomSpec[]): RoomSpec[] {
  const quarters = rooms.filter((r) => r.role === 'quarters').length;
  if (quarters === 0 || rooms.some((r) => r.role === 'medbay')) return [...rooms];
  // A large station has a clinic instead: a ward and two treatment rooms that line a spoke together (stationRings.ts).
  if (quarters >= 8) {
    const room = (cots: number): RoomSpec => ({ role: 'medbay', mods: Array<string>(cots).fill('module.med_bed'), w: 2 * cots + 1, h: 4, pinned: true, clinic: true });
    return [...rooms, room(4), room(1), room(1)];
  }
  const n = Math.max(1, Math.round(quarters / 5));
  const cots = Math.min(4, 1 + Math.ceil(quarters / n / 2));
  return [...rooms, ...Array.from({ length: n }, (): RoomSpec => ({ role: 'medbay', mods: Array<string>(cots).fill('module.med_bed'), w: 2 * cots + 1, h: 4, pinned: true }))];
}

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
export function planRing(rng: Rng, houses: number, westDocks: boolean, market = false): RingPlan {
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
    // Harbour rooms take the main (north) bank's quadrants whatever else is there; plant rooms the secure core's side.
    const score = (i: number): number => (quiet === plan.quiet.includes(quadOf[i] as number) ? 2 : 0)
      + (deptOf(r) === 'harbour' && SIDE.n.includes(quadOf[i] as number) ? 3 : 0)
      + (r.role === 'plant' && SIDE[plan.secure].includes(quadOf[i] as number) ? 3 : 0);
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
  // A medbay opens the run (its busy end: the buffer between the cabins and the rest).
  const med = quiet.filter((r) => r.role === 'medbay');
  const q = quiet.filter((r) => r.role === 'quarters'), o = quiet.filter((r) => r.role !== 'quarters' && r.role !== 'medbay');
  if (o.length === 0 || q.length === 0) return [...med, ...o, ...q];
  const out: RoomSpec[] = [];
  const step = q.length / (o.length + 1);
  let k = 0;
  q.forEach((r, i) => {
    out.push(r);
    while (k < o.length && i + 1 >= step * (k + 1)) out.push(o[k++] as RoomSpec);
  });
  return [...med, ...out, ...o.slice(k)];
}

const TAU = Math.PI * 2;

/** Where the outer ring's departments go: the plan, the band's arcs, and the band rooms in run order round them. */
export interface RingPlacement { plan: RingPlan; arcs: [number, number][]; band: RoomSpec[] }

/**
 * Department placement for an outer ring whose dock banks split it at the angles `splits`: the plan (a small search),
 * then the band rooms dealt to the quadrant arcs (cut at the banks and the east and west spokes) by department. The
 * groups run on round the ring as one list, so every quadrant fills to its length (no quadrant left with two rooms
 * stretched over it) while each department keeps its place in the order; the run starts at the main (north) bank, so the
 * office and the customs post are always the first rooms after it.
 */
export function placeDepartments(rng: Rng, prog: RingProgram, splits: readonly number[], market: boolean): RingPlacement {
  const westDocks = splits.some((a) => Math.abs(Math.cos(a) + 1) < 0.01);
  const plan = planRing(rng, prog.houses.length, westDocks, market);
  const arcs = arcsBetween([...new Set([...splits, 0, Math.PI].map((a) => Math.round(((a % TAU) + TAU) % TAU * 1e6) / 1e6))]);
  const groups = quadrantRooms(prog.band, plan, arcs.map(([a, z]) => z - a), arcs.map(([a]) => a));
  const n0 = Math.max(0, arcs.findIndex(([a]) => quadrantOf(a + 1e-6) === 0));
  const turn = <T>(xs: T[]): T[] => [...xs.slice(n0), ...xs.slice(0, n0)];
  return { plan, arcs: turn(arcs), band: turn(groups).flat() };
}
