/**
 * Experiments on a round band cut without 2x2 wall blocks.
 * coarseTest: many small rooms at equal angles on a plain circle and on coarse lattices of 2 and 3 tiles.
 * latticeTest: hull and ring on a k-tile lattice, the band cut along the lattice itself, one room a strip.
 */
import { Mock, polyR, type Part } from './mockKit';

export function coarseTest(k: number, rooms = 44, sides = 0): ReturnType<Mock['build']> {
  const m = new Mock(84, 84, 42, 42);
  const band = m.room('quarters');
  const ring = m.hall();
  const court = m.hall('garden');
  if (k <= 1) { m.arc(band, 30, 36, 0, 360, sides); m.arc(ring, 28, 30, 0, 360, sides); m.arc(court, 0, 28, 0, 360, sides); }
  else { m.coarse(band, 30, 36, k); m.coarse(ring, 30 - (k === 3 ? 3 : 2), 30, k); m.coarse(court, 0, 30 - (k === 3 ? 3 : 2), k); }
  m.around(band, 2, Array.from({ length: rooms }, () => ['quarters', 360 / rooms] as Part));
  return m.clean().build(`coarse ${k}`);
}

export function latticeTest(k: number, cells: number, deep = 2, sides = 0, stubs = false): ReturnType<Mock['build']> {
  const size = 2 * (cells + 2) * k;
  const m = new Mock(size, size, size / 2, size / 2);
  const { cx, cy, w } = m;
  const R = cells * k;
  // Cell coordinates of a tile (cell centre, in tiles from the station centre).
  const cell = (x: number, y: number): [number, number] => [(Math.floor((x - cx) / k) + 0.5) * k, (Math.floor((y - cy) / k) + 0.5) * k];
  // Distance from the centre: to a circle, or to a `sides`-gon with a flat face on each axis (a faceted outline).
  const dist = (dx: number, dy: number): number => polyR(Math.hypot(dx, dy), ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, sides);
  const inDisc = (x: number, y: number, r: number): boolean => { const [dx, dy] = cell(x, y); return dist(dx, dy) < r; };
  // Inboard of the band: a cell is inner when the cell `deep` cells further out along its octant's axis is still in
  // the hull disc, so every strip of the band is exactly `deep` cells deep and the ring steps where the hull steps.
  const inner = (x: number, y: number): boolean => {
    const [dx, dy] = cell(x, y);
    return Math.abs(dy) >= Math.abs(dx) ? dist(dx, dy + Math.sign(dy) * deep * k) < R : dist(dx + Math.sign(dx) * deep * k, dy) < R;
  };
  // At a step the divider between two strips must run straight from the hull's riser down to the ring. So the ring's
  // own riser sits one tile nearer the axis than the lattice line: `inside` is `inner` less that one-tile column, which
  // stays with the strip on its axis side and becomes the divider's lower end.
  const vertical = (x: number, y: number): boolean => { const [dx, dy] = cell(x, y); return Math.abs(dy) >= Math.abs(dx); };
  const inside = (x: number, y: number): boolean => inner(x, y)
    && (vertical(x, y) ? inner(x + Math.sign(x + 0.5 - cx), y) : inner(x, y + Math.sign(y + 0.5 - cy)));
  // The ring: the two outermost tiles of the inside.
  const core = (x: number, y: number): boolean => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!inside(x + dx, y + dy)) return false; return true; };
  const ring = m.hall();
  const court = m.hall('garden');
  m.paint(ring, (x, y) => inside(x, y) && !core(x, y));
  m.paint(court, (x, y) => core(x, y));
  // The band, one room a strip: vertical strips in the north and south octants, horizontal in the east and west.
  // Rooms are made from each axis outward, so a strip gives up the wall on its side away from the axis (lower ids give
  // way): every strip keeps the same width, and a hull step's riser runs straight on as the divider below it.
  const strips = new Map<string, { off: number; tiles: number[] }>();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < w; x++) {
    if (!inDisc(x, y, R) || inside(x, y)) continue;
    const [dx, dy] = cell(x, y);
    const vert = Math.abs(dy) >= Math.abs(dx);
    // The two strips either side of an axis are one double room (in a station the spoke or a big room goes there).
    const o = vert ? dx : dy, at = Math.abs(o) === k / 2 ? 0 : o;
    const key = vert ? `${Math.sign(dy)}v${at}` : `${Math.sign(dx)}h${at}`;
    if (!strips.has(key)) strips.set(key, { off: Math.abs(vert ? dx : dy), tiles: [] });
    strips.get(key)?.tiles.push(y * w + x);
  }
  for (const s of [...strips.values()].sort((p, q) => p.off - q.off)) {
    // A stub at the exact diagonal (a strip cut short by the other octant): left open, a notch in the hull, or kept.
    if (!stubs && s.tiles.length < deep * k * k) continue;
    const id = m.room('quarters');
    for (const t of s.tiles) m.own[t] = id;
  }
  return m.build(`lattice ${k}${sides ? ` ${sides}-gon` : ''}`);
}
