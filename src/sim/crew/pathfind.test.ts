import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from '../ship';
import { Sim } from '../sim';
import { findPath } from './pathfind';

function sim(rows: string[]): Sim {
  const s = new Sim(1);
  s.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
  return s;
}

describe('findPath', () => {
  it('walks straight and diagonally in open floor', () => {
    const s = sim(['_____', '_____', '_____']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 4, y: 0 })).toHaveLength(4);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(findPath(s, 1, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
  it('goes around obstacles', () => {
    const s = sim(['___', '##_', '___']);
    const p = findPath(s, 1, { x: 0, y: 0 }, { x: 0, y: 2 }) ?? [];
    expect(p.map((t) => `${t.x},${t.y}`)).toEqual(['1,0', '2,0', '2,1', '2,2', '1,2', '0,2']);
  });
  it('passes through doors', () => {
    const s = sim(['_#_', '_D_', '_#_']);
    const p = findPath(s, 1, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(p).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
  });
  it('returns null when unreachable or goal is solid', () => {
    const s = sim(['_#_', '_#_']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(findPath(s, 9, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeNull();
  });
  it('does not cut corners', () => {
    const s = sim(['_#', '#_']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    const t = sim(['__', '#_']);
    expect(findPath(t, 1, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 0 }, { x: 1, y: 1 }]);
  });
  it('adjacency goal stops next to a wall', () => {
    const s = sim(['____#', '____#']);
    const p = findPath(s, 1, { x: 0, y: 0 }, { x: 4, y: 0, adjacent: true }) ?? [];
    expect(p[p.length - 1]).toEqual({ x: 3, y: 0 });
    expect(findPath(s, 1, { x: 3, y: 1 }, { x: 4, y: 0, adjacent: true })).toEqual([]);
  });
  it('is deterministic', () => {
    const s = sim(['______', '______', '______']);
    const a = findPath(s, 1, { x: 0, y: 0 }, { x: 5, y: 2 });
    const b = findPath(s, 1, { x: 0, y: 0 }, { x: 5, y: 2 });
    expect(a).toEqual(b);
  });
});
