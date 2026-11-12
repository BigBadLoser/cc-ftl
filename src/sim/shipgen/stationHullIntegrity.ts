import type { ShipTemplate } from '../registry';

/**
 * Pixel-grid hull invariants for the experimental wheel. Doors remain solid
 * boundaries for this test: an exterior airlock is an airtight hatch.
 *
 * The outside is the 4-connected '.' region containing the map margin.
 * Exposed hull cells must all belong to ONE 4-connected network of #/D cells.
 * This is deliberately stronger than a zero-2x2-wall-masses check, which
 * misses diagonal corner joints in a staircase-shaped perimeter.
 */
export function stationHullIntegrityProblems(t: Pick<ShipTemplate, 'rows'>): string[] {
  const rows = t.rows;
  const h = rows.length;
  const w = Math.max(0, ...rows.map((r) => r.length));
  if (w < 3 || h < 3) return ['graph-wheel hull has no usable raster'];
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const index = (x: number, y: number): number => y * w + x;
  const dirs: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const solid = (c: string): boolean => c === '#' || c === 'D';
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
    if (a === '#' && b === '#' && c === '#' && d === '#') {
      return [`graph-wheel wall thicker than one tile at ${x},${y}`];
    }
    const diagonal = (solid(a) && solid(d)) || (solid(b) && solid(c));
    if (diagonal && [a, b, c, d].includes('.') && [a, b, c, d].includes('_')) {
      return [`graph-wheel open diagonal hull corner at ${x},${y}`];
    }
  }

  // Exterior flood fill, using tiles that are actually vacuum/space. Rooms and
  // airlock doors are not floodable; room-like internal courts are not outside.
  const exterior = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
    const i = index(x, y);
    if (at(x, y) === '.' && !exterior[i]) { exterior[i] = 1; queue.push(i); }
  }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
    const i = index(x, y);
    if (at(x, y) === '.' && !exterior[i]) { exterior[i] = 1; queue.push(i); }
  }
  for (let i = 0; i < queue.length; i++) {
    const pos = queue[i] as number;
    const x = pos % w, y = Math.floor(pos / w);
    for (const [dx, dy] of dirs) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || at(xx, yy) !== '.') continue;
      const j = index(xx, yy);
      if (!exterior[j]) { exterior[j] = 1; queue.push(j); }
    }
  }

  const exposed = new Uint8Array(w * h);
  let first = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cell = at(x, y);
    const i = index(x, y);
    if (cell === '_') {
      for (const [dx, dy] of dirs) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && exterior[index(xx, yy)]) {
          return [`graph-wheel floor exposed directly to space at ${x},${y}`];
        }
      }
    }
    if (!solid(cell)) continue;
    for (const [dx, dy] of dirs) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && exterior[index(xx, yy)]) {
        exposed[i] = 1;
        if (first < 0) first = i;
        break;
      }
    }
  }
  if (first < 0) return ['graph-wheel has no exterior hull'];

  // Walk through ALL structural walls; inner partitions can connect portions of
  // the external shell, but no exterior-facing segment may be an isolated island.
  const seen = new Uint8Array(w * h);
  const wallQueue: number[] = [first];
  seen[first] = 1;
  for (let i = 0; i < wallQueue.length; i++) {
    const pos = wallQueue[i] as number;
    const x = pos % w, y = Math.floor(pos / w);
    for (const [dx, dy] of dirs) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid(at(xx, yy))) continue;
      const j = index(xx, yy);
      if (!seen[j]) { seen[j] = 1; wallQueue.push(j); }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = index(x, y);
    if (exposed[i] && !seen[i]) return [`graph-wheel exterior hull disconnected at ${x},${y}`];
  }
  return [];
}
