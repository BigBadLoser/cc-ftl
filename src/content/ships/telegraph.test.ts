import { describe, expect, it } from 'vitest';
import { ModuleC, ProjectileC, ShipC, WeaponC, newGame, type Sim, type SimEvent } from '../../sim';
import { commitCharge } from '../../sim/combat/commit';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

function fight(): { sim: Sim; player: number; enemy: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 20, y: 90 });
  sim.step();
  sim.events.drain();
  const [player, enemy] = shipIds(sim) as [number, number];
  return { sim, player, enemy };
}
const enemyWeapons = (sim: Sim, enemy: number): number[] =>
  sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === enemy) as number[];
/** Step until `pred` holds (at most `max` ticks); returns the events seen on the way. */
function until(sim: Sim, pred: () => boolean, max = 4000): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < max && !pred(); i++) {
    sim.step();
    seen.push(...sim.events.drain());
  }
  expect(pred()).toBe(true);
  return seen;
}

describe('incoming-fire telegraph', () => {
  it('commits the aim inside the final charge window, before the shot, and the shot lands near it', { timeout: 120000 }, () => {
    const { sim, player, enemy } = fight();
    const ws = enemyWeapons(sim, enemy);
    expect(ws.length).toBeGreaterThan(0);
    const committed = (): number | undefined => ws.find((id) => !!sim.world.get(id, WeaponC)?.commit);
    until(sim, () => committed() !== undefined);
    const id = committed() as number;
    const w = sim.world.get(id, WeaponC)!;
    const chargeSec = sim.content.weapons?.[sim.content.modules[sim.world.get(id, ModuleC)!.def]?.weapon ?? '']?.chargeSec ?? 1;
    expect(w.charge).toBeLessThan(1); // committed while still charging, not at the shot
    expect(w.charge).toBeGreaterThanOrEqual(commitCharge(chargeSec) - 0.01);
    expect(w.commit!.target.ship).toBe(player);
    const commit = { ...w.commit! };
    const events = until(sim, () => sim.world.query(ProjectileC).some((p) => sim.world.get(p, ProjectileC)!.fromModuleId === id));
    const fired = [...events, ...until(sim, () => sim.world.query(ProjectileC).length === 0, 600)];
    expect(sim.world.get(id, WeaponC)!.commit).toBeNull(); // cleared on fire
    const mine = new Set(fired.filter((e) => e.type === 'weapon.fired' && e.weaponId === id).map((e) => (e as { projectile: number }).projectile));
    expect(mine.size).toBeGreaterThan(0);
    for (const e of fired) {
      if (e.type === 'weapon.fired' && e.weaponId === id) {
        expect(e.targetShip).toBe(commit.target.ship); // the shot goes where the commit said
        expect(e.targetModuleId).toBe(commit.target.moduleId);
      }
      if (e.type === 'projectile.hit' && mine.has(e.projectile)) {
        // lands in the committed area give or take the weapon's scatter
        expect(e.x).toBeGreaterThanOrEqual(commit.x - 6);
        expect(e.x).toBeLessThanOrEqual(commit.x + commit.w + 6);
        expect(e.y).toBeGreaterThanOrEqual(commit.y - 6);
        expect(e.y).toBeLessThanOrEqual(commit.y + commit.h + 6);
      }
    }
  });

  it('is deterministic: the same seed commits the same aim at the same tick', () => {
    const run = (): string => {
      const { sim, enemy } = fight();
      const ws = enemyWeapons(sim, enemy);
      until(sim, () => ws.some((id) => !!sim.world.get(id, WeaponC)?.commit));
      const id = ws.find((i) => !!sim.world.get(i, WeaponC)?.commit) as number;
      return JSON.stringify([sim.tick, id, sim.world.get(id, WeaponC)!.commit]);
    };
    expect(run()).toBe(run());
  });

  it('clears the commit when the weapon is destroyed, and when the fight ends', { timeout: 120000 }, () => {
    const { sim, enemy } = fight();
    const ws = enemyWeapons(sim, enemy);
    const committed = (): number[] => ws.filter((id) => !!sim.world.get(id, WeaponC)?.commit);
    until(sim, () => committed().length > 0);
    const id = committed()[0] as number;
    sim.world.get(id, ModuleC)!.hp = 0;
    sim.step();
    expect(sim.world.get(id, WeaponC)!.commit).toBeNull();
    until(sim, () => committed().length > 0);
    sim.sector.inCombat = false;
    sim.step();
    expect(committed()).toEqual([]);
    expect(sim.world.get(enemy, ShipC)).toBeDefined();
  });
});
