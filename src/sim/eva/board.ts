import { abortTask } from '../ai/task';
import { BodyC } from '../body';
import { DraftedC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { EmbarkOrderC, VehicleC } from '../vehicles/components';
import { EvaFloatC } from './components';
import { hatchFace } from './hatch';
import { planWalk } from './route';
import { floatTicks, hatchSpot, tileCentre } from './shuttle';
import { suitDef } from './suit';

/**
 * Boarding a hovering shuttle from the hull of the grid it holds station beside (`eva.board`): a drafted, suited crew member within float range
 * drifts to its hatch and comes aboard (`EvaFloat` back). One farther off walks to its hatch spot first, as a walk to a stowed shuttle's ramp
 * does (`EmbarkOrderC`: the vehicle system starts the drift on arrival). Returns a reject reason, or null.
 */
export function boardHovering(sim: Sim, crew: number, vehicle: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  const body = sim.world.get(vehicle, BodyC);
  const pos = sim.world.get(crew, PositionC);
  const drafted = sim.world.get(crew, DraftedC);
  if (!v || !body || !pos || !drafted) return 'noVehicle';
  const at = tileCentre(sim, shipIdOf(sim, pos), pos.x, pos.y);
  if (!at) return 'outOfRange';
  const near = Math.hypot(body.x - at.x, body.y - at.y) <= suitDef(sim).floatRange;
  const spot = near ? null : hatchSpot(sim, vehicle);
  if (!near && (!spot || spot.shipId !== shipIdOf(sim, pos) || !planWalk(sim, crew, spot.shipId, origin(pos), { x: spot.x, y: spot.y }))) return 'outOfRange';
  abortTask(sim, crew, 'order');
  delete drafted.planned;
  sim.world.remove(crew, EmbarkOrderC);
  if (spot) {
    drafted.target = { x: spot.x, y: spot.y };
    sim.world.add(crew, EmbarkOrderC, { vehicle });
    return null;
  }
  drafted.target = null;
  const face = hatchFace(body, at);
  const ticks = floatTicks(sim, Math.hypot(at.x - face.x, at.y - face.y));
  sim.world.add(crew, EvaFloatC, { mode: 'back', vehicle, sx: face.x, sy: face.y, ticks, total: ticks });
  return null;
}
