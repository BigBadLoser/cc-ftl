import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, newGame } from '../sim';
import { buildSocial } from './socialSnapshot';
import { stageBondHistory } from './bondStage';

describe('stageBondHistory', () => {
  it('seeds a dated timeline in both directions, oldest first, with a "both" line', () => {
    const sim = newGame(1, content);
    const [a, b] = sim.world.query(CrewC);
    stageBondHistory(sim, a!, b!);
    const row = [...buildSocial(sim, a!, () => undefined).friends, ...buildSocial(sim, a!, () => undefined).crew].find((r) => r.id === b)!;
    const h = row.history;
    expect(h.length).toBeGreaterThanOrEqual(4);
    expect(h.map((l) => l.agoSec)).toEqual([...h.map((l) => l.agoSec)].sort((x, y) => y - x));
    expect(h[0]).toMatchObject({ who: 'both', agoSec: 7200 });
    expect(h.some((l) => !l.good)).toBe(true);
  });
});
