import type { RoomSpec } from '../plan';
import { K, type Site } from './lattice';
import { at, type Port } from './model';
import { SOLID, SPACE } from './regions';

/**
 * Round noses on an arc's arms: each arm ends in one room past its cut, as wide as the arm (band, promenade and its
 * inner wall) and rounded off in a half disc, the promenade running into it. The cut face it stands on is its wall onto
 * the arm. `rooms` are given one a nose, in order; `free` says where a nose may stand (not on a harbour's berths). A nose that would build a
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
    // And the promenade's inner wall: the nose's side is flush with the arm's.
    const wall = (v: number): boolean => { const [x, y] = at(f, -1, v); return g.at(x, y) === SOLID && s.depth(x, y) === 3; };
    if (wall(va - 1)) va--;
    if (wall(vb + 1)) vb++;
    const vc = (va + vb) / 2, half = (vb - va + 1) / 2;
    // The band's last tiles before the cut, where no room of its own stands, are the nose's too.
    const behind: [number, number][] = [];
    for (let u = -1; u >= -2 * K; u--) {
      const open: [number, number][] = [];
      for (let v = va; v <= vb; v++) { const [x, y] = at(f, u, v); if (g.at(x, y) === SPACE && s.hull(x, y)) open.push([x, y]); }
      if (open.length === 0) break;
      behind.push(...open);
    }
    // Past the cut: straight for a tile or more (the first is its wall onto the band), then a half disc as wide as the
    // arm. Whether a small arc builds a thick wall depends on its exact radius and where it starts, so a few are tried
    // and the first that builds none is kept.
    const shape = (straight: number, grow: number): [number, number][] => {
      const out: [number, number][] = [];
      const rr = (half + grow) ** 2;
      for (let u = 0; u <= straight + half + 2; u++) {
        for (let v = va; v <= vb; v++) if (u <= straight || (u - straight) ** 2 + (v + 0.5 - (vc + 0.5)) ** 2 <= rr) out.push(at(f, u, v));
      }
      return out;
    };
    let id = -1;
    for (const straight of [1, 2, 3]) {
      for (const grow of [0, -0.25, 0.25, -0.5, 0.5]) {
        const tiles = [...behind, ...shape(straight, grow)];
        if (tiles.some(([x, y]) => (g.at(x, y) !== SPACE && g.at(x, y) !== SOLID) || !free(x, y))) continue;
        const mark = g.mark(), before = g.blocks(...box);
        id = g.room(spec.role, { spec, access: [s.ring] });
        for (const [x, y] of tiles) g.set(x, y, id);
        if (g.blocks(...box) === before) break;
        g.reset(mark);
        id = -1;
      }
      if (id >= 0) break;
    }
    if (id < 0) continue;
    placed.push(spec);
  }
  return placed;
}
