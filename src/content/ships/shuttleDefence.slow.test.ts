import { describe, expect, it } from 'vitest';
import { CrewC } from '../../sim/crew/components';
import { ModuleC } from '../../sim/modules/components';
import { shipIdOf } from '../../sim/regions';
import type { Sim } from '../../sim/sim';
import { VehicleC } from '../../sim/vehicles/components';
import { shuttleContent, shuttleSetup } from '../../../test/support/fixtures/shuttle';
import { crewOn, nth, run } from '../../../test/support/sim';
import { content } from '../index';
import type { ModuleDef } from '../../sim/registry';

// Slow tier: the natural 4000-tick runs of shuttleDefence.test.ts, from the shuttle's full hp down to the point-defence floor.
const shuttleOf = (sim: Sim, n: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, n))!;
const airlockOf = (sim: Sim, n: number): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
function disarm(sim: Sim, n: number): void {
  for (const i of sim.world.query(ModuleC)) {
    const m = sim.world.get(i, ModuleC)!;
    if ((content.modules[m.def as keyof typeof content.modules] as ModuleDef).weapon && shipIdOf(sim, m) === nth(sim, n)) m.enabled = false;
  }
}
function flyShuttle(seed: number, dest: (s: Sim) => NonNullable<import('../../sim/vehicles/components').Vehicle['dest']>): { sim: Sim; shuttle: number } {
  const sim = shuttleSetup(seed, shuttleContent);
  disarm(sim, 1);
  disarm(sim, 2);
  const shuttle = shuttleOf(sim, 2);
  sim.enqueue({ type: 'vehicle.embark', crew: crewOn(sim, 2).find((c) => sim.world.get(c, CrewC)!.role === 'role.pilot')!, vehicle: shuttle });
  run(sim, 400);
  sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
  run(sim, 2);
  sim.world.get(shuttle, VehicleC)!.dest = dest(sim);
  return { sim, shuttle };
}

describe('point defence against shuttles, run in full', () => {
  it('two turrets chip a docked shuttle down to the floor and no further', () => {
    const { sim, shuttle } = flyShuttle(1, (s) => ({ type: 'dock', airlock: airlockOf(s, 1) }));
    const out = run(sim, 20 * 200);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });

  it('two turrets chip a hovering shuttle down to the floor and no further', () => {
    const { sim, shuttle } = flyShuttle(2, (s) => ({ type: 'hover', ship: nth(s, 1) }));
    const out = run(sim, 20 * 200);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('flying');
    expect(out.filter((e) => e.type === 'vehicle.destroyed')).toHaveLength(0);
    expect(sim.world.get(shuttle, VehicleC)!.hp).toBe(27);
  });
});
