import { describe, expect, it } from 'vitest';
import { CombatC, ModuleC, ShipC, WeaponC, newGame, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { resolveTarget } from '../../sim/combat/targets';

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const modulesOf = (sim: Sim, n: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === def);

function setup(): Sim {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  sim.step();
  sim.events.drain();
  return sim;
}
const aim = (sim: Sim, moduleId: number, weaponId: number | null = null): void =>
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId, targetShip: nth(sim, 2), targetModuleId: moduleId });
const weapon = (sim: Sim): number => modulesOf(sim, 1, sim.world.query(WeaponC).map((i) => sim.world.get(i, ModuleC)!.def)[0] as string)[0] as number;

describe('retargeting when the aimed module dies', () => {
  it('moves the ship-wide target to an intact module and persists it', () => {
    const sim = setup();
    const [reactor] = modulesOf(sim, 2, 'module.reactor') as [number];
    aim(sim, reactor);
    sim.step();
    const combat = sim.world.get(nth(sim, 1), CombatC)!;
    expect(combat.target?.moduleId).toBe(reactor);
    sim.world.get(reactor, ModuleC)!.hp = 0;
    const t = resolveTarget(sim, weapon(sim), combat);
    expect(t?.ship).toBe(nth(sim, 2));
    expect(t?.moduleId).not.toBe(reactor);
    expect(sim.world.get(t!.moduleId, ModuleC)!.hp).toBeGreaterThan(0);
    expect(combat.target).toEqual(t);
  });

  it('retargets a weapon-specific target too', () => {
    const sim = setup();
    const [reactor] = modulesOf(sim, 2, 'module.reactor') as [number];
    const w = weapon(sim);
    aim(sim, reactor, w);
    sim.step();
    sim.world.get(reactor, ModuleC)!.hp = 0;
    const t = resolveTarget(sim, w, sim.world.get(nth(sim, 1), CombatC)!);
    expect(t?.moduleId).not.toBe(reactor);
    expect(sim.world.get(w, WeaponC)!.target?.moduleId).toBe(t?.moduleId);
  });

  it('falls back to the hull when no module is left, and clears the target when the ship is destroyed or captured', () => {
    const sim = setup();
    const [reactor] = modulesOf(sim, 2, 'module.reactor') as [number];
    aim(sim, reactor);
    sim.step();
    const combat = sim.world.get(nth(sim, 1), CombatC)!;
    for (const i of sim.world.query(ModuleC)) if (shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, 2)) sim.world.get(i, ModuleC)!.hp = 0;
    expect(resolveTarget(sim, weapon(sim), combat)?.moduleId).toBe(0);
    sim.world.get(nth(sim, 2), ShipC)!.state = 'wreck';
    expect(resolveTarget(sim, weapon(sim), combat)).toBeNull();
    expect(combat.target).toBeNull();
    aim(sim, 0);
    sim.step();
    sim.world.get(nth(sim, 2), ShipC)!.state = 'prize';
    expect(resolveTarget(sim, weapon(sim), combat)).toBeNull();
    expect(combat.target).toBeNull();
  });

  it('emits module.destroyed once per module in a long fight against the aimed reactor', { timeout: 120000 }, () => {
    const sim = setup();
    sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 1), hold: false });
    aim(sim, modulesOf(sim, 2, 'module.reactor')[0] as number);
    const events: SimEvent[] = [];
    for (let i = 0; i < 3000; i++) {
      sim.step();
    }
    const ids = events.filter((e) => e.type === 'module.destroyed').map((e) => (e as Extract<SimEvent, { type: 'module.destroyed' }>).moduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
