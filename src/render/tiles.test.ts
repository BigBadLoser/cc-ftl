import { describe, expect, it } from 'vitest';
import { Struct } from '../sim/structure';
import { isLowered, wallChains } from './tiles';

const W = Struct.Wall;
const F = Struct.Floor;
const S = Struct.Space;
const grid = (rows: number[][]) => (x: number, y: number) => rows[y]?.[x] ?? S;

describe('tile chains', () => {
  const k = grid([
    [W, W, W],
    [W, F, W],
    [W, W, W],
  ]);
  it('hull corner draws both slabs', () => {
    expect(wallChains(k, 0, 0, W, false).map((c) => c[0])).toEqual(['tile.hull.x', 'tile.hull.y']);
  });
  it('hull edge draws one slab', () => {
    expect(wallChains(k, 1, 0, W, false)).toHaveLength(1);
  });
  it('lowers walls with interior behind them', () => {
    expect(isLowered(k, 1, 2, 'auto')).toBe(true);
    expect(isLowered(k, 1, 0, 'auto')).toBe(false);
  });
});
