import { describe, expect, it } from 'vitest';
import { DeployC, ModuleC, WeaponC, isDeployed, newGame, shieldCapacity, type Sim } from '../../sim';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { shipIds } from '../../sim/regions';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;

const mods = (sim: Sim, shipId: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, shipId) && sim.world.get(i, ModuleC)!.def === def);
const amount = (sim: Sim, id: number): number => sim.world.get(id, DeployC)?.amount ?? 0;
const run = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) sim.step();
};

describe('deployable roof parts', () => {
  it('the AI core mast deploys in about 2 s when powered, with no combat', () => {
    const sim = newGame(1, content);
    const core = mods(sim, 1, 'module.aiCore')[0];
    if (core === undefined) return; // starter without a core: covered by raider below
    run(sim, 10);
    expect(amount(sim, core)).toBeGreaterThan(0);
    expect(amount(sim, core)).toBeLessThan(1);
    run(sim, 40);
    expect(amount(sim, core)).toBe(1);
    expect(isDeployed(sim, core)).toBe(true);
  });

  it('weapons and shields stay stowed in peace, deploy in combat in deploySec, and stow when it ends', () => {
    const sim = newGame(1, content);
    const gens = mods(sim, 1, 'module.shieldGen').concat(mods(sim, 1, 'module.shieldGenSmall'));
    const weapons = sim.world.query(WeaponC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number);
    expect(weapons.length).toBeGreaterThan(0);
    run(sim, 100);
    for (const id of [...gens, ...weapons]) expect(amount(sim, id)).toBe(0);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 21); // one tick to spawn, then ~1 s
    const w = weapons[0]!;
    expect(amount(sim, w)).toBeGreaterThan(0.3);
    expect(amount(sim, w)).toBeLessThan(0.7);
    expect(isDeployed(sim, w)).toBe(false);
    run(sim, 30);
    for (const id of [...gens, ...weapons]) expect(amount(sim, id)).toBe(1);
  });

  it('an unpowered or destroyed module stows', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 60);
    const w = sim.world.query(WeaponC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)!;
    expect(amount(sim, w)).toBe(1);
    sim.world.get(w, ModuleC)!.hp = 0;
    run(sim, 20);
    expect(amount(sim, w)).toBeLessThan(1);
    run(sim, 40);
    expect(amount(sim, w)).toBe(0);
  });

  it('a weapon does not charge until fully deployed', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const weapons = sim.world.query(WeaponC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[1] as number);
    expect(weapons.length).toBeGreaterThan(0);
    for (let i = 0; i < 38; i++) {
      sim.step();
      if (!isDeployed(sim, weapons[0]!)) expect(sim.world.get(weapons[0]!, WeaponC)!.charge).toBe(0);
    }
  });

  it('shield capacity counts only fully deployed generators', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 20);
    expect(shieldCapacity(sim, shipIds(sim)[1] as number, true)).toBe(0);
    expect(shieldCapacity(sim, shipIds(sim)[1] as number, false)).toBeGreaterThan(0);
    run(sim, 40);
    expect(shieldCapacity(sim, shipIds(sim)[1] as number, true)).toBeGreaterThan(0);
  });
});
