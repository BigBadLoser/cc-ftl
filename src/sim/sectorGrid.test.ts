import { describe, expect, it } from 'vitest';
import { SectorGrid } from './sectorGrid';
import { SHIP_EMPTY, SHIP_FIELDS, Struct } from './structure';
import { SPACE_TEMP } from './tuning';

const mk = () => new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY);

describe('SectorGrid get/set', () => {
  it('reads empty values from missing chunks', () => {
    const s = mk();
    expect(s.get('struct', 5, 5)).toBe(Struct.Space);
    expect(s.get('temp', -100, 900)).toBe(SPACE_TEMP);
    expect(s.chunkCount).toBe(0);
  });

  it('works across chunk borders and at negative coordinates', () => {
    const s = mk();
    const pts: [number, number][] = [[0, 0], [15, 15], [16, 16], [-1, -1], [-16, -17], [-17, 3], [31, -32], [1000, -1000]];
    pts.forEach(([x, y], i) => s.set('struct', x, y, Struct.Floor + (i % 3)));
    pts.forEach(([x, y], i) => expect(s.get('struct', x, y)).toBe(Struct.Floor + (i % 3)));
    expect(s.get('struct', -2, -1)).toBe(Struct.Space);
    s.set('o2', -1, 15, 21.5);
    expect(s.get('o2', -1, 15)).toBe(21.5);
    expect(s.get('o2', 0, 15)).toBe(0);
    expect(s.get('temp', -1, 15)).toBe(SPACE_TEMP); // allocated chunk is filled with empty values
  });

  it('rejects unknown fields and non-integer or out-of-range coordinates', () => {
    const s = mk();
    expect(() => s.get('nope', 0, 0)).toThrow();
    expect(() => s.set('struct', 0.5, 0, 1)).toThrow(RangeError);
    expect(() => s.get('struct', 1e9, 0)).toThrow(RangeError);
    expect(s.inBounds(-5000, 7000)).toBe(true);
    expect(s.inBounds(NaN, 0)).toBe(false);
  });

  it('stores f32 and u16 per field type', () => {
    const s = mk();
    s.set('room', 3, 3, 60000);
    s.set('temp', 3, 3, -3.25);
    s.set('module', 3, 3, 4_000_000_000);
    expect(s.get('room', 3, 3)).toBe(60000);
    expect(s.get('temp', 3, 3)).toBe(-3.25);
    expect(s.get('module', 3, 3)).toBe(4_000_000_000);
  });
});

describe('SectorGrid empty values and chunk lifetime', () => {
  it('set of the empty value on a missing chunk is a no-op', () => {
    const s = mk();
    s.set('struct', 40, 40, Struct.Space);
    s.set('temp', 40, 40, SPACE_TEMP);
    expect(s.chunkCount).toBe(0);
    expect(s.revision('struct')).toBe(0);
    expect(s.revision('temp')).toBe(0);
  });

  it('allocates on a non-empty set and releases when the last solid tile clears', () => {
    const s = mk();
    s.set('struct', 20, 20, Struct.Wall);
    s.set('struct', 21, 20, Struct.Floor);
    s.set('o2', 22, 20, 5);
    expect(s.chunks()).toEqual([{ cx: 1, cy: 1 }]);
    s.set('struct', 20, 20, Struct.Space);
    expect(s.chunkCount).toBe(1);
    s.set('struct', 21, 20, Struct.Space);
    expect(s.chunkCount).toBe(0);
    expect(s.get('o2', 22, 20)).toBe(0);
    expect(s.chunkData('struct', 1, 1)).toBeUndefined();
    s.set('struct', 20, 20, Struct.Wall); // reallocates fresh
    expect(s.get('o2', 22, 20)).toBe(0);
    expect(s.get('temp', 22, 20)).toBe(SPACE_TEMP);
  });

  it('counts overwrites of a solid tile once', () => {
    const s = mk();
    s.set('struct', 1, 1, Struct.Wall);
    s.set('struct', 1, 1, Struct.Floor);
    s.set('struct', 1, 1, Struct.Space);
    expect(s.chunkCount).toBe(0);
  });

  it('ship owner field defaults to 0', () => {
    const s = mk();
    s.set('struct', 2, 2, Struct.Floor);
    s.set('ship', 2, 2, 77);
    expect(s.get('ship', 2, 2)).toBe(77);
    expect(s.get('ship', 3, 2)).toBe(0);
  });
});

describe('SectorGrid revisions', () => {
  it('bumps field and chunk revisions, never on no-ops, never backwards on release', () => {
    const s = mk();
    s.set('struct', 1, 1, Struct.Wall);
    s.set('struct', 17, 1, Struct.Wall);
    s.set('struct', 18, 1, Struct.Wall);
    expect(s.revision('struct')).toBe(3);
    expect(s.revision('o2')).toBe(0);
    expect(s.chunkRevision('struct', 0, 0)).toBe(1);
    expect(s.chunkRevision('struct', 1, 0)).toBe(2);
    expect(s.chunkRevision('struct', 0, 1)).toBe(0);
    const before = s.chunkRevision('struct', 1, 0);
    s.set('struct', 17, 1, Struct.Space);
    s.set('struct', 18, 1, Struct.Space);
    expect(s.chunkRevision('struct', 1, 0)).toBeGreaterThan(before + 1);
    expect(s.chunkRevision('o2', 1, 0)).toBeGreaterThan(0);
  });
});

describe('SectorGrid load and chunks', () => {
  it('loads a rect spanning chunks with empties for missing ones', () => {
    const s = mk();
    s.set('struct', -1, -1, Struct.Wall);
    s.set('struct', 0, 0, Struct.Floor);
    s.set('struct', 16, 0, Struct.Door);
    s.set('temp', 15, 0, 20);
    const r = s.load('struct', { x: -2, y: -2, w: 20, h: 3 });
    expect(r).toBeInstanceOf(Float64Array);
    expect(r.length).toBe(60);
    expect(r[1 * 20 + 1]).toBe(Struct.Wall); // (-1,-1)
    expect(r[2 * 20 + 2]).toBe(Struct.Floor); // (0,0)
    expect(r[2 * 20 + 18]).toBe(Struct.Door); // (16,0)
    expect(r[0]).toBe(0);
    const t = s.load('temp', { x: 100, y: 100, w: 2, h: 2 });
    expect([...t]).toEqual([SPACE_TEMP, SPACE_TEMP, SPACE_TEMP, SPACE_TEMP]);
    expect(s.load('temp', { x: 15, y: 0, w: 1, h: 1 })[0]).toBe(20);
    expect(s.load('struct', { x: 0, y: 0, w: 0, h: 5 }).length).toBe(0);
  });

  it('iterates chunks in key order whatever the insertion order', () => {
    const pts: [number, number][] = [[200, 200], [-40, 5], [0, 0], [-40, -80], [64, -3], [-1, 0]];
    const a = mk();
    const b = mk();
    for (const [x, y] of pts) a.set('struct', x, y, Struct.Wall);
    for (const [x, y] of [...pts].reverse()) b.set('struct', x, y, Struct.Wall);
    expect(a.chunks()).toEqual(b.chunks());
    expect(a.chunks()[0]).toEqual({ cx: -3, cy: -5 });
    expect(JSON.stringify(a.serialize())).toBe(JSON.stringify(b.serialize()));
  });
});

describe('SectorGrid serialize', () => {
  it('round-trips byte-identically through JSON', () => {
    const s = mk();
    s.set('struct', -17, 40, Struct.Door);
    s.set('o2', -17, 40, 20.25);
    s.set('module', 300, -300, 123456);
    s.set('struct', 300, -300, Struct.Floor);
    s.set('temp', 5, 5, 21);
    const json = JSON.stringify(s.serialize());
    const s2 = SectorGrid.deserialize(1, JSON.parse(json));
    expect(JSON.stringify(s2.serialize())).toBe(json);
    expect(s2.get('o2', -17, 40)).toBe(20.25);
    expect(s2.get('module', 300, -300)).toBe(123456);
    expect(s2.chunks()).toEqual(s.chunks());
    s2.set('struct', -17, 40, Struct.Space); // solid counts rebuilt: chunk releases
    expect(s2.chunks().length).toBe(s.chunks().length - 1);
  });

  it('serializes an empty sector', () => {
    const s2 = SectorGrid.deserialize(1, JSON.parse(JSON.stringify(mk().serialize())));
    expect(s2.chunkCount).toBe(0);
  });
});

describe('SectorGrid performance sanity', () => {
  it('sets and gets a 200x200 area quickly', () => {
    const s = mk();
    for (let y = -100; y < 100; y++) for (let x = -100; x < 100; x++) s.set('struct', x, y, Struct.Floor);
    let n = 0;
    for (let y = -100; y < 100; y++) for (let x = -100; x < 100; x++) n += s.get('struct', x, y);
    expect(n).toBe(40000);
    expect(s.chunkCount).toBe(14 * 14);
  }, 2000); // loose wall-clock bound via the test timeout (Date/performance are banned in src/sim)
});

describe('SectorGrid releaseEmpty', () => {
  it('releases the chunks under a rectangle whose tiles are all empty, and keeps the others', () => {
    const g = new SectorGrid(0, SHIP_FIELDS, SHIP_EMPTY, { occupancyField: null });
    g.set('struct', 1, 1, Struct.Floor);
    g.set('struct', 40, 1, Struct.Floor);
    expect(g.chunkCount).toBe(2);
    const rev = g.revision('o2');
    g.set('struct', 1, 1, Struct.Space);
    expect(g.chunkCount).toBe(2);
    expect(g.releaseEmpty({ x: 0, y: 0, w: 48, h: 4 })).toBe(1);
    expect(g.chunks()).toEqual([{ cx: 2, cy: 0 }]);
    expect(g.revision('o2')).toBeGreaterThan(rev);
  });
});

describe('SectorGrid threshold watch', () => {
  it('counts writes that cross the watched threshold, either way, and keeps the count through a save', () => {
    const grid = new SectorGrid(0, { o2: 'f32', struct: 'u8' }, { o2: 0, struct: 0 }, { occupancyField: null, watch: { field: 'o2', below: 10 } });
    grid.set('o2', 1, 1, 21); // 0 -> 21: up across
    grid.set('o2', 1, 1, 15); // stays over
    grid.set('struct', 1, 1, 1); // another field
    expect(grid.crossings()).toBe(1);
    grid.set('o2', 1, 1, 5); // down across
    grid.set('o2', 40, -3, 0); // empty stays empty
    expect(grid.crossings()).toBe(2);
    const back = SectorGrid.deserialize(0, JSON.parse(JSON.stringify(grid.serialize())));
    expect(back.crossings()).toBe(2);
    back.set('o2', 1, 1, 12);
    expect(back.crossings()).toBe(3);
    expect(new SectorGrid(0, { o2: 'f32' }, { o2: 0 }).crossings()).toBe(0);
  });
});
