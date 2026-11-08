import { describe, expect, it } from 'vitest';
import { SectorGrid } from './sectorGrid';
import { SHIP_EMPTY, SHIP_FIELDS, Struct } from './structure';

/** #155: a write that leaves the stored value as it was moves no revision, for every field type. */
describe('SectorGrid revisions count changes, not writes', () => {
  const cases: [string, number, number][] = [
    ['struct', Struct.Floor, Struct.Floor], // u8
    ['room', 7, 7], // u16
    ['module', 123456, 123456], // u32
    ['o2', 0.1, 0.1], // f32
    ['temp', 20.000000001, 20], // f32: both store as the same float
    ['fire', 255.4, 255], // u8 truncates
  ];
  for (const [field, first, again] of cases) {
    it(`${field}: a second write of the same stored value is a no-op`, () => {
      const s = new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY, { watch: { field: 'o2', below: 0.05 } });
      s.set('struct', 3, 3, Struct.Floor); // allocates the chunk
      s.set(field, 4, 4, first);
      const rev = s.revision(field), chunk = s.chunkRevision(field, 0, 0), stored = s.get(field, 4, 4), data = JSON.stringify(s.serialize());
      s.set(field, 4, 4, again);
      expect(s.get(field, 4, 4)).toBe(stored);
      expect(s.revision(field)).toBe(rev);
      expect(s.chunkRevision(field, 0, 0)).toBe(chunk);
      expect(JSON.stringify(s.serialize())).toBe(data);
      s.set(field, 4, 4, field === 'struct' ? Struct.Wall : stored + 1); // a real change still counts
      expect(s.revision(field)).toBe(rev + 1);
      expect(s.chunkRevision(field, 0, 0)).toBe(chunk + 1);
    });
  }

  it('keeps occupancy: rewriting the last solid tile does not release the chunk', () => {
    const s = new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY);
    s.set('struct', 1, 1, Struct.Wall);
    s.set('struct', 1, 1, Struct.Wall);
    expect(s.chunkCount).toBe(1);
    s.set('struct', 1, 1, Struct.Space);
    expect(s.chunkCount).toBe(0);
  });

  it('a -0 over a 0 still counts (different bytes in a save)', () => {
    const s = new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY);
    s.set('o2', 2, 2, 1);
    s.set('o2', 2, 2, 0);
    const rev = s.revision('o2');
    s.set('o2', 2, 2, -0);
    expect(s.revision('o2')).toBe(rev + 1);
  });
});
