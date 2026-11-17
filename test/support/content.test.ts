import { describe, expect, it } from 'vitest';
import { serialize } from '../../src/sim/save';
import { cachedNewGame } from './content';
import { cachedWorld, expectReplayable } from './world';
import { run } from './run';

describe('cachedNewGame', () => {
  it('clones are independent and behave like the original', () => {
    const a = cachedNewGame(1);
    run(a, 20);
    const b = cachedNewGame(1);
    expect(b.tick).toBe(0);
    expect(a.tick).toBe(20);
    // A clone steps exactly as a second clone does.
    const c = cachedNewGame(1);
    run(b, 15);
    run(c, 15);
    expect(serialize(b)).toBe(serialize(c));
  });

  it('a new game replays and survives a save', () => {
    expectReplayable(() => cachedNewGame(2), 40, { every: 20, saveAt: 10 });
    expect(cachedWorld('content.test:unused', () => cachedNewGame(2)).tick).toBe(0);
  });
});
