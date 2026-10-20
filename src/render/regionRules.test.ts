import { describe, expect, it } from 'vitest';
import { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { crewHidden } from './regionRules';

describe('crew visibility (sector grid §5)', () => {
  const g = new Grid(1, 4, 1, { struct: 'u8', module: 'u32' });
  g.set('struct', 0, 0, Struct.Floor);
  g.set('struct', 1, 0, Struct.Door);
  g.set('struct', 2, 0, Struct.Wall);
  g.set('module', 2, 0, 7);
  // (3, 0) stays Space: the EVA ring outside the hull.

  it('hides crew on floor, door and module tiles of a roofed region only', () => {
    expect([0, 1, 2, 3].map((x) => crewHidden(g, true, x, 0))).toEqual([true, true, true, false]);
    expect([0, 1, 2, 3].map((x) => crewHidden(g, false, x, 0))).toEqual([false, false, false, false]);
  });

  it('always draws crew outside the region', () => {
    expect(crewHidden(g, true, 9, 0)).toBe(false);
  });
});
