import { CrewC, DraftedC } from '../crew/components';
import type { Sim } from '../sim';
import { EmbarkOrderC, VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { unboardCrew } from '../vehicles/lifecycle';

/** Let a reserved pilot go: called off while still walking to the bay, or out of the seat at the bay. */
export function releasePilot(sim: Sim, vehicle: number, pilot: number): void {
  if (!pilot) return;
  if (sim.world.get(pilot, EmbarkOrderC)?.vehicle === vehicle) {
    sim.world.remove(pilot, EmbarkOrderC);
    sim.world.remove(pilot, DraftedC);
    const c = sim.world.get(pilot, CrewC);
    if (c) c.activity = 'idle';
  }
  const v = sim.world.get(vehicle, VehicleC);
  const at = boardingTile(sim, vehicle);
  if (v?.pilot === pilot && v.state === 'stowed' && at) unboardCrew(sim, pilot, vehicle, at);
}
