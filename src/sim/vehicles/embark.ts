import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { abortTask } from '../ai/task';
import { FighterC } from '../fight/components';
import { isIncapacitated } from '../crew/helpers';
import { airlockWorking } from '../modules/airlock';
import type { Sim } from '../sim';
import { AboardC, EmbarkOrderC, VehicleC } from './components';
import { boardingTile } from './geometry';
import { occupants, vehicleDefOf } from './lifecycle';

/**
 * Send a crew member to board a vehicle: drafted (out of their job and bed claim) and walking to its boarding tile, where the
 * vehicle system boards them. Returns a reject reason, or null. `vehicle.embark` and the mining system (sending a pilot to a
 * pod) share it.
 */
export function sendToEmbark(sim: Sim, crew: number, vehicle: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 'noVehicle';
  if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC) || sim.world.has(crew, AboardC)) return 'noCrew';
  if (isIncapacitated(sim, crew) || !sim.world.has(crew, PositionC)) return 'incapacitated';
  const at = boardingTile(sim, vehicle);
  if (!at) return 'notBoardable';
  if (v.state === 'docked' && !airlockWorking(sim, v.dock)) return 'airlockDown';
  if (occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return 'full';
  let drafted = sim.world.get(crew, DraftedC);
  if (!drafted) {
    abortTask(sim, crew, 'drafted');
    drafted = { target: null };
    sim.world.add(crew, DraftedC, drafted);
    (sim.world.get(crew, CrewC) as { activity: string }).activity = 'drafted';
  }
  drafted.target = { x: at.x, y: at.y };
  delete drafted.planned;
  const fighter = sim.world.get(crew, FighterC);
  if (fighter) fighter.ordered = 0; // climbing in replaces an attack order
  sim.world.add(crew, EmbarkOrderC, { vehicle });
  return null;
}
