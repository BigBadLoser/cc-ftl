import { BodyC } from '../../body';
import { DraftedC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { isSettled, origin } from '../../crew/helpers';
import { AwayC } from '../../away/components';
import { siteSpot, siteUnderFoot } from '../../away/crew';
import { EvaFloatC, SuitC } from '../../eva/components';
import { hatchFace } from '../../eva/hatch';
import { planWalk } from '../../eva/route';
import { floatTicks, seatsTaken, tileCentre } from '../../eva/shuttle';
import { suitDef, walksOutside } from '../../eva/suit';
import { dropCarried } from '../../items/stacks';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { AWAY_WAIT_TILES } from '../../tuning';
import { VehicleC } from '../../vehicles/components';
import { boardCrew, vehicleDefOf } from '../../vehicles/lifecycle';
import { TaskC } from '../components';
import { abortTask, setJoblessTask } from '../task';

/**
 * The return machine (docs/DESIGN.md "Going home, one at a time", #286 slice 2a): an away crew member the return drive wants home walks to
 * the hatch spot of their site's shuttle (`Walk`) and floats aboard (`Board`, an `EvaFloat` back to the hatch; they are held out of the loop
 * while it runs and board when it ends). Aboard they wait for the next trip home. False (the drive falls through) while the shuttle is not
 * beside the site, is full, or cannot be walked to.
 */

/** Where the crew member's site shuttle takes them aboard on the grid they stand on (hatch spot or docked airlock). */
function spotFor(sim: Sim, id: number, pos: Position): { vehicle: number; x: number; y: number; docked: boolean } | null {
  const away = sim.world.get(id, AwayC);
  const spot = away && siteSpot(sim, away.vehicle, shipIdOf(sim, pos));
  return away && spot ? { vehicle: away.vehicle, ...spot } : null;
}

export function returnTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): boolean {
  if (!siteUnderFoot(sim, id)) return false;
  if (sim.world.has(id, EvaFloatC)) return true;
  const spot = spotFor(sim, id, pos);
  const v = spot && sim.world.get(spot.vehicle, VehicleC);
  if (!spot || !v || (!spot.docked && !walksOutside(sim, id)) || seatsTaken(sim, spot.vehicle, v) >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return false;
  const path = sim.world.get(id, PathC) as Path;
  if (isSettled(pos) && pos.x === spot.x && pos.y === spot.y) return spot.docked ? stepAboard(sim, id, spot.vehicle) : floatAboard(sim, id, crew, spot.vehicle, pos);
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
  sim.world.add(id, DraftedC, { target: null, away: true });
  crew.activity = 'drafted';
  cameAboard(sim, id);
  return true;
}

/** Aboard (or on the way in): they wait for the trip home, or a rider for the trip out again. A pickup is answered. */
function cameAboard(sim: Sim, id: number): void {
  const away = sim.world.get(id, AwayC);
  if (!away) return;
  if (!away.ride) away.home = true; // a pickup and a last call end with coming aboard (away/owned.ts)
}

/** Step in at the airlock the shuttle is docked at: the suit goes into its stock. */
function stepAboard(sim: Sim, id: number, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return false;
  abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  sim.world.remove(id, SuitC); // stowed aboard
  boardCrew(sim, id, vehicle);
  cameAboard(sim, id);
  return true;
}

/**
 * An idle away crew member waits by the shuttle instead of wandering off or stowing the suit (#286): farther than AWAY_WAIT_TILES from the
 * hatch spot they walk back to it. True while this keeps them (on the site, suited), so the idle turn does nothing else.
 */
export function waitBySite(sim: Sim, id: number, pos: Position): boolean {
  if (!siteUnderFoot(sim, id) || (!walksOutside(sim, id) && !sim.world.get(sim.world.get(id, AwayC)?.vehicle ?? 0, VehicleC)?.dock)) return false;
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
