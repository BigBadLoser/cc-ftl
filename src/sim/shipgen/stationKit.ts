import type { Block, Side } from './arranger';
import { shuffle } from './civilKit';
import { no, type Ctx } from './navyKit';
import type { Rng } from '../rng';
import { allRooms, dockSpec, type RoomSpec } from './plan';
import type { RoomRole } from './types';

/** Shared helpers of the station grammars (`stationGrammars.ts`, `stationLayouts.ts`). */

/** Every room except the control room (which the ring hub or the first lattice module takes). */
export const roomsOf = (c: Ctx): RoomSpec[] => allRooms(c.plan).filter((r) => r !== c.plan.command);
/** Reactor rooms for a lattice (rings put them on their east run). */
export function reactorRooms(k0: number): RoomSpec[] {
  const out: RoomSpec[] = [];
  for (let k = k0; k > 0; k -= 2) out.push({ role: 'reactor', mods: Array<string>(Math.min(2, k)).fill('module.reactor'), w: 2 * Math.min(2, k) + 2, h: 4 });
  return out;
}

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

/**
 * Districts (docs/LAYOUT_RESEARCH.md, "zones before rooms"): habitation, logistics (stores, docks, hangars), the secure
 * core (command, AI core, armouries, shields) and industry (reactors, workshops, farms).
 */
export const DISTRICT: Partial<Record<RoomRole, number>> = {
  quarters: 0, support: 0, cargo: 1, dock: 1, hangar: 1, bridge: 2, core: 2, armoury: 2, shields: 2, reactor: 3, industry: 3, farm: 3,
};

/**
 * Rooms in district order: shuffled within each district, the districts in a random order, so builders that lay rooms
 * out in list order (ring bands, spines, lattices) put each district's rooms side by side. Gun bays and other roles with
 * no district keep their places in the shuffle, spread through.
 */
export function zoned(rng: Rng, rooms: RoomSpec[]): RoomSpec[] {
  const order = shuffle(rng, [0, 1, 2, 3]);
  const mixed = shuffle(rng, rooms);
  const rank = (r: RoomSpec): number | undefined => { const d = DISTRICT[r.role]; return d === undefined ? undefined : order.indexOf(d); };
  const placed = mixed.filter((r) => rank(r) !== undefined).sort((a, b) => (rank(a) as number) - (rank(b) as number));
  // Roles with no district go back into the sequence at their shuffled positions.
  let i = 0;
  return mixed.map((r) => (rank(r) === undefined ? r : (placed[i++] as RoomSpec)));
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
export const fullRooms = (c: Ctx): RoomSpec[] => zoned(c.rng, [...roomsOf(c), ...reactorRooms(c.plan.reactors), dockSpec(), dockSpec()]);

export const placeRoot = (c: Ctx, b: Block | null, why: string): boolean => {
  if (!b) return no(c, why);
  c.A.placeRoot(b);
  return true;
};

export const cardinal = (c: Ctx, min: number): Side[] => shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, c.rng.int(min, 4));

