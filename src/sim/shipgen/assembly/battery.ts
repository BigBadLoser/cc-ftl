import type { RoomSpec } from '../plan';
import { placeCorners } from './corners';
import type { Site } from './lattice';

/**
 * Gun batteries: each corner of the ring one gun bay as big as the curve, holding several guns, instead of many small
 * bays (the user: "expand the gun bays as far as they can go in the curve instead of multiple small ones"). A corner
 * takes guns while their bays' floor stays within SHARE of its own, biggest guns first, each to the corner with most
 * room left. Returns one merged room for each corner (undefined where none went) and the guns that went.
 */
const SHARE = 0.35;

export function batteries(s: Site, corners: readonly number[], guns: readonly RoomSpec[]): { specs: (RoomSpec | undefined)[]; used: RoomSpec[] } {
  const { g } = s;
  // Each corner's floor, from a trial build of the corners.
  const mark = g.mark(), n0 = g.regions.length;
  const dummies = [0, 1, 2, 3].map((): RoomSpec => ({ role: 'weapons', mods: [], w: 1, h: 1 }));
  placeCorners(s, dummies.map((d, k) => (corners.includes(k) ? d : undefined)));
  const area = [0, 0, 0, 0];
  for (let y = -s.R; y < s.R; y++) for (let x = -s.R; x < s.R; x++) {
    const id = g.at(x, y);
    if (id < n0) continue;
    const k = dummies.indexOf(g.regions[id]?.spec as RoomSpec);
    if (k >= 0) area[k] = (area[k] as number) + 1;
  }
  g.reset(mark);
  const left = area.map((a) => a * SHARE), given: RoomSpec[][] = [[], [], [], []], used: RoomSpec[] = [];
  for (const gun of [...guns].sort((p, q) => q.w * q.h - p.w * p.h)) {
    const k = corners.filter((c) => (left[c] as number) >= gun.w * gun.h).sort((p, q) => (left[q] as number) - (left[p] as number))[0];
    if (k === undefined) continue;
    left[k] = (left[k] as number) - gun.w * gun.h;
    (given[k] as RoomSpec[]).push(gun);
    used.push(gun);
  }
  const specs = given.map((list): RoomSpec | undefined => {
    const first = list[0];
    return first ? { ...first, dept: 'defence', mods: list.flatMap((r) => r.mods) } : undefined;
  });
  return { specs, used };
}
