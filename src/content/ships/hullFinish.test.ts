import { describe, expect, it } from 'vitest';
import { CombatC, ModuleC, ShipC, WeaponC, newGame, weaponsIdleReason, type ContentRegistry, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipGrid, shipIdOf, shipIds } from '../../sim/regions';
import { operatorOf } from '../../sim/combat/operators';
import { resolveTarget } from '../../sim/combat/targets';

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const modulesOf = (sim: Sim, shipId: number): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipId);
const aim = (sim: Sim, moduleId = 0): void =>
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId: null, targetShip: nth(sim, 2), targetModuleId: moduleId });

/** A raider with no crew (nobody repairs it) and no reactor: with every module shot out it has no power source to lose, only its hull. */
const hulk = { ...content.ships['ship.raider'], crew: [], modules: content.ships['ship.raider'].modules!.filter((m) => m.def !== 'module.reactor') };

function duel(): Sim {
  const reg: ContentRegistry = { ...content, ships: { ...content.ships, 'ship.hulk': hulk } };
  const sim = newGame(1, reg);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.hulk', x: 100, y: 50 });
  sim.step();
  sim.events.drain();
  return sim;
}

describe('a fight against a ship whose listed modules are all destroyed', () => {
  it('keeps aiming at what is left and fires', { timeout: 120000 }, () => {
    const sim = duel();
    const enemy = nth(sim, 2);
    // the target list shows weapons, shields, engines and consoles; the rest (lights, life support and so on) stays
    for (const i of modulesOf(sim, enemy)) {
      const d = sim.content.modules[sim.world.get(i, ModuleC)!.def]!;
      if (d.weapon || d.shieldGen || d.engine || d.console) sim.world.get(i, ModuleC)!.hp = 0;
    }
    aim(sim);
    const w = sim.world.query(WeaponC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, 1))!;
    sim.step();
    // Every pick is something that still stands: an intact module, or a wall tile with hp (ship-wide aim, issue #225).
    const g = shipGrid(sim, enemy)!;
    for (let n = 0; n < 20; n++) {
      const t = resolveTarget(sim, w, sim.world.get(nth(sim, 1), CombatC)!)!;
      const hp = t.tile ? g.get('hp', t.tile.x, t.tile.y) : sim.world.get(t.moduleId, ModuleC)!.hp;
      expect(hp).toBeGreaterThan(0);
    }
    let fired = 0;
    for (let t = 0; t < 2500; t++) {
      sim.step();
      fired += sim.events.drain().filter((e: SimEvent) => e.type === 'weapon.fired' && e.ship === nth(sim, 1)).length;
    }
    expect(fired).toBeGreaterThan(0);
    expect(sim.world.get(enemy, ShipC)!.integrity).toBeLessThan(0.8);
  });
});

describe('why the weapons are idle', () => {
  it('names the reason, in the order a player would fix it', () => {
    const sim = duel();
    const me = nth(sim, 1);
    const weapons = sim.world.query(WeaponC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === me);
    const console = modulesOf(sim, me).find((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]!.console === 'weapons')!;
    // nobody is at the console yet, no target set
    expect(operatorOf(sim, console)).toBe(0);
    expect(weaponsIdleReason(sim, me)).toBe('Weapons console unmanned');
    for (let t = 0; t < 1500 && !operatorOf(sim, console); t++) sim.step();
    expect(operatorOf(sim, console)).not.toBe(0);
    expect(weaponsIdleReason(sim, me)).toBe('No targets');
    aim(sim);
    sim.step();
    expect(weaponsIdleReason(sim, me)).toBeNull();
    sim.enqueue({ type: 'combat.setHold', ship: me, hold: true });
    sim.step();
    expect(weaponsIdleReason(sim, me)).toBe('Holding fire');
    sim.world.get(me, CombatC)!.hold = false;
    for (const w of weapons) sim.world.get(w, ModuleC)!.powered = false;
    expect(weaponsIdleReason(sim, me)).toBe('No power');
    sim.world.get(me, ShipC)!.state = 'disabled';
    expect(weaponsIdleReason(sim, me)).toBe('Ship disabled');
  });
});
