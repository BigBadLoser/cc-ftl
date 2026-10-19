import { CrewC, DeadC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { EvaFloatC } from '../eva/components';
import { vehicleSuits } from '../eva/shuttle';
import { SuitC } from '../portals/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardCrew, occupants, vehicleDefOf } from '../vehicles/lifecycle';

/**
 * Suited crew drifting between a hovering shuttle and a hull. While `ticks` run down their movement is frozen (the
 * movement system skips them). Going out they simply land; coming back they board when the drift ends, the suit goes
 * into the shuttle's stock (tank refilled) and they are hidden aboard like any passenger. Downed or dead crew stop where they are.
 */
export function evaFloatSystem(sim: Sim): void {
  for (const id of sim.world.query(EvaFloatC, CrewC)) {
    const f = sim.world.get(id, EvaFloatC)!;
    if (sim.world.has(id, DeadC) || isIncapacitated(sim, id)) {
      sim.world.remove(id, EvaFloatC);
      continue;
    }
    if (--f.ticks > 0) continue;
    sim.world.remove(id, EvaFloatC);
    if (f.mode !== 'back') continue;
    const v = sim.world.get(f.vehicle, VehicleC);
    if (!v || occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) continue; // nowhere to climb in: stay out
    v.suits = vehicleSuits(sim, v) + 1;
    sim.world.remove(id, SuitC);
    sim.events.emit({ type: 'suit.doffed', crew: id, airlock: 0 });
    boardCrew(sim, id, f.vehicle);
  }
}
