import { ShipC } from '../combat/components';
import { takePassenger } from '../consent/passage';
import { CrewC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { freeAirlock, playerShip } from '../trade/player';
import { VehicleC, type Vehicle } from './components';
import { boardingTile } from './geometry';
import { occupants, undock, unboardCrew, vehicleDefOf } from './lifecycle';

/**
 * Escape pods (`VehicleDef.escape`; DESIGN.md "Physical encounters", the medical pod). A pod is a vehicle with no pilot: it drifts where it was left until
 * someone calls it in (`callPod`: the player's ship gives it a free airlock), then flies itself there and docks. Docked at a ship, it lets its people out
 * on the airlock tile (`escapePodSystem`): on the player's ship a person of another side comes aboard as a passenger (consent/passage.ts: the player took
 * them in), and the downed are carried to a bed by the ordinary rescue job. Then the empty pod casts off and drifts. Launching pods from a ship's own pod
 * bays, crews ejecting from a dying ship and towing come later.
 */

export const isEscapePod = (sim: Sim, v: Vehicle | undefined): boolean => !!v && !!vehicleDefOf(sim, v)?.escape;

/** Call a drifting pod in to a free airlock of the player's ship. Null when it is on its way, else why not. */
export function callPod(sim: Sim, pod: number): string | null {
  const v = sim.world.get(pod, VehicleC);
  if (!v || !isEscapePod(sim, v)) return 'noPod';
  if (v.state !== 'flying') return 'notAdrift';
  if (v.dest?.type === 'dock') return null; // already coming
  if (!occupants(v).length) return 'empty';
  const airlock = freeAirlock(sim, pod);
  if (!airlock) return 'noAirlock';
  v.dest = { type: 'dock', airlock };
  v.autopilot = true;
  return null;
}

/** Each tick: a pod docked at a ship lets everyone aboard out on the airlock tile, then casts off empty. */
export function escapePodSystem(sim: Sim): void {
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (v.state !== 'docked' || !isEscapePod(sim, v)) continue;
    const at = boardingTile(sim, id);
    if (!at) continue;
    const ship = shipIdOf(sim, sim.world.get(v.dock, ModuleC) as { x: number; y: number });
    const host = sim.world.get(ship, ShipC)?.faction;
    for (const crew of occupants(v)) {
      unboardCrew(sim, crew, id, at);
      // Taken in by the player: a person of another side lives aboard as a passenger (no intruder, never drafted).
      if (host === 'player' && ship === playerShip(sim) && sim.world.has(crew, CrewC)) takePassenger(sim, ship, crew);
    }
    undock(sim, id, v);
    delete v.autopilot;
  }
}
