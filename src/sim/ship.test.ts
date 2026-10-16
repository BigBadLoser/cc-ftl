import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from './ship';
import { Struct } from './structure';

describe('gridFromTemplate', () => {
  it('parses dims and chars, padding short rows', () => {
    const g = gridFromTemplate(1, { name: 't', rows: ['#D#', '_.', ''] });
    expect([g.width, g.height]).toEqual([3, 3]);
    expect(g.get('struct', 0, 0)).toBe(Struct.Wall);
    expect(g.get('struct', 1, 0)).toBe(Struct.Door);
    expect(g.get('struct', 0, 1)).toBe(Struct.Floor);
    expect(g.get('struct', 1, 1)).toBe(Struct.Space);
    expect(g.get('struct', 2, 2)).toBe(Struct.Space);
  });
  it('throws with row/col on unknown char', () => {
    expect(() => gridFromTemplate(1, { name: 't', rows: ['##', '#x'] })).toThrow(/row 1, col 1/);
  });
});
