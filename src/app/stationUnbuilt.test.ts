import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame } from '../sim/newGame';
import { spawnStation } from '../sim/stations/spawn';

describe('spawnStation failure', () => {
  it('returns noLayout and emits the generator reasons', () => {
    const def = content.stations['station.trading'];
    const sim = newGame(1, { ...content, stations: { ...content.stations, 'station.trading': { ...def, assembly: [] } } });
    sim.events.drain();
    expect(spawnStation(sim, 'station.trading', 'outpost', 3)).toBe('noLayout');
    const ev = sim.events.drain().find((e) => e.type === 'station.unbuilt');
    expect(ev).toMatchObject({ type: 'station.unbuilt', kind: 'station.trading', size: 'outpost', seed: 3 });
    expect((ev as { reasons: string }).reasons).toContain('buildStation');
  });
});
