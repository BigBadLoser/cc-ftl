import type { RoomSpec } from '../plan';
import { K, type Site } from './lattice';
import { SPACE } from './regions';

/**
 * Corner rooms of a square outline. Each cut corner is one room: the band's corner block, with the lattice steps of the
 * cut filled out to a straight diagonal. A one-tile stair only builds thick wall where another wall runs into it, and
 * here none does: the room's dividers are lattice lines that meet the hull on the flats either side, so the corner
 * carries a true diagonal hull.
 */

/** The four corners, clockwise from north-east, as the signs of x and y. */
const QUADS: readonly [1 | -1, 1 | -1][] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

/** The corners an outline has (indices into the four, clockwise from north-east): an arc lacks those cut away. */
export function cornersOf(s: Site): number[] {
  if (s.outline !== 'square') return [];
  const T = s.R - K * (s.cut + 1);
  return QUADS.flatMap(([sx, sy], k) => (s.hull(sx > 0 ? T : -T - 1, sy > 0 ? T : -T - 1) ? [k] : []));
}

/**
 * Build the corner rooms. `rooms` are given one each in order, clockwise from the north-east (a corner with none is a
 * garden gallery). Call before the band is filled. Returns the rooms placed.
 */
export function placeCorners(s: Site, rooms: readonly (RoomSpec | undefined)[]): RoomSpec[] {
  if (s.outline !== 'square') return [];
  const { g, R } = s;
  // The block starts one cell before the cut on either flat; the diagonal runs through the cut's outer corners.
  const T = R - K * (s.cut + 1), line = 2 * R - K * s.cut - 1;
  const placed: RoomSpec[] = [];
  for (const k of cornersOf(s)) {
    const [sx, sy] = QUADS[k] as [1 | -1, 1 | -1];
    const spec = rooms[k];
    const id = spec ? g.room(spec.role, { spec, access: [s.ring], rank: 1e5 + k }) : g.room('garden', { access: [s.ring], rank: 1e5 + k, dept: 'commons' });
    if (spec) placed.push(spec);
    // Its annex is the cell at one end of it, on the flat before the cut, and opens into it. The cell's last row is
    // where the ring steps in: that row is the corner room's, and its wall onto the annex.
    const nook = spec?.annex ? g.room(spec.annex.role, { spec: spec.annex, access: [id], rank: 2e5 + k }) : -1;
    for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
      const tx = (x + 0.5) * sx, ty = (y + 0.5) * sy;
      if (tx < T || ty < T || g.at(x, y) !== SPACE || s.inside(x, y)) continue;
      if (s.hull(x, y) || (!s.round && tx + ty <= line)) g.set(x, y, nook >= 0 && ty < T + K - 1 ? nook : id);
    }
  }
  return placed;
}
