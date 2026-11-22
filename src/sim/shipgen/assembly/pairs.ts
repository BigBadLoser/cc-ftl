import type { ModuleDef } from '../../registry';
import { cargoSpec, reactorSpec, weaponSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import { MIN_DEPTH } from './frame';
import { MESS } from './navyShip';
import { maxArea } from './roomSize';

/**
 * A navy plan's rooms as mirror pairs (SHIPGEN_V4, "Room layout"): laid out on the north side, the south side the same
 * shape, a pair per slot. Shared by the outline's layouts.
 */

export type Pair = readonly [RoomSpec, RoomSpec];

/** A room's floor with its annex. */
export const full = (r: RoomSpec): number => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0);
/**
 * A room's least length along the band: a reactor lies along a wall its full length, a room with an annex room for both
 * side by side (where it is too shallow for the annex behind), others at least their short side.
 */
export const minLen = (r: RoomSpec): number => (r.annex ? 2 * MIN_DEPTH + 1 : r.role === 'reactor' ? r.w : Math.min(r.w, r.h));
export const areaOf = ([r, s]: Pair): number => Math.max(full(r), full(s));
/** The most floor a pair takes: the smaller of its rooms' caps, its planned floor at least. */
export const capOf = ([r, s]: Pair): number => Math.max(areaOf([r, s]), Math.min(maxArea(r), maxArea(s)));
/** The floor opposite a room with no partner its size: as big, cut into fillers when painted. */
const fillOpposite = (a: RoomSpec): RoomSpec => ({ role: 'cargo', mods: [], w: a.w, h: a.h, fill: true });

/**
 * Rooms paired across the axis: the same role where there are two, then unlike rooms of a size together (the shape
 * mirrors, the use need not), and the one left over gets a mess opposite it (a store when there is one). An annex counts
 * in its host's size.
 */
export function mirrorPairs(specs: RoomSpec[]): Pair[] {
  const rest = [...specs], out: Pair[] = [];
  const push = (a: RoomSpec, b: RoomSpec): void => { const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h); out.push([{ ...a, w, h }, { ...b, w, h }]); };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as RoomSpec, j = rest.findIndex((r, k) => k > i && r.role === a.role && (!a.block || r.mods.length === a.mods.length));
    if (j > 0) { push(a, rest[j] as RoomSpec); rest.splice(j, 1); rest.splice(i, 1); i--; }
  }
  rest.sort((a, b) => full(b) - full(a));
  // Unlike rooms pair when near a size; a room much bigger than the next gets filler rooms opposite.
  while (rest.length > 1) {
    const a = rest.shift() as RoomSpec;
    push(a, full(rest[0] as RoomSpec) * 1.5 >= full(a) ? (rest.shift() as RoomSpec) : fillOpposite(a));
  }
  if (rest.length === 1) push(rest[0] as RoomSpec, specs.some((r) => r.role === 'support' && r.mods.includes('module.galley')) ? cargoSpec(2) : MESS);
  return out;
}

/**
 * The plan's guns paired (a lone room of several guns splits, a gun each side; an odd one out joins the other rooms),
 * and its reactors two a room past a pair (a room each for one or two), so no reactor room stands mostly bare.
 */
export function gunsAndReactors(plan: ShipPlan, defs: Record<string, ModuleDef>): { gunPairs: Pair[]; lone: RoomSpec[]; reactors: RoomSpec[] } {
  const guns = plan.weapons.flatMap((r) => (r.mods.length > 1 && plan.weapons.length % 2 === 1 && r === plan.weapons[plan.weapons.length - 1]
    ? [weaponSpec(defs, r.mods.slice(0, Math.ceil(r.mods.length / 2))), weaponSpec(defs, r.mods.slice(Math.ceil(r.mods.length / 2)))]
    : [r]));
  const lone = guns.length % 2 === 1 ? [guns.pop() as RoomSpec] : [];
  const reactors = plan.reactors <= 2 ? Array.from({ length: plan.reactors }, () => reactorSpec(1, plan.kit))
    : Array.from({ length: Math.ceil(plan.reactors / 2) }, (_, i) => reactorSpec(Math.min(2, plan.reactors - 2 * i), plan.kit));
  const [gn, gs] = pairUp(guns);
  return { gunPairs: gn.map((r, i) => [r, gs[i] as RoomSpec] as const), lone, reactors };
}

/** A plan's gun rooms cut to its first `pairs` gun pairs and the odd one out (`gunsAndReactors`): all of them where it has no more. */
export function batteryWeapons(plan: ShipPlan, defs: Record<string, ModuleDef>, pairs: number): RoomSpec[] {
  const { gunPairs, lone } = gunsAndReactors(plan, defs);
  return gunPairs.length <= pairs ? plan.weapons : [...gunPairs.slice(0, pairs).flatMap(([a, b]) => [a, b]), ...lone];
}

/**
 * A plan's rooms as the layouts place them: the gun pairs, the cabin block's pair (its beds split across the axis), and
 * the rest as mirror pairs, rooms with an annex paired together (both two tiers deep, or both with the annex beside).
 */
export function programPairs(plan: ShipPlan, defs: Record<string, ModuleDef>): { gunPairs: Pair[]; others: Pair[]; cabinPairs: Pair[] } {
  const { gunPairs, lone, reactors } = gunsAndReactors(plan, defs);
  const blockBeds = plan.quarters.filter((q) => q.block).reduce((n, q) => n + q.mods.length, 0);
  const restRooms = [...lone, ...reactors, ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters.filter((q) => !q.block), ...plan.support, ...plan.cargo, ...plan.hangars];
  const hosts = restRooms.filter((r) => r.annex), even = hosts.slice(0, hosts.length - (hosts.length % 2));
  const others = [...mirrorPairs(restRooms.filter((r) => !even.includes(r))), ...Array.from({ length: even.length / 2 }, (_, k): Pair => {
    const a = even[2 * k] as RoomSpec, b = even[2 * k + 1] as RoomSpec, w = Math.max(a.w, b.w), h = Math.max(a.h, b.h);
    return [{ ...a, w, h }, { ...b, w, h }];
  })];
  const cabinPairs: Pair[] = [];
  if (blockBeds > 0) {
    const north = 2 * Math.ceil(blockBeds / 4), south = blockBeds - north;
    const spec = (n: number): RoomSpec => ({ role: 'quarters', mods: Array<string>(n).fill('module.bed'), w: 0, h: 0, block: true, cabins: false });
    cabinPairs.push([spec(north), spec(south)]);
  }
  return { gunPairs, others, cabinPairs };
}
