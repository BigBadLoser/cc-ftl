import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { content } from '../content';
import { buildTrade } from './tradeSnapshot';

describe('station info in the trade snapshot', () => {
  it('gives a station its defences, and a port-less station no owner', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    for (let i = 0; i < 5; i++) sim.step();
    sim.events.drain();
    const st = buildTrade(sim).partners.find((p) => p.station);
    if (!st) throw new Error('no station spawned');
    expect(st.info).toBeDefined();
    expect(st.info?.owner).toBeNull();
    expect(st.info?.alarm).toBeNull();
    expect(st.info?.docks).toBeGreaterThan(0);
    expect(buildTrade(sim).partners.filter((p) => !p.station).every((p) => p.info === undefined)).toBe(true);
  });
});
