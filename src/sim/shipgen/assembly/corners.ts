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

/**
 * How far the band runs on straight into a corner from where the corner starts (`T` tiles out along both axes): along
 * the face across the x axis (the band's lines across x hold the same tiles as the line before the corner) and along
 * the face across the y axis, in tiles. The curve begins where a line first differs.
 */
function straight(s: Site, sx: 1 | -1, sy: 1 | -1, T: number): [number, number] {
  const band = (x: number, y: number): boolean => s.hull(x, y) && !s.inside(x, y);
  // The band's tiles on the line `t` tiles out (t = T - 1 is the last line before the corner), across x or across y.
  const at = (sign: 1 | -1, t: number): number => (sign > 0 ? t : -t - 1);
  const line = (acrossX: boolean, t: number): string => {
    const out: number[] = [];
    for (let o = 0; o <= s.R; o++) if (acrossX ? band(at(sx, t), at(sy, o)) : band(at(sx, o), at(sy, t))) out.push(o);
    return out.join(',');
  };
  const run = (acrossX: boolean): number => {
    const ref = line(acrossX, T - 1);
    let n = 0;
    while (n < s.R - T && line(acrossX, T + n) === ref) n++;
    return n;
  };
  // Whole lattice strips only: a part strip would fold into the one before it and stand a room wider than a strip.
  const whole = (n: number): number => Math.max(0, Math.floor((T + n) / K) * K - T);
  // And only open ground with no room beside it: a strip stepped against a section's room would leave one of the two a
  // lip (the corner keeps it, as before).
  const { g } = s;
  const clear = (acrossX: boolean, n: number): boolean => {
    for (let t = T; t < T + n; t++) for (let o = 0; o <= s.R; o++) {
      const [x, y] = acrossX ? [at(sx, t), at(sy, o)] : [at(sx, o), at(sy, t)];
      if (!band(x, y)) continue;
      if (g.at(x, y) !== SPACE) return false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const id = g.at(x + dx, y + dy); if (id >= 0 && !g.regions[id]?.hall) return false; }
    }
    return true;
  };
  const [nx, ny] = [whole(run(true)), whole(run(false))];
  return [clear(true, nx) ? nx : 0, clear(false, ny) ? ny : 0];
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
    // A round corner is only its curve: where the band runs on straight past the corner's start, on either face, it
    // stays the band's, whole strips of it a plain rectangle (a room with an annex keeps its straight end for that).
    // Shoulders already leave a corner's ends to the band.
    const [Sx, Sy] = s.round && !s.shoulders && nook < 0 ? straight(s, sx, sy, T) : [0, 0];
    const ours = (x: number, y: number): boolean => {
      const tx = (x + 0.5) * sx, ty = (y + 0.5) * sy;
      return tx >= T + Sx && ty >= T + Sy && g.at(x, y) === SPACE && !s.inside(x, y) && (s.hull(x, y) || (!s.round && tx + ty <= line));
    };
    // The annex's end: the flat along x unless an arc's cut took it, then the flat along y.
    let alongX = true;
    if (nook >= 0) {
      let n = 0;
      for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) if (ours(x, y) && (y + 0.5) * sy < T + K - 1) n++;
      alongX = n >= K * K;
    }
    for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
      if (!ours(x, y)) continue;
      const end = alongX ? (y + 0.5) * sy < T + K - 1 : (x + 0.5) * sx < T + K - 1;
      g.set(x, y, nook >= 0 && end ? nook : id);
    }
  }
  return placed;
}
