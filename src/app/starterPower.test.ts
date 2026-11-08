import { describe, expect, it } from 'vitest';
import { newGame, TICK_HZ } from '../sim';
import { content } from '../content';
import { powerBalance, shortOnPower } from './alertsDerived';
import { homeShip } from '../sim/index';

describe('starter ships and power', () => {
  // An idle hydroponics bed (nothing planted) draws nothing and is unpowered by design: it is neither a shortage nor demand.
  it.each(['ship.wayfarer', 'ship.prospector', 'ship.lancer'])('%s begins with power at or above its draw and no shortage alert', (ship) => {
    const sim = newGame(3, content, ship);
    for (let i = 0; i < TICK_HZ * 5; i++) sim.step();
    const home = homeShip(sim);
    const { supply, demand } = powerBalance(sim, home);
    expect(supply).toBeGreaterThanOrEqual(demand);
    expect(shortOnPower(sim, home)).toBe(false);
  });
});
