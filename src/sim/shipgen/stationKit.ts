import type { Block, Side } from './arranger';
import { shuffle } from './civilKit';
import { no, type Ctx } from './navyKit';
import type { Rng } from '../rng';
import { allRooms, dockSpec, MK1_REACTOR, type Reactor, type RoomSpec, type ShipPlan } from './plan';
import type { RoomRole } from './types';
import { ADJACENCY, DISTRICT } from './stationQuality';

/** Shared helpers of the station grammars (`stationGrammars.ts`, `stationLayouts.ts`). */

/** Every room except the control room (which the ring hub or the first lattice module takes). */
export const roomsOf = (c: Ctx): RoomSpec[] => allRooms(c.plan).filter((r) => r !== c.plan.command);
/** Reactor rooms for a lattice (rings put them on their east run). */
export function reactorRooms(k0: number, r: Reactor = MK1_REACTOR): RoomSpec[] {
  const out: RoomSpec[] = [];
  for (let k = k0; k > 0; k -= 2) {
    const m = Math.min(2, k);
    // A tile of floor round the reactors, more than a walkway, so the room reads as a plant room (more on roomy stations).
    const g = r.margin ?? 3;
    out.push({ role: 'reactor', mods: Array<string>(m).fill(r.mod), w: r.fp[0] * m + g, h: r.fp[1] + g });
  }
  return out;
}

/** The plan's reactor (Mk I unless the station plan chose a tier). */
export const reactorOf = (p: ShipPlan): Reactor => p.reactor ?? MK1_REACTOR;

/** Split rooms into `k` groups of similar floor area (largest first, each to the smallest group). */
export function split(rooms: RoomSpec[], k: number): RoomSpec[][] {
  const out: RoomSpec[][] = Array.from({ length: k }, () => []);
  const area = (g: RoomSpec[]): number => g.reduce((t, r) => t + r.w * r.h, 0);
  for (const r of [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)) {
    const g = out.reduce((best, x) => (area(x) < area(best) ? x : best), out[0] as RoomSpec[]);
    g.push(r);
  }
  return out;
}

/** Districts (docs/LAYOUT_RESEARCH.md, "zones before rooms"): the table the layout quality is measured by. */
export { DISTRICT };

/** How much two roles want to sit side by side: the adjacency table (near +1, apart -1), +0.5 for one district. */
function affinity(a: RoomRole, b: RoomRole): number {
  let v = DISTRICT[a] !== undefined && DISTRICT[a] === DISTRICT[b] ? 0.5 : 0;
  for (const [x, y, w] of ADJACENCY) if ((x === a && y === b) || (x === b && y === a)) v += w;
  return v;
}

/**
 * Rooms in a good order for builders that lay them out in list order (ring bands, rim rooms, spines, lattices): rooms
 * next in the list end up next to each other, so the order is searched for the one whose neighbours (and next but one,
 * at half weight) score best by `affinity`: districts together, quarters by the mess and away from reactors, docks by
 * cargo, reactors by shields (Merrell et al. 2010 and Lopes et al. 2010 place rooms by such an adjacency table). The
 * search starts from a shuffle and keeps any swap or reversed run that does not lower the score (ties drift, so two
 * seeds rarely settle on the same order).
 */
export function zoned(rng: Rng, rooms: RoomSpec[]): RoomSpec[] {
  const seq = shuffle(rng, rooms);
  const n = seq.length;
  if (n < 3) return seq;
  const score = (s: readonly RoomSpec[]): number => {
    let v = 0;
    for (let i = 0; i + 1 < n; i++) {
      v += affinity((s[i] as RoomSpec).role, (s[i + 1] as RoomSpec).role);
      if (i + 2 < n) v += 0.5 * affinity((s[i] as RoomSpec).role, (s[i + 2] as RoomSpec).role);
    }
    return v;
  };
  let best = score(seq);
  for (let t = 0; t < 40 * n; t++) {
    const i = rng.int(0, n - 1), j = rng.int(0, n - 1);
    if (i === j) continue;
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const swap = rng.chance(0.5);
    const undo = seq.slice(lo, hi + 1);
    if (swap) [seq[lo], seq[hi]] = [seq[hi] as RoomSpec, seq[lo] as RoomSpec];
    else seq.splice(lo, hi - lo + 1, ...undo.slice().reverse());
    const v = score(seq);
    if (v >= best) best = v;
    else seq.splice(lo, hi - lo + 1, ...undo);
  }
  return seq;
}

/** Cut rooms (in order) into `k` runs of similar floor area: districts stay together (satellites by district). */
export function runs(rooms: RoomSpec[], k: number): RoomSpec[][] {
  const out: RoomSpec[][] = Array.from({ length: k }, () => []);
  const total = rooms.reduce((t, r) => t + r.w * r.h, 0);
  let acc = 0;
  for (const r of rooms) {
    const g = Math.min(k - 1, Math.floor((acc + (r.w * r.h) / 2) / (total / k)));
    (out[g] as RoomSpec[]).push(r);
    acc += r.w * r.h;
  }
  return out;
}

/** Rooms for builders that bring no docks of their own: the plan's rooms, its reactors and the two standard docks. */
export const fullRooms = (c: Ctx): RoomSpec[] => zoned(c.rng, [...roomsOf(c), ...reactorRooms(c.plan.reactors, reactorOf(c.plan)), dockSpec(), dockSpec()]);

export const placeRoot = (c: Ctx, b: Block | null, why: string): boolean => {
  if (!b) return no(c, why);
  c.A.placeRoot(b);
  return true;
};

export const cardinal = (c: Ctx, min: number): Side[] => shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, c.rng.int(min, 4));

