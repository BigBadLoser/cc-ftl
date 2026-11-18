import { abortTask } from '../ai/task';
import { dropPassenger } from '../consent/passage';
import { releaseBedOwner } from '../crew/beds';
import { CrewC } from '../crew/components';
import { firePersonFact } from '../scene/carried';
import type { Sim } from '../sim';
import { playerShip } from '../trade/player';
import { AboardC, VehicleC } from '../vehicles/components';

/** Apart from galaxy/passage.ts (passage jobs and their pay) so that passage no longer imports the scene's person rules (#553). */

/**
 * The passenger leaves the ship: handed over at their destination (`delivered`: the event's person rules fire it first) or set down at a port. Their
 * passage grant goes and they leave play (wherever they stood: on deck, or aboard the shuttle that took them).
 */
export function passengerOff(sim: Sim, crew: number, delivered: boolean): void {
  if (delivered) firePersonFact(sim, crew, 'delivered');
  dropPassenger(sim, playerShip(sim), crew);
  const aboard = sim.world.get(crew, AboardC)?.vehicle;
  const v = aboard === undefined ? undefined : sim.world.get(aboard, VehicleC);
  if (v) {
    v.passengers = v.passengers.filter((c) => c !== crew);
    if (v.pilot === crew) v.pilot = 0;
  }
  if (!sim.world.has(crew, CrewC)) return;
  abortTask(sim, crew, 'removed');
  releaseBedOwner(sim, crew);
  sim.world.destroyEntity(crew);
}
