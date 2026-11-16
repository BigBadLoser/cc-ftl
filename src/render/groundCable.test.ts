import { describe, expect, it } from 'vitest';
import { CABLE_FITTINGS, cableTileId, type CableSide } from './groundCable';

/** A map: `=` cable, `#` a module or wall, anything else nothing. */
const map = (rows: string[]) => (x: number, y: number) => (dx: number, dy: number): CableSide => {
  const c = rows[y + dy]?.[x + dx] ?? '.';
  return c === '=' ? 'cable' : c === '#' ? 'wall' : null;
};

describe('groundCable', () => {
  it('picks the mask from the four sides (N1 E2 S4 W8)', () => {
    const m = map(['.=.', '===', '.=.']);
    expect(cableTileId(m(1, 1), 1, 1, true)).toBe('cable.duct.m15');
    expect(cableTileId(m(1, 0), 1, 0, true)).toBe('cable.duct.m4');
    expect(cableTileId(m(2, 1), 2, 1, true)).toBe('cable.duct.m8');
    expect(cableTileId(map(['.=', '=='])(1, 1), 1, 1, true)).toBe('cable.duct.m9');
    expect(cableTileId(map(['...', '.=.', '...'])(1, 1), 1, 1, true)).toBe('cable.duct.m0');
  });

  it('plugs into a wall: the side counts in the mask and in the walls', () => {
    expect(cableTileId(map(['#==='])(1, 0), 1, 0, true)).toBe('cable.duct.m10.w8');
    expect(cableTileId(map(['.#.', '.=.', '.#.'])(1, 1), 1, 1, false)).toBe('cable.duct.m5.w5.off');
  });

  it('marks an unpowered tile', () => {
    expect(cableTileId(map(['.=.', '===', '.=.'])(1, 1), 1, 1, false)).toBe('cable.duct.m15.off');
  });

  it('gives about one plain straight in four a fitting, by tile hash, and none elsewhere', () => {
    const row = '='.repeat(402);
    const m = map([row]);
    const ids = Array.from({ length: 400 }, (_, i) => cableTileId(m(i + 1, 0), i + 1, 0, true));
    expect(ids.map((_, i) => cableTileId(m(i + 1, 0), i + 1, 0, true))).toEqual(ids);
    const fitted = ids.filter((id) => /\.v\d$/.test(id));
    expect(fitted.length).toBeGreaterThan(60);
    expect(fitted.length).toBeLessThan(140);
    for (let v = 1; v <= CABLE_FITTINGS; v++) expect(fitted).toContain(`cable.duct.m10.v${v}`);
    expect(ids.every((id) => /^cable\.duct\.m10(\.v[1-4])?$/.test(id))).toBe(true);
    const plus = map(['.=.', '===', '.=.']);
    expect(cableTileId(plus(1, 1), 1, 1, true)).not.toMatch(/\.v\d/);
  });
});
