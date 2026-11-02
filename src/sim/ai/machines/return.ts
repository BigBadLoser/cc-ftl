import { BodyC } from '../../body';
import { DraftedC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { isSettled, origin } from '../../crew/helpers';
import { AwayC } from '../../away/components';
import { siteUnderFoot } from '../../away/crew';
import { EvaFloatC } from '../../eva/components';
import { hatchFace } from '../../eva/hatch';
import { planWalk } from '../../eva/route';
import { floatTicks, hatchSpot, tileCentre } from '../../eva/shuttle';
import { isSuited, suitDef } from '../../eva/suit';
import { dropCarried } from '../../items/stacks';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { AWAY_WAIT_TILES } from '../../tuning';
import { VehicleC } from '../../vehicles/components';
import { occupants, vehicleDefOf } from '../../vehicles/lifecycle';
import { TaskC } from '../components';
import { abortTask, setJoblessTask } from '../task';

/**
 * The return machine (docs/DESIGN.md "Going home, one at a time", #286 slice 2a): an away crew member the return drive wants home walks to
 * the hatch spot of their site's shuttle (`Walk`) and floats aboard (`Board`, an `EvaFloat` back to the hatch; they are held out of the loop
 * while it runs and board when it ends). Aboard they wait for the next trip home. False (the drive falls through) while the shuttle is not
 * beside the site, is full, or cannot be walked to.
 */

/** The hatch spot of the crew member's site shuttle when it hovers beside the grid they stand on. */
function spotFor(sim: Sim, id: number, pos: Position): { vehicle: number; x: number; y: number } | null {
  const away = sim.world.get(id, AwayC);
  const spot = away && hatchSpot(sim, away.vehicle);
  return away && spot && spot.shipId === shipIdOf(sim, pos) ? { vehicle: away.vehicle, x: spot.x, y: spot.y } : null;
}

export function returnTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): boolean {
  if (!siteUnderFoot(sim, id) || !isSuited(sim, id)) return false;
  if (sim.world.has(id, EvaFloatC)) return true;
  const spot = spotFor(sim, id, pos);
  const v = spot && sim.world.get(spot.vehicle, VehicleC);
  if (!spot || !v || occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return false;
  const path = sim.world.get(id, PathC) as Path;
  if (isSettled(pos) && pos.x === spot.x && pos.y === spot.y) return floatAboard(sim, id, crew, spot.vehicle, pos);
  const t = sim.world.get(id, TaskC);
  if (t?.machine === 'return' && (path.steps.length > 0 || !isSettled(pos))) return true; // on the way
  const plan = planWalk(sim, id, shipIdOf(sim, pos), origin(pos), { x: spot.x, y: spot.y });
  if (!plan) return false;
  if (holdsJob || t) abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  path.steps = plan.steps;
  setJoblessTask(sim, id, 'return', 'return', 'Walk');
  return true;
}

/** Start the drift to the hatch (as `eva.board` does). Held (drafted, no order) until aboard. */
function floatAboard(sim: Sim, id: number, crew: Crew, vehicle: number, pos: Position): boolean {
  const body = sim.world.get(vehicle, BodyC);
  const at = tileCentre(sim, shipIdOf(sim, pos), pos.x, pos.y);
  if (!body || !at || Math.hypot(body.x - at.x, body.y - at.y) > suitDef(sim).floatRange) return false;
  abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  const face = hatchFace(body, at);
  const ticks = floatTicks(sim, Math.hypot(at.x - face.x, at.y - face.y));
  sim.world.add(id, EvaFloatC, { mode: 'back', vehicle, sx: face.x, sy: face.y, ticks, total: ticks });
  sim.world.add(id, DraftedC, { target: null });
  crew.activity = 'drafted';
  const away = sim.world.get(id, AwayC);
  if (away) away.home = true;
  return true;
}

/**
 * An idle away crew member waits by the shuttle instead of wandering off or stowing the suit (#286): farther than AWAY_WAIT_TILES from the
 * hatch spot they walk back to it. True while this keeps them (on the site, suited), so the idle turn does nothing else.
 */
export function waitBySite(sim: Sim, id: number, pos: Position): boolean {
  if (!siteUnderFoot(sim, id) || !isSuited(sim, id)) return false;
  const path = sim.world.get(id, PathC) as Path;
  if (path.steps.length > 0 || !isSettled(pos)) return true;
  const spot = spotFor(sim, id, pos);
  if (spot && Math.max(Math.abs(spot.x - pos.x), Math.abs(spot.y - pos.y)) > AWAY_WAIT_TILES && (sim.tick + id) % 20 === 0) {
    const plan = planWalk(sim, id, shipIdOf(sim, pos), origin(pos), { x: spot.x, y: spot.y });
    if (plan) {
      path.steps = plan.steps;
      setJoblessTask(sim, id, 'idle', 'generic', 'Navigate', { tile: { x: spot.x, y: spot.y } });
    }
  }
  return true;
}
