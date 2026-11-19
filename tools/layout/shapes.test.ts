import { describe, expect, it } from 'vitest';
import { addModule, addRoom, newModule } from './layout';
import { extract } from './region';
import { parseShapes, pieceLayout, shapeName } from './shapes';
import { blankLayout } from './source';

const piece = () => {
  const { layout } = addRoom(blankLayout(30, 20), { x: 5, y: 5, w: 6, h: 4 }, 'cargo');
  return extract(addModule(layout, newModule('module.bed', 6, 6, 0), 0), { x: 4, y: 4, w: 8, h: 6 });
};

describe('saved shapes', () => {
  it('are named after their largest room', () => {
    expect(shapeName(piece())).not.toBe('shape');
    expect(shapeName({ ...piece(), roomOf: piece().roomOf.map(() => -1) })).toBe('shape');
  });
  it('round-trip through JSON and drop malformed entries', () => {
    const good = { id: 1, name: 'cargo bay', piece: piece() };
    expect(parseShapes(JSON.stringify([good, { id: 2, name: 'broken', piece: { w: 1 } }, null]))).toEqual([good]);
    expect(parseShapes('not json')).toEqual([]);
    expect(parseShapes(null)).toEqual([]);
  });
  it('draw from the piece stamped alone with a tile of space round it', () => {
    const l = pieceLayout(piece());
    expect([l.width, l.height]).toEqual([10, 8]);
    expect(l.cells[0]).toBe('..........');
    expect(l.cells[1]?.slice(1, 9)).toBe('########');
    expect(l.modules).toEqual([expect.objectContaining({ def: 'module.bed', x: 3, y: 3 })]);
  });
});

describe('naming a shape from a real design', () => {
  it('uses the name the grid shows (the Wayfarer pantry, a cargo room by role)', async () => {
    const { buildLayout, DEFAULT_SOURCE } = await import('./source');
    const l = buildLayout({ ...DEFAULT_SOURCE, kind: 'starter', id: 'starter.scout' }).layout;
    const { designFromLayout } = await import('./design');
    const pantry = designFromLayout(l, 'x').rooms.find((r) => r.name === 'pantry');
    expect(pantry).toBeDefined();
    const i = l.roomOf.findIndex((r) => r === pantry?.id);
    const x = i % l.width, y = Math.floor(i / l.width);
    expect(shapeName(extract(l, { x: x - 1, y: y - 1, w: 8, h: 7 }))).toBe('pantry');
  });
});
