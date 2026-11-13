import type { RoomSpec } from '../plan';
import { DEEP, K, type Site } from './lattice';
import { SPACE } from './regions';

/**
 * Corner rooms of a square outline. Each cut corner is one room: the band's corner block, with the lattice steps of the
 * cut filled out to a straight diagonal. A one-tile stair only builds thick wall where another wall runs into it, and
 * here none does: the room's dividers are lattice lines that meet the hull on the flats either side, so the corner
 * carries a true diagonal hull.
 */

/** The four corners, clockwise from north-east, as the signs of x and y. */
const QUADS: readonly [1 | -1, 1 | -1][] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

/**
 * How many cells in from the flat an arc corner's room starts, when its ends are left to the band: the band's lattice
 * lines go on into the corner as far as a room's side wall can meet both curves there, and the corner room is the
 * steep middle no wall can meet. Found by trial: the corner is laid out with a room on every lattice cell of its ends,
 * and the deepest that builds no thick wall and leaves the corner room a door onto the ring is kept.
 */
function shoulderCells(s: Site, [sx, sy]: readonly [number, number]): number {
  if (!s.round || !s.shoulders) return 0;
  const { g, R } = s, T0 = R - K * (s.cut + 1), box = [-R - 2, -R - 2, R + 2, R + 2] as const;
  const before = g.blocks(...box);
  for (let m = s.cut - DEEP; m > 0; m--) {
    const mark = g.mark(), T = T0 + K * m;
    const corner = g.room('garden', { access: [s.ring], rank: 1e5 });
    const ends = Array.from({ length: 2 * m }, (_, i) => g.room('garden', { rank: (i % m) + (i < m ? 0 : 0.5) }));
    for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
      const tx = (x + 0.5) * sx, ty = (y + 0.5) * sy;
      if (tx < T0 || ty < T0 || g.at(x, y) !== SPACE || s.inside(x, y) || !s.hull(x, y)) continue;
      g.set(x, y, tx >= T && ty >= T ? corner : (tx < T ? ends[Math.floor((tx - T0) / K)] : ends[m + Math.floor((ty - T0) / K)]) as number);
    }
    // The corner room must be a room: floor enough, and a door onto the ring.
    const cell = g.compile();
    let floor = 0;
    for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) if (g.at(x, y) === corner && cell[(y + g.half) * g.size + x + g.half] === '_') floor++;
    const ok = floor >= 24 && g.blocks(...box) === before && !g.stranded(cell).some(([, , id]) => id === corner);
    g.reset(mark);
    if (ok) return m;
  }
  return 0;
}

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
  const line = 2 * R - K * s.cut - 1;
  const placed: RoomSpec[] = [];
  for (const k of cornersOf(s)) {
    const [sx, sy] = QUADS[k] as [1 | -1, 1 | -1];
    const T = R - K * (s.cut + 1) + K * shoulderCells(s, [sx, sy]);
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
