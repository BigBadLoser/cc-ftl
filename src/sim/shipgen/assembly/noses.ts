import type { RoomSpec } from '../plan';
import type { Site } from './lattice';
import { at, type Port } from './model';
import { SOLID, SPACE } from './regions';

/**
 * Round noses on an arc's arms: each arm ends in one room past its cut, a half disc as deep as the arm (band and
 * promenade), the promenade running into it. The cut face it stands on is its wall onto the arm. `rooms` are given
 * one a nose, in order; `free` says where a nose may stand (not on a harbour's berths). A nose that would build a
 * thick wall is not built. Returns the rooms placed.
 */
export function noses(s: Site, tips: readonly Port[], rooms: readonly RoomSpec[], free: (x: number, y: number) => boolean): RoomSpec[] {
  const { g } = s, placed: RoomSpec[] = [];
  // The arm's own tiles on the last kept line: its band and its promenade.
  const arm = (x: number, y: number): boolean => g.at(x, y) === s.ring || (s.hull(x, y) && s.depth(x, y) === 0);
  const box = [-s.R - 24, -s.R - 24, s.R + 24, s.R + 24] as const;
  for (const tip of tips) {
    const spec = rooms[placed.length];
    if (!spec) break;
    const f = tip.frame;
    let va = 0, vb = 0;
    while (arm(...at(f, -1, va - 1))) va--;
    while (arm(...at(f, -1, vb + 1))) vb++;
    // Its cross-section, hull to the promenade's inner side: the half disc's diameter.
    const vc = (va + vb) / 2, r = (vb - va + 1) / 2;
    const tiles: [number, number][] = [];
    for (let u = 0; u <= Math.ceil(r) + 1; u++) {
      for (let v = va - 1; v <= vb + 1; v++) if ((u + 0.5) ** 2 + (v - vc) ** 2 <= r * r) tiles.push(at(f, u, v));
    }
    if (tiles.some(([x, y]) => (g.at(x, y) !== SPACE && g.at(x, y) !== SOLID) || !free(x, y))) continue;
    const mark = g.mark(), before = g.blocks(...box);
    const id = g.room(spec.role, { spec, access: [s.ring] });
    for (const [x, y] of tiles) g.set(x, y, id);
    if (g.blocks(...box) > before) { g.reset(mark); continue; }
    placed.push(spec);
  }
  return placed;
}
