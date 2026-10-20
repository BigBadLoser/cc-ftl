import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from './ship';
import { newSectorGrid, stampGrid } from './stamp';
import { Struct } from './structure';

const ROWS = ['#####', '#___#', '#_D_#', '#####'];

describe('stampGrid', () => {
  it('copies a dense grid into the sector at a position, in sector coordinates', () => {
    const sector = newSectorGrid();
    stampGrid(sector, gridFromTemplate({ name: 't', rows: ROWS }), 30, -7);
    expect(sector.get('struct', 32, -5)).toBe(Struct.Door);
    expect(sector.get('o2', 31, -6)).toBeGreaterThan(20);
    expect(sector.get('struct', 29, -7)).toBe(Struct.Space);
    sector.set('fire', 31, -6, 9);
    expect(sector.get('fire', 31, -6)).toBe(9);
  });
});
