import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { ShipC, Sim } from '../../sim';
import { ModuleC } from '../../sim/modules/components';
import { VehicleBayC, VehicleC } from '../../sim/vehicles/components';
import { airlockPad, padAirlock } from '../../sim/modules/landingPad';
import { boardingTile } from '../../sim/vehicles/geometry';

function base(kind: 'trading' | 'farming' | 'mining' = 'trading', seed = 3): { sim: Sim; ship: number; pads: number[] } {
  const sim = new Sim(5, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind, seed });
  sim.step();
  const ship = [...sim.world.query(ShipC)][0]!;
  const pads = [...sim.world.query(VehicleBayC)].filter((id) => sim.content.modules[sim.world.get(id, ModuleC)!.def]?.vehicleBay?.pad).sort((a, b) => a - b);
  return { sim, ship, pads };
}

describe('landing pads', () => {
  it('a surface base has its pads, its shuttle on the first, each pad beside an airlock', () => {
    const { sim, pads } = base();
    expect(pads.length).toBe(2);
    expect(sim.world.get(pads[0]!, VehicleBayC)!.vehicle).toBeGreaterThan(0);
    expect(sim.world.get(pads[1]!, VehicleBayC)!.vehicle).toBe(0);
    for (const p of pads) expect(padAirlock(sim, p)).toBeGreaterThan(0);
    const v = sim.world.get(pads[0]!, VehicleBayC)!.vehicle;
    expect(sim.world.get(v, VehicleC)!.state).toBe('stowed');
    const at = boardingTile(sim, v)!;
    expect(airlockPad(sim, padAirlock(sim, pads[0]!))).toBe(pads[0]);
    console.log(at, sim.world.get(pads[0]!, ModuleC), sim.world.get(padAirlock(sim, pads[0]!), ModuleC));
  });
});
