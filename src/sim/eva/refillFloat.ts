import { BodyC } from '../body';
import { PositionC } from '../crew/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { EvaFloatC } from './components';
import { floatTicks, hatchSpot, tileCentre } from './shuttle';
import { hatchFace } from './hatch';
import { shipIdOf } from '../regions';

/** True while the shuttle still hovers beside the crew member's grid, within float range of a hull tile (checked at the start of a refill and again at the swap). */
export function shuttleBeside(sim: Sim, crew: number, vehicle: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  const v = sim.world.get(vehicle, VehicleC);
  return !!pos && !!v && !!sim.world.get(vehicle, BodyC) && !!hatchSpot(sim, vehicle) && v.hover === shipIdOf(sim, pos);
}

/**
 * Start the drift of a refill at a hovering shuttle: out to the hatch and back to the tile the crew member stands on, the tank swapped at
 * the turn (`evaFloatSystem`). False (nothing happens) when the shuttle is gone, no longer hovers beside this grid or is out of float range.
 */
export function startRefillFloat(sim: Sim, crew: number, vehicle: number): boolean {
  if (sim.world.has(crew, EvaFloatC) || !shuttleBeside(sim, crew, vehicle)) return false;
  const pos = sim.world.get(crew, PositionC)!;
  const body = sim.world.get(vehicle, BodyC)!;
  const v = sim.world.get(vehicle, VehicleC)!;
  const at = tileCentre(sim, v.hover as number, pos.x, pos.y);
  if (!at) return false;
  const face = hatchFace(body, at);
  const one = floatTicks(sim, Math.hypot(at.x - face.x, at.y - face.y));
  sim.world.add(crew, EvaFloatC, { mode: 'refill', vehicle, sx: face.x, sy: face.y, ticks: 2 * one, total: 2 * one });
  return true;
}
