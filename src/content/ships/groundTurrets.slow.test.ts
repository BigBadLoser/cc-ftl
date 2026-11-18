import { describe, expect, it } from 'vitest';
import { homeShip } from '../../sim/combat/shipQuery';
import { CrewC, PositionC } from '../../sim/crew/components';
import { SuitC } from '../../sim/eva/components';
import { ModuleC } from '../../sim/modules/components';
import { shipIdOf } from '../../sim/regions';
import { Struct } from '../../sim/structure';
import { WeaponC } from '../../sim/combat/components';
import { MODS, provoke, run, setup, type Ev } from '../../../test/support/fixtures/groundTurrets';

/** The full-length runs of groundTurrets.test.ts: twelve volleys at a turret, and a half-destroyed turret mended from scratch. */
describe('ground turrets, the whole run', () => {
  it('the enemy aims at a turret and damages it; the point-defence turret shoots down missiles', () => {
    const { sim, base, turrets } = setup();
    provoke(sim, base);
    const gun = turrets.find((id) => MODS[sim.world.get(id, ModuleC)!.def]?.weapon)!;
    const me = homeShip(sim);
    run(sim, 20); // the fight is on (the player's guns take the base as their target), then the aim at the turret
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: base, targetModuleId: gun });
    const log: Ev[] = [];
    let low = Infinity;
    for (let k = 0; k < 12; k++) {
      for (const id of sim.world.query(WeaponC, ModuleC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)!) === me) sim.world.get(id, WeaponC)!.charge = 1;
      sim.enqueue({ type: 'combat.fireVolley', ship: me });
      for (let i = 0; i < 10 * 20; i++) {
        log.push(...run(sim, 1));
        low = Math.min(low, sim.world.get(gun, ModuleC)!.hp);
      }
    }
    expect(log.some((e) => e.type === 'projectile.hit' && e.ship === base && (e as { moduleId?: number }).moduleId === gun)).toBe(true);
    expect(low).toBeLessThan(MODS[sim.world.get(gun, ModuleC)!.def]!.maxHp);
    expect(log.some((e) => e.type === 'projectile.intercepted' && e.ship === base)).toBe(true);
  });

  it('a damaged turret is mended by a crew member who suits up and walks out over the ground', () => {
    const { sim, turrets } = setup();
    const id = turrets[0]!;
    const m = sim.world.get(id, ModuleC)!;
    const max = MODS[m.def]!.maxHp;
    m.hp = Math.round(max / 2);
    let suited = false;
    for (let i = 0; i < 240 * 20 && m.hp < max; i++) {
      sim.step();
      sim.events.drain();
      for (const c of sim.world.query(CrewC, PositionC)) {
        const p = sim.world.get(c, PositionC)!;
        if (sim.world.has(c, SuitC) && sim.sector.grid.get('struct', Math.round(p.x), Math.round(p.y)) === Struct.Ground) suited = true;
      }
    }
    expect(m.hp).toBe(max);
    expect(suited).toBe(true);
  });
});
