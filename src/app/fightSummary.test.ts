import { describe, expect, it } from 'vitest';
import { emptyTally, fightSummary } from './fightSummary';

describe('fightSummary', () => {
  it('is null for a fight that cost nothing', () => expect(fightSummary(emptyTally())).toBeNull());
  it('sums losses and kills in one line', () => {
    const s = fightSummary({ ...emptyTally(), modulesLost: 4, crewDown: 2, enemyModules: 1 });
    expect(s?.text).toBe('Fight cost: 4 modules lost, 2 crew down, 1 enemy module destroyed');
    expect(s?.tone).toBe('bad');
  });
});
