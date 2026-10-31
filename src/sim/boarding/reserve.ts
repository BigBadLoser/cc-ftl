import { shipById } from '../combat/ships';
import { factionsHostile } from '../combat/factions';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { BoardLaunchC, RecallC } from './components';

/**
 * True if a player shuttle belongs to a boarding: launching (`boarding.launch`), bringing a party home (`crew.recall`), or docked
 * at a hostile ship, where it waits for the landed party's recall. Cargo runs and trade leave such a shuttle alone, so the party is
 * never stranded by an automated job taking it away.
 */
export function boardingReserved(sim: Sim, vehicle: number): boolean {
  if (sim.world.has(vehicle, BoardLaunchC) || sim.world.has(vehicle, RecallC)) return true;
  const v = sim.world.get(vehicle, VehicleC);
  if (!v || v.state !== 'docked' || !v.dock) return false;
  const host = shipById(sim, shipIdOf(sim, sim.world.get(v.dock, ModuleC)));
  return !!host && factionsHostile('player', host.faction);
}
