import { shipById } from '../combat/ships';
import { factionsHostile } from '../combat/factions';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';

/**
 * True if a player shuttle is docked at a hostile ship (a party may be aboard it, landed by hand). Cargo runs and trade leave such a shuttle
 * alone, so nobody is stranded by an automated job taking it away. (A boarding launch is an away site: its `SiteRunC` is the busy mark.)
 */
export function boardingReserved(sim: Sim, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v || v.state !== 'docked' || !v.dock) return false;
  const host = shipById(sim, shipIdOf(sim, sim.world.get(v.dock, ModuleC)));
  return !!host && factionsHostile('player', host.faction);
}
