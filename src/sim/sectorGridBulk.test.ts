import { describe, expect, it } from 'vitest';
import { SectorGrid } from './sectorGrid';
import { SHIP_EMPTY, SHIP_FIELDS, Struct } from './structure';
import { Rng } from './rng';

/** Two identical grids with some chunks allocated (a ring of floor) and others missing, plus a watch on o2. */
function pair(): [SectorGrid, SectorGrid] {
  const mk = (): SectorGrid => new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY, { watch: { field: 'o2', below: 10 } });
  const a = mk(), b = mk();
  for (const g of [a, b]) {
    for (let x = -20; x < 30; x++) g.set('struct', x, -5, Struct.Floor);
    for (let y = -5; y < 30; y++) g.set('o2', -20, y, 12.5);
  }
  return [a, b];
}

const rect = { x: -21, y: -7, w: 53, h: 40 };

describe('SectorGrid bulk access', () => {
  it('loadChunkInto over every chunk matches the per-tile values', () => {
    const [g] = pair();
    const out = new Float64Array(rect.w * rect.h).fill(-1);
    for (let cy = -1; cy <= 2; cy++) for (let cx = -2; cx <= 1; cx++) g.loadChunkInto('temp', rect, out, cx, cy);
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) expect(out[y * rect.w + x]).toBe(g.get('temp', rect.x + x, rect.y + y));
  });

  it('writeDelta writes what a set per changed tile writes: values, revisions, watch count and allocation', () => {
    const [a, b] = pair();
    const rng = new Rng(7);
    for (const field of ['o2', 'temp', 'smoke']) {
      const before = a.load(field, rect);
      const vals = before.map((v) => (rng.next() < 0.5 ? v : v + (rng.next() - 0.3) * 20));
      const round = field === 'smoke';
      let n = 0;
      for (let i = 0; i < vals.length; i++) {
        const v = round ? Math.min(255, Math.max(0, Math.round(vals[i] as number))) : (vals[i] as number);
        if (Math.abs(v - (before[i] as number)) > 0.01) {
          b.set(field, rect.x + (i % rect.w), rect.y + Math.floor(i / rect.w), v);
          n++;
        }
      }
      const mirror = before.slice();
      expect(a.writeDelta(field, rect, vals, mirror, 0.01, round, true)).toBe(n);
      expect(a.load(field, rect)).toEqual(b.load(field, rect));
      expect(mirror).toEqual(a.load(field, rect));
      expect(a.revision(field)).toBe(b.revision(field));
      for (let cy = -1; cy <= 2; cy++) for (let cx = -2; cx <= 1; cx++) expect(a.chunkRevision(field, cx, cy)).toBe(b.chunkRevision(field, cx, cy));
    }
    expect(a.crossings()).toBe(b.crossings());
    expect(a.chunkCount).toBe(b.chunkCount);
    expect(a.serialize()).toEqual(b.serialize());
  });
});
