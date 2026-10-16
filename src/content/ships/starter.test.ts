import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim';
import { content } from '../index';

describe('starter ship', () => {
  it('parses to 22x14 and has at least 4 rooms', () => {
    const sim = newGame(1, content);
    sim.step();
    const g = sim.grids.get(1)!;
    expect([g.width, g.height]).toEqual([22, 14]);
    const rooms = new Set<number>();
    for (const r of g.raw('room')) if (r) rooms.add(r);
    expect(rooms.size).toBeGreaterThanOrEqual(4);
  });
});
