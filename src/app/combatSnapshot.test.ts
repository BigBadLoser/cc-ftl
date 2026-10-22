import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ShipC, homeShip, newGame } from '../sim';
import { buildCombat } from './combatSnapshot';

describe('combat snapshot', () => {
  it('lists a dormant pirate den as dormant (the hostiles button stays dark) until it is provoked', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.pirate', size: 'outpost', seed: 4 });
    sim.step();
    const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    const den = (): { dormant?: boolean } | undefined => buildCombat(sim).enemies.find((e) => e.ship === station);
    expect(den()).toMatchObject({ dormant: true });
    expect(buildCombat(sim).enemies.some((e) => !e.dormant)).toBe(false);
    sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: station, targetModuleId: 0 });
    for (let i = 0; i < 3; i++) sim.step();
    expect(den()?.dormant).toBeUndefined();
  });
});
