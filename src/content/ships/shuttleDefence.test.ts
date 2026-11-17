import { describe, expect, it } from 'vitest';
import { BodyC } from '../../sim/body';
import { CombatC, ShipC } from '../../sim/combat/components';
import { CrewC } from '../../sim/crew/components';
import type { SimEvent } from '../../sim/events';
import { ModuleC } from '../../sim/modules/components';
import type { ModuleDef } from '../../sim/registry';
import { vehicleDefOf } from '../../sim/vehicles/lifecycle';
import { VEHICLE_PD_DAMAGE, VEHICLE_PD_FLOOR } from '../../sim/tuning';
import type { Sim } from '../../sim/sim';
import { type Vehicle, VehicleC } from '../../sim/vehicles/components';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { missileRaiderId, shuttleContent, shuttleSetup } from '../../../test/support/fixtures/shuttle';
import { cachedWorld } from '../../../test/support/world';
import { crewOn, nth, run } from '../../../test/support/sim';

const shuttleOf = (sim: Sim, n: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, n))!;
const airlockOf = (sim: Sim, n: number): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
const weaponsOf = (sim: Sim, n: number, weapon: string): number[] => sim.world.query(ModuleC).filter((i) => {
  const m = sim.world.get(i, ModuleC)!;
  return shipIdOf(sim, m) === nth(sim, n) && (content.modules[m.def as keyof typeof content.modules] as ModuleDef).weapon === weapon;
});
/** Switch off every weapon of a grid. */
function disarm(sim: Sim, n: number): void {
  for (const i of sim.world.query(ModuleC)) {
    const m = sim.world.get(i, ModuleC)!;
    if ((content.modules[m.def as keyof typeof content.modules] as ModuleDef).weapon && shipIdOf(sim, m) === nth(sim, n)) m.enabled = false;
  }
}

const reg = shuttleContent;

const setup = (seed: number, enemy = 'ship.raider'): Sim => shuttleSetup(seed, reg, enemy);

/** `from`'s pilot embarked in its shuttle (400 ticks) after `disarmed` grids were switched off: built once per worker, cloned per call. */
function embarkedScene(seed: number, enemy: string, from: 1 | 2, disarmed: number[]): Sim {
  return cachedWorld(`shuttleDefence:${seed}:${enemy}:${from}:${disarmed.join()}`, () => {
    const sim = setup(seed, enemy);
    for (const n of disarmed) disarm(sim, n);
    embark(sim, from);
    return sim;
  });
}

function embark(sim: Sim, from: 1 | 2): void {
  sim.enqueue({ type: 'vehicle.embark', crew: crewOn(sim, from).find((c) => sim.world.get(c, CrewC)!.role === 'role.pilot')!, vehicle: shuttleOf(sim, from) });
  run(sim, 400);
}

/** The foe's shuttle (from the enemy) flown by its pilot, in flight with `dest`. */
function launch(sim: Sim, from: 1 | 2, dest: (sim: Sim) => VehicleDest, embarked = false): number {
  const shuttle = shuttleOf(sim, from);
  if (!embarked) embark(sim, from);
  sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
  run(sim, 2);
  sim.world.get(shuttle, VehicleC)!.dest = dest(sim);
  return shuttle;
}
type VehicleDest = NonNullable<Vehicle['dest']>;

describe('point defence against shuttles', () => {
  // The natural run (the shuttle chipped from full hp down to the floor) is in shuttleDefence.slow.test.ts; here it starts one chip above it.
  const nearFloor = (sim: Sim, shuttle: number): void => {
    const v = sim.world.get(shuttle, VehicleC)!;
    v.hp = Math.ceil((vehicleDefOf(sim, v)?.maxHp ?? 0) * VEHICLE_PD_FLOOR) + VEHICLE_PD_DAMAGE;
  };

  it('two turrets chip a docked shuttle down to the floor and no further', () => {
    const sim = embarkedScene(1, 'ship.raider', 2, [1, 2]);
    const shuttle = launch(sim, 2, (s) => ({ type: 'dock', airlock: airlockOf(s, 1) }), true);
    nearFloor(sim, shuttle);
    const out = run(sim, 20 * 60);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });

  it('two turrets chip a hovering shuttle down to the floor and no further', () => {
    const sim = embarkedScene(2, 'ship.raider', 2, [1, 2]);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }), true);
    nearFloor(sim, shuttle);
    const out = run(sim, 20 * 60);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('flying');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });
});

describe('shuttles and weapons', () => {
  it('a player missile launcher shoots down an incoming hostile shuttle; lasers never touch it', () => {
    const sim = embarkedScene(1, 'ship.raider', 2, [2]);
    const shuttle = launch(sim, 2, (s) => ({ type: 'dock', airlock: airlockOf(s, 1) }), true);
    const out = run(sim, 20 * 90);
    expect(out.filter((e) => e.type === 'vehicle.destroyed' && e.vehicle === shuttle)).toHaveLength(1);
    expect(out.filter((e) => e.type === 'vehicle.damaged' && e.source === 'weapon').length).toBeGreaterThan(0);
    const missile = weaponsOf(sim, 1, 'weapon.missile');
    const fired = out.filter((e) => e.type === 'weapon.fired');
    expect(fired.some((e) => e.type === 'weapon.fired' && missile.includes(e.weaponId) && e.targetShip === 0)).toBe(true);
    // Every laser volley went at the ship, never at a shuttle.
    for (const e of fired) if (e.type === 'weapon.fired' && e.weapon === 'weapon.burstLaser') expect(e.targetShip).not.toBe(0);
  });

  it('rejects a shuttle target on a laser, accepts one on a missile launcher', () => {
    const sim = embarkedScene(1, 'ship.raider', 2, [2]);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }), true);
    const aim = (weaponId: number): SimEvent[] => {
      sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId, targetShip: 0, targetModuleId: 0, targetVehicle: shuttle });
      return run(sim, 1);
    };
    const laser = weaponsOf(sim, 1, 'weapon.burstLaser')[0] as number;
    expect(aim(laser).some((e) => e.type === 'command.rejected' && e.reason === 'notAntiVehicle')).toBe(true);
    expect(aim(weaponsOf(sim, 1, 'weapon.missile')[0] as number).some((e) => e.type === 'command.rejected')).toBe(false);
  });

  it('a hand-set weapon target beats the automatic shuttle switch', () => {
    const sim = setup(1);
    disarm(sim, 2);
    const missile = weaponsOf(sim, 1, 'weapon.missile')[0] as number;
    sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 1), weaponId: missile, targetShip: nth(sim, 2), targetModuleId: 0 });
    launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }));
    // The missile launcher starts on hold; aiming it by hand is the order to fire, once, at the ship, not at the shuttle.
    const out = run(sim, 20 * 40);
    const shots = out.filter((e) => e.type === 'weapon.fired' && e.weaponId === missile);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots).toHaveLength(1); // fired once on the aim, then back to waiting
    for (const e of shots) if (e.type === 'weapon.fired') expect(e.targetShip).toBe(nth(sim, 2));
  });

  it('the enemy keeps its lasers on the ship while its missile launcher hunts a shuttle', () => {
    const sim = embarkedScene(3, missileRaiderId, 1, [1]);
    const shuttle = launch(sim, 1, (s) => ({ type: 'hover', ship: nth(s, 2) }), true);
    const out = run(sim, 20 * 60);
    expect(sim.world.get(nth(sim, 2), CombatC)!.target?.vehicle).toBeUndefined();
    const fired = out.filter((e) => e.type === 'weapon.fired' && e.ship === nth(sim, 2));
    const lasers = fired.filter((e) => e.type === 'weapon.fired' && e.weapon === 'weapon.burstLaser');
    const missiles = fired.filter((e) => e.type === 'weapon.fired' && e.weapon === 'weapon.missile');
    expect(lasers.length).toBeGreaterThan(0);
    for (const e of lasers) if (e.type === 'weapon.fired') expect(e.targetShip).toBe(nth(sim, 1));
    expect(missiles.length).toBeGreaterThan(0);
    expect(missiles.some((e) => e.type === 'weapon.fired' && e.targetShip === 0)).toBe(true);
    expect(shuttle).toBeGreaterThan(0);
  });
});

describe('shuttle targets after a capture', () => {
  it("drops the automatic target when the shuttle's home ship is captured", () => {
    const sim = embarkedScene(1, 'ship.raider', 2, [2]);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }), true);
    run(sim, 3);
    const combat = sim.world.get(nth(sim, 1), CombatC)!;
    expect(combat.vehicleTarget).toBe(shuttle);
    sim.world.get(nth(sim, 2), ShipC)!.faction = 'player'; // what capturePrize does
    run(sim, 3);
    expect(combat.vehicleTarget).toBeUndefined();
  });
});

describe('enemy shuttle choice', () => {
  it('skips a neutral flying shuttle listed before the hostile one', () => {
    const sim = setup(3, missileRaiderId);
    disarm(sim, 1);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 20, y: 100 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 20, y: 0 });
    run(sim, 2);
    sim.world.get(nth(sim, 3), ShipC)!.faction = 'neutral'; // its shuttle is no foe of the missile raider
    sim.world.get(nth(sim, 4), ShipC)!.faction = 'rogue'; // at war with it
    const neutral = shuttleOf(sim, 3);
    const foe = shuttleOf(sim, 4);
    expect(neutral).toBeLessThan(foe);
    for (const v of [neutral, foe]) {
      sim.world.get(v, VehicleC)!.state = 'flying';
      const b = sim.world.get(v, BodyC);
      if (b) Object.assign(b, { x: 90, y: 50 });
      else sim.world.add(v, BodyC, { x: 90, y: 50, heading: 0, alt: 0 });
    }
    const targets = new Set<number | undefined>();
    for (let i = 0; i < 100; i++) {
      run(sim, 1);
      targets.add(sim.world.get(nth(sim, 2), CombatC)!.vehicleTarget);
    }
    expect(targets.has(foe)).toBe(true);
    expect(targets.has(neutral)).toBe(false);
  });
});
