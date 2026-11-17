import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { ShipC } from '../../sim/combat/components';
import { Sim } from '../../sim/sim';
import { BodyC } from '../../sim/body';
import { CrewC, PositionC } from '../../sim/crew/components';
import type { SimEvent } from '../../sim/events';
import { ModuleC } from '../../sim/modules/components';
import { VehicleBayC, VehicleC, AboardC } from '../../sim/vehicles/components';
import { PAD_NOSE, airlockPad, padAirlock } from '../../sim/modules/landingPad';
import { groundPort } from '../../sim/modules/groundMount';
import { isCabled } from '../../sim/cable';
import { boardingTile } from '../../sim/vehicles/geometry';
import { SuitC } from '../../sim/eva/components';
import { shipGrid, shipIdOf } from '../../sim/regions';
import { Struct } from '../../sim/structure';
import { run as harnessRun } from '../../../test/support/sim';

function base(): { sim: Sim; ship: number; pads: number[] } {
  const sim = new Sim(5, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'trading', seed: 3 });
  sim.step();
  const ship = [...sim.world.query(ShipC)][0]!;
  const pads = [...sim.world.query(VehicleBayC)].filter((id) => sim.content.modules[sim.world.get(id, ModuleC)!.def]?.vehicleBay?.pad).sort((a, b) => a - b);
  return { sim, ship, pads };
}

const run = (sim: Sim, ticks: number, until?: () => boolean): SimEvent[] => harnessRun(sim, ticks, { until }); // `until` is checked after each step

describe('landing pads', () => {
  it('a surface base has its pads, its shuttle on the first, each pad beside an airlock', () => {
    const { sim, ship, pads } = base();
    expect(pads.length).toBe(2);
    expect(sim.world.get(pads[0]!, VehicleBayC)!.vehicle).toBeGreaterThan(0);
    expect(sim.world.get(pads[1]!, VehicleBayC)!.vehicle).toBe(0);
    for (const p of pads) expect(padAirlock(sim, p)).toBeGreaterThan(0);
    // Each pad's cable port is plugged into a cable that runs on to the hull.
    for (const p of pads) {
      const m = sim.world.get(p, ModuleC)!;
      const port = groundPort(sim.content.modules[m.def]!, m);
      expect(isCabled(sim.sector.grid, port.cable.x, port.cable.y), `pad ${p} port cable`).toBe(true);
    }
    const v = sim.world.get(pads[0]!, VehicleBayC)!.vehicle;
    expect(sim.world.get(v, VehicleC)!.state).toBe('stowed');
    expect(sim.world.get(v, VehicleC)!.homeShip).toBe(ship); // the shuttle belongs to the base
    expect(airlockPad(sim, padAirlock(sim, pads[0]!))).toBe(pads[0]);
    // It sits at the pad's middle, on the ground, and its crew board on the pad.
    const pm = sim.world.get(pads[0]!, ModuleC)!;
    expect(sim.world.get(v, BodyC)).toMatchObject({ x: pm.x + 4.5, y: pm.y + 4.5 });
    const at = boardingTile(sim, v)!;
    // Crew board at the foot of the rear ramp: the middle of the pad's edge behind the shuttle's tail (opposite its nose).
    const [nx, ny] = PAD_NOSE[pm.rot % 4]!;
    expect(at).toMatchObject({ x: pm.x + 4 - nx * 4, y: pm.y + 4 - ny * 4 });
    expect(shipGrid(sim, at.shipId)!.get('struct', at.x, at.y)).toBe(Struct.Ground);
  });

  it('crew suit up and walk out to the pad, fly the shuttle, land it on the other pad and walk back in', () => {
    const { sim, ship, pads } = base();
    const v = sim.world.get(pads[0]!, VehicleBayC)!.vehicle;
    const crew = [...sim.world.query(CrewC)].filter((c) => sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === ship).sort((a, b) => a - b)[0]!;
    sim.enqueue({ type: 'vehicle.embark', crew, vehicle: v });
    const ev = run(sim, 4000, () => sim.world.has(crew, AboardC));
    expect(sim.world.has(crew, AboardC), 'boarded').toBe(true);
    expect(ev.filter((e) => e.type === 'suit.donned').length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.type === 'airlock.cycled').length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.type === 'crew.downed' || e.type === 'crew.died')).toEqual([]);
    // Launch from the pad and land on the other one.
    const second = padAirlock(sim, pads[1]!);
    sim.enqueue({ type: 'vehicle.launch', vehicle: v });
    sim.enqueue({ type: 'vehicle.dock', vehicle: v, airlock: second });
    run(sim, 4000, () => sim.world.get(v, VehicleC)!.state === 'docked');
    const veh = sim.world.get(v, VehicleC)!;
    expect(veh.state).toBe('docked');
    const p1 = sim.world.get(pads[1]!, ModuleC)!;
    expect(sim.world.get(v, BodyC)).toMatchObject({ x: p1.x + 4.5, y: p1.y + 4.5 });
    // The pilot steps out onto the pad (in a suit) and walks to the airlock's inside.
    sim.enqueue({ type: 'vehicle.disembark', vehicle: v, crew });
    sim.step();
    expect(sim.world.get(crew, SuitC)).toBeDefined();
    const out = sim.world.get(crew, PositionC)!;
    expect(shipGrid(sim, ship)!.get('struct', out.x, out.y)).toBe(Struct.Ground);
    const ev2 = run(sim, 4000, () => !sim.world.has(crew, SuitC));
    expect(ev2.filter((e) => e.type === 'crew.downed' || e.type === 'crew.died')).toEqual([]);
    expect(sim.world.has(crew, SuitC), 'suit stowed back at an airlock').toBe(false);
    // Home again: back aboard, the shuttle flies to its own pad and parks; the pilot steps out onto it.
    sim.enqueue({ type: 'vehicle.embark', crew, vehicle: v });
    run(sim, 4000, () => sim.world.has(crew, AboardC));
    expect(sim.world.has(crew, AboardC), 'boarded again').toBe(true);
    sim.enqueue({ type: 'vehicle.return', vehicle: v });
    run(sim, 4000, () => sim.world.get(v, VehicleC)!.state === 'stowed');
    expect(sim.world.get(v, VehicleC)!.state).toBe('stowed');
    expect(sim.world.get(pads[0]!, VehicleBayC)!.vehicle).toBe(v);
    const p0 = sim.world.get(pads[0]!, ModuleC)!;
    expect(sim.world.get(v, BodyC)).toMatchObject({ x: p0.x + 4.5, y: p0.y + 4.5 });
  });

  it('a dug base keeps no vehicles and no pads', () => {
    for (const kind of ['pirate', 'criminal', 'covert'] as const) {
      const sim = new Sim(5, content);
      sim.enqueue({ type: 'debug.spawnOutpost', style: 'dug', kind, seed: 3 });
      sim.step();
      expect([...sim.world.query(VehicleBayC)].length, kind).toBe(0);
      expect([...sim.world.query(VehicleC)].length, kind).toBe(0);
    }
  });
});
