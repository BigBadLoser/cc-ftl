import { describe, expect, it } from 'vitest';
import {
  ALT, BodyC, CrewC, ModuleC, PositionC, ShipC, VehicleC, WeaponC, bayCenter, deserialize, dockPoint, isAirborne, newGame, serialize,
  shipEntityOf, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';

// Step 8 of the sector grid: vehicles are free bodies (BodyC) that pin to their bay or dock and fly in sector tiles.

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const reasons = (ev: SimEvent[]): string[] => ev.filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);
const shuttleOf = (sim: Sim): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === shipEntityOf(sim, 1))!;
const airlockOf = (sim: Sim, gridId: number): number =>
  sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.gridId === gridId && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;

/** Starter plus a disarmed raider at (100, 50); the starter's pilot aboard its shuttle, still stowed. */
function setup(seed = 1): { sim: Sim; v: number } {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  run(sim, 2);
  for (const i of sim.world.query(WeaponC)) if (sim.world.get(i, ModuleC)!.gridId === 2) sim.world.get(i, ModuleC)!.enabled = false;
  const v = shuttleOf(sim);
  const pilot = sim.world.query(CrewC).find((c) => sim.world.get(c, CrewC)!.role === 'role.pilot' && sim.world.get(c, PositionC)?.gridId === 1)!;
  sim.enqueue({ type: 'vehicle.embark', crew: pilot, vehicle: v });
  run(sim, 400);
  expect(sim.world.get(v, VehicleC)!.pilot).toBe(pilot);
  return { sim, v };
}
const body = (sim: Sim, v: number) => sim.world.get(v, BodyC)!;

describe('vehicle bodies', () => {
  it('a stowed shuttle belongs to its ship and is pinned to the bay centre on the deck every tick', () => {
    const sim = newGame(1, content);
    const v = shuttleOf(sim);
    const veh = sim.world.get(v, VehicleC)!;
    expect(veh.homeShip).toBe(shipEntityOf(sim, 1));
    expect(veh).not.toHaveProperty('x');
    run(sim, 1);
    const c = bayCenter(sim, veh.home)!;
    expect(body(sim, v)).toMatchObject({ x: c.x, y: c.y, alt: ALT.stowed });
    Object.assign(body(sim, v), { x: -40, y: 7, alt: 9 });
    run(sim, 1);
    expect(body(sim, v)).toMatchObject({ x: c.x, y: c.y, alt: ALT.stowed });
    expect(isAirborne(body(sim, v))).toBe(false);
  });

  it('flies a straight line at cruise altitude, docks pinned to the dock point, and undocks free where it was', () => {
    const { sim, v } = setup();
    const airlock = airlockOf(sim, 2);
    const to = dockPoint(sim, airlock)!;
    sim.enqueue({ type: 'vehicle.dock', vehicle: v, airlock });
    run(sim, 3);
    const a = { ...body(sim, v) };
    expect(sim.world.get(v, VehicleC)!.state).toBe('flying');
    expect(a.alt).toBe(ALT.cruise);
    expect(isAirborne(a)).toBe(true);
    expect(a.heading).toBeCloseTo(Math.atan2(to.y - a.y, to.x - a.x));
    run(sim, 20);
    const b = body(sim, v);
    // Still on the line from a to the dock point.
    const cross = (b.x - a.x) * (to.y - a.y) - (b.y - a.y) * (to.x - a.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(1);

    const ev = run(sim, 600);
    expect(ev.some((e) => e.type === 'vehicle.docked')).toBe(true);
    expect(sim.world.get(v, VehicleC)!.state).toBe('docked');
    expect(body(sim, v)).toMatchObject({ x: to.x, y: to.y, alt: ALT.docked });
    expect(isAirborne(body(sim, v))).toBe(false);
    Object.assign(body(sim, v), { x: 0, y: 0, alt: 5 });
    run(sim, 1);
    expect(body(sim, v)).toMatchObject({ x: to.x, y: to.y, alt: ALT.docked });

    sim.enqueue({ type: 'vehicle.undock', vehicle: v });
    run(sim, 1);
    expect(sim.world.get(v, VehicleC)).toMatchObject({ state: 'flying', dock: 0, dest: null });
    expect(body(sim, v)).toMatchObject({ x: to.x, y: to.y, alt: ALT.cruise });
    run(sim, 20);
    expect(body(sim, v)).toMatchObject({ x: to.x, y: to.y }); // no destination: holds where it was freed
  });

  it('hovers off another ship by its ship id; its own ship and a non-ship are refused', () => {
    const { sim, v } = setup();
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: shipEntityOf(sim, 1) });
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: v });
    expect(reasons(run(sim, 1))).toEqual(['badTarget', 'badTarget']);
    const raider = shipEntityOf(sim, 2);
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: raider });
    run(sim, 20 * 40);
    const veh = sim.world.get(v, VehicleC)!;
    expect(veh).toMatchObject({ state: 'flying', dest: null, hover: raider });
    const s = sim.world.get(raider, ShipC)!;
    const gap = content.vehicles['vehicle.shuttle'].eva!.hoverGap;
    expect(body(sim, v).x).toBeCloseTo(s.x - gap); // off the west side, facing the starter
    expect(body(sim, v).alt).toBe(ALT.cruise);
  });

  it('is deterministic and survives a save round trip mid-flight', () => {
    const go = (save: boolean): string => {
      const start = setup(4);
      const v = start.v;
      let sim = start.sim;
      sim.enqueue({ type: 'vehicle.dock', vehicle: v, airlock: airlockOf(sim, 2) });
      run(sim, 60);
      if (save) sim = deserialize(serialize(sim), content);
      expect(sim.world.get(v, BodyC)).toBeDefined();
      run(sim, 600);
      expect(sim.world.get(v, VehicleC)!.state).toBe('docked');
      return serialize(sim);
    };
    const plain = go(false);
    expect(go(false)).toBe(plain);
    expect(go(true)).toBe(plain);
  });
});
