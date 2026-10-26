import { describe, expect, it } from 'vitest';
import { CombatC, CrewC, ShipC, ModuleC, PositionC, VehicleC, newGame, type ModuleDef, type Sim, type SimEvent, type Vehicle } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { missileRaiderId, shuttleContent } from './shuttleFixture';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const crewOn = (sim: Sim, n: number): number[] => sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === nth(sim, n));
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

function setup(seed: number, enemy = 'ship.raider'): Sim {
  const sim = newGame(seed, reg);
  sim.enqueue({ type: 'debug.spawnEnemy', template: enemy, x: 100, y: 50 });
  run(sim, 5);
  return sim;
}

/** The foe's shuttle (from the enemy) flown by its pilot, in flight with `dest`. */
function launch(sim: Sim, from: 1 | 2, dest: (sim: Sim) => VehicleDest): number {
  const shuttle = shuttleOf(sim, from);
  sim.enqueue({ type: 'vehicle.embark', crew: crewOn(sim, from).find((c) => sim.world.get(c, CrewC)!.role === 'role.pilot')!, vehicle: shuttle });
  run(sim, 400);
  sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
  run(sim, 2);
  sim.world.get(shuttle, VehicleC)!.dest = dest(sim);
  return shuttle;
}
type VehicleDest = NonNullable<Vehicle['dest']>;

describe('point defence against shuttles', () => {
  it('two turrets chip a docked shuttle down to the floor and no further', () => {
    const sim = setup(1);
    disarm(sim, 1);
    disarm(sim, 2);
    const shuttle = launch(sim, 2, (s) => ({ type: 'dock', airlock: airlockOf(s, 1) }));
    const out = run(sim, 20 * 200);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });

  it('two turrets chip a hovering shuttle down to the floor and no further', () => {
    const sim = setup(2);
    disarm(sim, 1);
    disarm(sim, 2);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }));
    const out = run(sim, 20 * 200);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('flying');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });
});

describe('shuttles and weapons', () => {
  it('a player missile launcher shoots down an incoming hostile shuttle; lasers never touch it', () => {
    const sim = setup(1);
    disarm(sim, 2);
    const shuttle = launch(sim, 2, (s) => ({ type: 'dock', airlock: airlockOf(s, 1) }));
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
    const sim = setup(1);
    disarm(sim, 2);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }));
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
    const out = run(sim, 20 * 40);
    const shots = out.filter((e) => e.type === 'weapon.fired' && e.weaponId === missile);
    expect(shots.length).toBeGreaterThan(0);
    for (const e of shots) if (e.type === 'weapon.fired') expect(e.targetShip).toBe(nth(sim, 2));
  });

  it('the enemy keeps its lasers on the ship while its missile launcher hunts a shuttle', () => {
    const sim = setup(3, missileRaiderId);
    disarm(sim, 1);
    const shuttle = launch(sim, 1, (s) => ({ type: 'hover', ship: nth(s, 2) }));
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
    const sim = setup(1);
    disarm(sim, 2);
    const shuttle = launch(sim, 2, (s) => ({ type: 'hover', ship: nth(s, 1) }));
    run(sim, 3);
    const combat = sim.world.get(nth(sim, 1), CombatC)!;
    expect(combat.vehicleTarget).toBe(shuttle);
    sim.world.get(nth(sim, 2), ShipC)!.faction = 'player'; // what capturePrize does
    run(sim, 3);
    expect(combat.vehicleTarget).toBeUndefined();
  });
});
