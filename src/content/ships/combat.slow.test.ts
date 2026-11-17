import { describe, expect, it } from 'vitest';
import { ProjectileC } from '../../sim/combat/components';
import { shipGrid, shipIds } from '../../sim/regions';
import type { SimEvent } from '../../sim/events';
import { deserialize, serialize } from '../../sim/save';
import { content } from '../index';
import { arsonSim, fightSim, gunShip, modulesOf, registry, withMissiles, withTargets, aim } from '../../../test/support/fixtures/combat';
import { eventsOf as ofType, run } from '../../../test/support/sim';
import { expectReplayable } from '../../../test/support/world';
import { newGame } from '../../sim/newGame';

// Slow tier: the long runs of combat.test.ts, whose fast file keeps the same claims over a shorter stretch.
describe('long fights', () => {
  it('incendiary: the crew put every fire out two minutes after the arsonist stops', () => {
    const sim = arsonSim();
    run(sim, 20 * 60);
    // Stop the arsonist and let the crew finish.
    sim.enqueue({ type: 'module.setEnabled', id: modulesOf(sim, 2, 'module.incendiaryLauncher')[0] as number, enabled: false });
    run(sim, 20 * 120); // two minutes: the crew levelling mid-fight shifts when the last fire goes out (90 s on seed 1)
    expect(shipGrid(sim, shipIds(sim)[0] as number)!.load('fire').some((f) => f > 0)).toBe(false);
  });

  it('point defence intercepts some missiles, not all, over two minutes', () => {
    const reg = registry({ 'ship.gun': gunShip('module.missileLauncher', ['role.gunner'], [withMissiles], 'hostile') });
    const sim = newGame(1, reg);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.gun', x: 100, y: 50 });
    aim(sim, 2, 1, modulesOf(sim, 1, 'module.fabricator')[0] as number);
    const events = run(sim, 20 * 120);
    const fired = ofType(events, 'weapon.fired').length;
    expect(fired).toBeGreaterThanOrEqual(10);
    const intercepted = ofType(events, 'projectile.intercepted').length;
    expect(intercepted).toBeGreaterThan(0);
    expect(intercepted).toBeLessThan(fired);
  });
});

describe('determinism, saves, performance', () => {
  it('same seed and commands give an identical save through 2400 ticks of combat', () => {
    const events: SimEvent[] = run(withTargets(fightSim(9)), 600);
    expect(ofType(events, 'weapon.fired').length).toBeGreaterThan(3);
    expectReplayable(() => withTargets(fightSim(9)), 2400, { every: 100 });
  });

  it('round-trips a save taken with projectiles in flight, and the reloaded fight runs on identically', () => {
    const sim = withTargets(fightSim(5));
    for (let i = 0; i < 4000 && sim.world.query(ProjectileC).length === 0; i++) sim.step();
    expect(sim.world.query(ProjectileC).length).toBeGreaterThan(0);
    const json = serialize(sim);
    const loaded = deserialize(json, content);
    expect(serialize(loaded)).toBe(json);
    run(sim, 600);
    run(loaded, 600);
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('runs 2000 ticks of a two-ship fight to the end of the run (speed itself is the profiler\'s job)', () => {
    const sim = withTargets(fightSim(2));
    const before = sim.tick;
    run(sim, 2000);
    expect(sim.tick - before).toBe(2000);
  });
});
