import type { Block, Side } from './arranger';
import { shuffle } from './civilKit';
import { no, type Ctx } from './navyKit';
import { allRooms, dockSpec, type RoomSpec } from './plan';

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

/** Rooms for builders that bring no docks of their own: the plan's rooms, its reactors and the two standard docks. */
export const fullRooms = (c: Ctx): RoomSpec[] => shuffle(c.rng, [...roomsOf(c), ...reactorRooms(c.plan.reactors), dockSpec(), dockSpec()]);

export const placeRoot = (c: Ctx, b: Block | null, why: string): boolean => {
  if (!b) return no(c, why);
  c.A.placeRoot(b);
  return true;
};

export const cardinal = (c: Ctx, min: number): Side[] => shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, c.rng.int(min, 4));

