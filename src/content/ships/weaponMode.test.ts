import { describe, expect, it } from 'vitest';
import { CombatC, ModuleC, WeaponC, deserialize, newGame, serialize, type ContentRegistry, type ShipTemplate, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

/** A 14x9 hull with a reactor, a weapons console, a burst laser and a missile launcher (and missiles), facing the passive raider. */
const gun: ShipTemplate = {
  name: 'Gun', crew: ['role.gunner'],
  rows: ['##############', ...Array.from({ length: 7 }, () => '#____________#'), '##############'],
  modules: [
    { def: 'module.reactor', x: 1, y: 1, rot: 0 },
    { def: 'module.weaponsConsole', x: 6, y: 1, rot: 0 },
    { def: 'module.burstLaser', x: 9, y: 1, rot: 0 },
    { def: 'module.missileLauncher', x: 9, y: 4, rot: 0 },
    { def: 'module.storage', x: 5, y: 6, rot: 2, stock: [{ item: 'item.missile', count: 20 }] },
  ],
};
const dummy: ShipTemplate = { ...content.ships['ship.raider'], crew: [] };
const reg: ContentRegistry = { ...content, ships: { ...content.ships, 'ship.gun': gun, 'ship.target': dummy } };

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const weapon = (sim: Sim, def: string): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, 1) && sim.world.get(i, ModuleC)!.def === def) as number;
const fired = (events: SimEvent[], id: number): number => events.filter((e) => e.type === 'weapon.fired' && e.weaponId === id).length;

function duel(): Sim {
  const sim = newGame(1, reg, 'ship.gun');
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.target', x: 100, y: 50 });
  run(sim, 1);
  sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId: null, targetShip: nth(sim, 2), targetModuleId: 0 });
  return sim;
}

describe('weapon modes', () => {
  it('ammo weapons start on hold, the others on auto', () => {
    const sim = duel();
    expect(sim.world.get(weapon(sim, 'module.missileLauncher'), WeaponC)!.mode).toBe('hold');
    expect(sim.world.get(weapon(sim, 'module.burstLaser'), WeaponC)!.mode).toBe('auto');
  });

  it('a held weapon charges but does not fire, then fires on a volley; auto keeps firing', () => {
    const sim = duel();
    const missile = weapon(sim, 'module.missileLauncher');
    const laser = weapon(sim, 'module.burstLaser');
    const quiet = run(sim, 20 * 25);
    expect(fired(quiet, missile)).toBe(0);
    expect(sim.world.get(missile, WeaponC)!.charge).toBe(1);
    expect(fired(quiet, laser)).toBeGreaterThan(0);
    sim.enqueue({ type: 'combat.fireVolley', ship: nth(sim, 1) });
    expect(fired(run(sim, 5), missile)).toBe(1);
  });

  it('aiming a held weapon fires it once and it stays on hold', () => {
    const sim = duel();
    const missile = weapon(sim, 'module.missileLauncher');
    run(sim, 20 * 25); // fully charged, waiting
    sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId: missile, targetShip: nth(sim, 2), targetModuleId: 0 });
    const out = run(sim, 20 * 30);
    expect(fired(out, missile)).toBe(1);
    expect(sim.world.get(missile, WeaponC)!.mode).toBe('hold');
  });

  it('hold all puts every weapon on hold and remembers; again restores', () => {
    const sim = duel();
    const missile = weapon(sim, 'module.missileLauncher');
    const laser = weapon(sim, 'module.burstLaser');
    sim.enqueue({ type: 'combat.setWeaponMode', ship: nth(sim, 1), weaponId: missile, mode: 'auto' });
    sim.enqueue({ type: 'combat.holdAll', ship: nth(sim, 1), hold: true });
    run(sim, 1);
    expect(sim.world.get(missile, WeaponC)!.mode).toBe('hold');
    expect(sim.world.get(laser, WeaponC)!.mode).toBe('hold');
    expect(fired(run(sim, 20 * 25), laser)).toBe(0);
    sim.enqueue({ type: 'combat.holdAll', ship: nth(sim, 1), hold: false });
    run(sim, 1);
    expect(sim.world.get(missile, WeaponC)!.mode).toBe('auto'); // the mode it had, not the default
    expect(sim.world.get(laser, WeaponC)!.mode).toBe('auto');
    expect(sim.world.get(laser, WeaponC)!.restore).toBeUndefined();
  });

  it('the AI hold still works and ignores modes', () => {
    const sim = duel();
    sim.enqueue({ type: 'combat.setHold', ship: nth(sim, 2), hold: true });
    run(sim, 1);
    expect(sim.world.get(nth(sim, 2), CombatC)!.hold).toBe(true);
  });

  it('modes survive a save and load', () => {
    const sim = duel();
    sim.enqueue({ type: 'combat.setWeaponMode', ship: nth(sim, 1), weaponId: weapon(sim, 'module.burstLaser'), mode: 'hold' });
    run(sim, 1);
    const copy = deserialize(serialize(sim), reg);
    expect(copy.world.get(weapon(copy, 'module.burstLaser'), WeaponC)!.mode).toBe('hold');
    expect(copy.world.get(weapon(copy, 'module.missileLauncher'), WeaponC)!.mode).toBe('hold');
  });
});
