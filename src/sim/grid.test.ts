import { describe, expect, it } from 'vitest';
import { Grid } from './grid';

const spec = { flags: 'u8', room: 'u16', temp: 'f32' } as const;

describe('Grid', () => {
  it('sets and gets values per field type', () => {
    const g = new Grid(1, 20, 5, spec);
    g.set('flags', 3, 2, 200);
    g.set('room', 3, 2, 60000);
    g.set('temp', 3, 2, 21.5);
    expect(g.get('flags', 3, 2)).toBe(200);
    expect(g.get('room', 3, 2)).toBe(60000);
    expect(g.get('temp', 3, 2)).toBe(21.5);
    expect(g.get('flags', 0, 0)).toBe(0);
  });

  it('bounds-checks and rejects unknown fields', () => {
    const g = new Grid(1, 4, 4, spec);
    expect(() => g.get('flags', 4, 0)).toThrow(RangeError);
    expect(() => g.set('flags', -1, 0, 1)).toThrow(RangeError);
    expect(() => g.get('nope', 0, 0)).toThrow();
    expect(g.inBounds(3, 3)).toBe(true);
    expect(g.inBounds(4, 3)).toBe(false);
  });

  it('bumps field and chunk revisions', () => {
    const g = new Grid(1, 40, 20, spec);
    expect(g.revision('flags')).toBe(0);
    g.set('flags', 1, 1, 1);
    g.set('flags', 17, 1, 1);
    g.set('flags', 18, 1, 1);
    expect(g.revision('flags')).toBe(3);
    expect(g.revision('room')).toBe(0);
    expect(g.chunkRevision('flags', 0, 0)).toBe(1);
    expect(g.chunkRevision('flags', 1, 0)).toBe(2);
    expect(g.chunkRevision('flags', 0, 1)).toBe(0);
    expect(() => g.chunkRevision('flags', 3, 0)).toThrow(RangeError);
  });

  it('round-trips through base64 serialization', () => {
    const g = new Grid(7, 33, 17, spec);
    g.set('flags', 32, 16, 9);
    g.set('room', 5, 5, 1234);
    g.set('temp', 1, 1, -3.25);
    const data = JSON.parse(JSON.stringify(g.serialize()));
    const g2 = Grid.deserialize(data);
    expect(g2.id).toBe(7);
    expect(g2.width).toBe(33);
    expect(g2.get('flags', 32, 16)).toBe(9);
    expect(g2.get('room', 5, 5)).toBe(1234);
    expect(g2.get('temp', 1, 1)).toBe(-3.25);
    expect(g2.serialize()).toEqual(g.serialize());
  });
});
