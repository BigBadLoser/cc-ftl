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

  it('lists every ship at war with the player, so the panel the combat alert opens has a target (a rogue ship too)', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.rogueShipyard', x: 100, y: 50 });
    sim.step();
    const rogue = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.faction === 'rogue');
    expect(rogue).toBeDefined();
    for (let i = 0; i < 3; i++) sim.step();
    const c = buildCombat(sim);
    // The sim calls it a fight (the alert and the auto-opened panel follow this flag) ...
    expect(c.inCombat).toBe(true);
    // ... and the panel lists the ship, so the player can aim at it.
    expect(c.enemies.map((e) => e.ship)).toContain(rogue);
  });
});
