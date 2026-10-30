import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from './ship';
import { Finish, Struct } from './structure';

describe('gridFromTemplate', () => {
  it('parses dims and chars, padding short rows', () => {
    const g = gridFromTemplate({ name: 't', rows: ['#D#', '_.', ''] });
    expect([g.width, g.height]).toEqual([3, 3]);
    expect(g.get('struct', 0, 0)).toBe(Struct.Wall);
    expect(g.get('struct', 1, 0)).toBe(Struct.Door);
    expect(g.get('struct', 0, 1)).toBe(Struct.Floor);
    expect(g.get('struct', 1, 1)).toBe(Struct.Space);
    expect(g.get('struct', 2, 2)).toBe(Struct.Space);
  });
  it('reads floor finishes onto floor tiles only', () => {
    const g = gridFromTemplate({ name: 't', rows: ['#__D', '_._'], floors: ['.wsm', 't.'] });
    expect([g.get('floor', 0, 0), g.get('floor', 1, 0), g.get('floor', 2, 0)]).toEqual([0, Finish.Walk, Finish.Soil]);
    expect(g.get('floor', 3, 0)).toBe(0); // a door keeps the plain deck
    expect([g.get('floor', 0, 1), g.get('floor', 2, 1)]).toEqual([Finish.Tread, 0]);
  });
  it('throws with row/col on unknown char', () => {
    expect(() => gridFromTemplate({ name: 't', rows: ['##', '#x'] })).toThrow(/row 1, col 1/);
  });
});
