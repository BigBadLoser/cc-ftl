import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, WeaponC } from '../../sim/combat/components';
import { isDormant } from '../../sim/combat/dormant';
import { homeShip } from '../../sim/combat/shipQuery';
import { ModuleC } from '../../sim/modules/components';
import { discoverOutpost } from '../../sim/outposts/state';
import { shipIdOf } from '../../sim/regions';
import { VehicleC } from '../../sim/vehicles/components';
import { run, spawn } from '../../../test/support/fixtures/outpostDefence';

/** The long runs of outpostDefence.test.ts at full length: the aim that stays no hostile act, the fight after the wake, a sleeping outpost's quiet, the lasers that cannot hit a shuttle. */
describe('a woken hostile outpost defends like a woken pirate den, the whole run', () => {
  it('aimed at, it sleeps on; fired on: wakes, the node goes into combat, its turret shoots the aggressor', () => {
    const { sim, base } = spawn('dug', 'pirate');
    const me = homeShip(sim);
    expect(sim.world.has(base, CombatC)).toBe(false);
    discoverOutpost(sim, base, 'proximity');
    // An aim alone, ship-wide and then with weapons held at battle stations, is no hostile act (user ruling, #173).
    sim.enqueue({ type: 'combat.setTarget', ship: me, weaponId: null, targetShip: base, targetModuleId: 0 });
    expect(run(sim, 300)).not.toContain('ship.provoked');
    sim.enqueue({ type: 'combat.battleStations', on: true });
    expect(run(sim, 5 * 20)).not.toContain('ship.provoked'); // the turrets run out
    expect(isDormant(sim.world.get(base, ShipC))).toBe(true);
    // The shot that leaves is.
    for (const w of sim.world.query(WeaponC, ModuleC)) if (shipIdOf(sim, sim.world.get(w, ModuleC)!) === me) sim.world.get(w, WeaponC)!.charge = 1;
    sim.enqueue({ type: 'combat.fireVolley', ship: me });
    const log: string[] = [];
    for (let i = 0; i < 200 && !log.includes('weapon.fired'); i++) run(sim, 1, log);
    // It wakes as the shot leaves (a hostile act through combat/provoke.ts), before anything lands.
    expect(log).toContain('ship.provoked');
    expect(isDormant(sim.world.get(base, ShipC))).toBe(false);
    run(sim, 600, log);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
    expect(isDormant(sim.world.get(base, ShipC))).toBe(false);
    expect(sim.world.get(base, CombatC)!.target?.ship).toBe(homeShip(sim));
    expect(log).toContain('weapon.fired');
    const guns = [...sim.world.query(WeaponC, ModuleC)].filter((w) => shipIdOf(sim, sim.world.get(w, ModuleC)) === base);
    expect(guns.length).toBeGreaterThan(0);
  });

  it('a woken outpost with only lasers cannot shoot the player shuttle hovering beside it', () => {
    const { sim, base } = spawn('dug', 'pirate');
    discoverOutpost(sim, base, 'proximity');
    const shuttle = [...sim.world.query(VehicleC)][0]!;
    sim.world.get(shuttle, VehicleC)!.autopilot = true;
    sim.world.get(base, ShipC)!.integrity -= 0.05; // provoked
    sim.enqueue({ type: 'vehicle.hover', vehicle: shuttle, ship: base });
    const log = run(sim, 1500);
    expect(log).toContain('combat.started');
    expect(log).not.toContain('vehicle.damaged'); // only the missile launcher can hit a shuttle
  });

  it('sleeping outposts stay quiet: no crew fight, no combat', () => {
    const { sim } = spawn('dug', 'pirate');
    const log = run(sim, 1500);
    expect(log).not.toContain('combat.started');
    expect(log).not.toContain('station.alarm');
    expect(log.filter((e) => e.startsWith('crew.attacked'))).toEqual([]);
  });
});
