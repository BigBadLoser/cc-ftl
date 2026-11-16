import { describe, expect, it } from 'vitest';
import { E, EDGE_MARKINGS, markAt, MARK_FILL, MARK_FIELDS, MARK_INSET, N, S, setMark, W } from './marks';
import { SectorGrid } from './sectorGrid';
import { gridFromTemplate } from './ship';
import { newSectorGrid, stampGrid } from './stamp';
import { SHIP_EMPTY, SHIP_FIELDS } from './structure';

describe('deck marks', () => {
  it('keeps the bit values and insets the station generator uses', () => {
    expect([N, E, S, W]).toEqual([1, 2, 4, 8]);
    expect(EDGE_MARKINGS).toEqual(['walkway', 'apron', 'keepClear', 'hazard']);
    expect(MARK_INSET).toEqual({ walkway: 0.25, apron: 0.1, keepClear: 0.1, hazard: 0.1 });
    expect(MARK_FILL).toBeGreaterThan(W);
  });

  it('has one grid field per kind, empty by default', () => {
    for (const k of EDGE_MARKINGS) {
      expect(SHIP_FIELDS).toHaveProperty(MARK_FIELDS[k]);
      expect(SHIP_EMPTY[MARK_FIELDS[k]]).toBe(0);
    }
  });

  it('writes masks through the grid, keeping the fill flag for keep-clear only', () => {
    const g = gridFromTemplate({ name: 't', rows: ['___', '___'] });
    setMark(g, 'walkway', 1, 0, N | W | MARK_FILL);
    setMark(g, 'keepClear', 2, 1, E | MARK_FILL);
    expect(markAt(g, 'walkway', 1, 0)).toBe(N | W);
    expect(markAt(g, 'keepClear', 2, 1)).toBe(E | MARK_FILL);
    expect(markAt(g, 'hazard', 1, 0)).toBe(0);
    expect(markAt(g, 'walkway', -1, 0)).toBe(0);
  });

  it('survives stamping and a save round trip', () => {
    const g = gridFromTemplate({ name: 't', rows: ['___', '___'], floors: ['hck', ''] });
    setMark(g, 'hazard', 0, 0, N | W);
    setMark(g, 'keepClear', 2, 1, S | MARK_FILL);
    setMark(g, 'apron', 1, 1, E);
    const sector = newSectorGrid();
    stampGrid(sector, g, 40, 3);
    const json = JSON.stringify(sector.serialize());
    const back = SectorGrid.deserialize(0, JSON.parse(json));
    expect(markAt(back, 'hazard', 40, 3)).toBe(N | W);
    expect(markAt(back, 'keepClear', 42, 4)).toBe(S | MARK_FILL);
    expect(markAt(back, 'apron', 41, 4)).toBe(E);
    expect(markAt(back, 'walkway', 40, 3)).toBe(0);
    expect(back.get('floor', 42, 3)).toBe(3);
    expect(JSON.stringify(back.serialize())).toBe(json);
  });
});
