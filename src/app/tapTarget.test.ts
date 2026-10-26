import { describe, expect, it } from 'vitest';
import { newGame, homeShip } from '../sim';
import { content } from '../content';
import { foreignShipTarget } from './tapTarget';
import { buildTrade } from './tradeSnapshot';

describe('foreignShipTarget', () => {
  it('selects a station but not the home ship', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
    for (let i = 0; i < 5; i++) sim.step();
    const st = buildTrade(sim).partners.find((p) => p.station);
    if (!st) throw new Error('no station');
    const home = homeShip(sim);
    expect(foreignShipTarget(sim, st.id, home)).toBe(st.id);
    expect(foreignShipTarget(sim, home, home)).toBeNull();
    expect(foreignShipTarget(sim, 999999, home)).toBeNull();
  });
});
