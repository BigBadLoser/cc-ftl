import { JobC, PathC, type Crew, type Job, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath, type Tile } from '../../crew/pathfind';
import { isSuited } from '../../eva/suit';
import { isTileWalkable } from '../../modules/walk';
import { shipGrid, shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { traitMult } from '../../crew/traits';
import { StationC, StationCrewC } from '../../stations/components';
import { TaskC } from '../components';
import type { Task } from '../types';
import { clearJoblessTask, derivable, setJoblessTask, syncTask } from '../task';
import { stowSuit } from './eva';

/**
 * Jobless walks (generic machine, no job: `Navigate`): with nothing to do a crew member stows a worn suit, steps off a site
 * being built, strolls to a court (station crew) or wanders a little within the room. The task exists while such a walk is
 * under way; an idle crew member standing still has none.
 */

/** Per-tick chance that an idle crew member wanders (about once per 10 s). */
const WANDER_CHANCE = 0.005;
const WANDER_RADIUS = 3;

/** The idle turn, after the scheduler found no job: stow the suit, vacate a site, stroll (station crew) or wander. */
export function idleTurn(sim: Sim, id: number, crew: Crew, pos: Position): void {
  let t = sim.world.get(id, TaskC);
  if (t && derivable(t)) {
    syncTask(sim, id, true); // a meal given up this turn (no food, no way there) ends its task
    t = sim.world.get(id, TaskC);
  }

  if (stowSuit(sim, id, pos)) return;
  if (isSettled(pos) && vacateSite(sim, id, pos)) return setJoblessTask(sim, id, 'idle', 'generic', 'Navigate');
  if (strollTurn(sim, id, pos)) return setJoblessTask(sim, id, 'leisure', 'generic', 'Navigate');
  wander(sim, id, pos, crew, t);
}

/** Occasionally stroll a few tiles within the current room. */
function wander(sim: Sim, id: number, pos: Position, crew: Crew, task: Task | undefined): void {
  const path = sim.world.get(id, PathC);
  if (!path || path.steps.length > 0 || !isSettled(pos)) return; // still walking: the walk's task goes on
  if (task) clearJoblessTask(sim, id);
  if (crew.activity !== 'idle') crew.activity = 'idle';
  if (!sim.rng.chance(WANDER_CHANCE * traitMult(sim, id, 'wanderMult'))) return; // Lazy wanders more
  const grid = shipGrid(sim, shipIdOf(sim, pos));
  if (!grid?.has('room')) return;
  const room = grid.get('room', pos.x, pos.y);
  if (room === 0) return;
  const tx = pos.x + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  const ty = pos.y + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  if ((tx === pos.x && ty === pos.y) || !grid.inBounds(tx, ty)) return;
  if (!isTileWalkable(sim, grid, tx, ty) || grid.get('room', tx, ty) !== room) return;
  const steps = findPath(sim, shipIdOf(sim, pos), { x: pos.x, y: pos.y }, { x: tx, y: ty });
  if (steps && steps.length <= 2 * WANDER_RADIUS) {
    path.steps = steps;
    setJoblessTask(sim, id, 'idle', 'generic', 'Navigate', { tile: { x: tx, y: ty } });
  } else clearPath(sim, id);
}

/** Per-tick chance an idle station crew member strolls to one of the station's courts (about once per 25 s). */
const STROLL_CHANCE = 0.002;

/** Idle station crew now and then stroll to a court (plaza, garden, mess). True if a walk was planned. */
function strollTurn(sim: Sim, id: number, pos: Position): boolean {
  const sc = sim.world.get(id, StationCrewC);
  const busy = (sim.world.get(id, PathC)?.steps.length ?? 0) > 0 || !isSettled(pos);
  if (!sc || busy || shipIdOf(sim, pos) !== sc.station || !sim.rng.chance(STROLL_CHANCE)) return false;
  const courts = sim.world.get(sc.station, StationC)?.courts ?? [];
  if (courts.length === 0) return false;
  const goal = courts[sim.rng.int(0, courts.length - 1)] as { x: number; y: number };
  const steps = findPath(sim, sc.station, origin(pos), goal);
  const path = sim.world.get(id, PathC);
  if (!steps || steps.length === 0 || !path) return false;
  path.steps = steps;
  return true;
}

/**
 * An idle crew member standing on a module site steps out to the nearest free tile beside it, so the finished module is
 * never held up by someone who is only standing there. True if a move was started.
 */
function vacateSite(sim: Sim, id: number, pos: Position): boolean {
  const here = origin(pos);
  const ship = shipIdOf(sim, pos);
  if (vacateTile(sim, id, here, ship)) return true;
  let site: Job | undefined;
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (j && j.kind === 'module' && j.size && here.x >= j.x && here.x < j.x + j.size[0] && here.y >= j.y && here.y < j.y + j.size[1] && shipIdOf(sim, j) === ship) {
      site = j;
      break;
    }
  }
  const grid = shipGrid(sim, ship);
  if (!site?.size || !grid) return false;
  const [w, h] = site.size;
  const ring: Tile[] = [];
  for (let y = site.y - 1; y <= site.y + h; y++) for (let x = site.x - 1; x <= site.x + w; x++) {
    const inside = x >= site.x && x < site.x + w && y >= site.y && y < site.y + h;
    if (!inside && grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y)) ring.push({ x, y });
  }
  let best: Tile[] | null = null;
  for (const t of ring) {
    const steps = findPath(sim, ship, here, t);
    if (steps && steps.length > 0 && (!best || steps.length < best.length)) best = steps;
  }
  if (!best) return false;
  (sim.world.get(id, PathC) as Path).steps = best;
  return true;
}

/**
 * An idle crew member standing on the tile of a floor or wall being built steps off it (the tile cannot be finished under their feet). Suited crew
 * on the hull ring may step to any tile they can stand on. True if a move was started.
 */
function vacateTile(sim: Sim, id: number, here: Tile, ship: number): boolean {
  // The common case first, with no list built: no build job on this tile.
  let underFoot = false;
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (j?.kind === 'build' && j.x === here.x && j.y === here.y && shipIdOf(sim, j) === ship) {
      underFoot = true;
      break;
    }
  }
  if (!underFoot) return false;
  const mine = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)).filter((j) => j?.kind === 'build' && shipIdOf(sim, j) === ship);
  const grid = shipGrid(sim, ship);
  if (!grid) return false;
  const suited = isSuited(sim, id);
  let best: Tile[] | null = null;
  let bestOpen = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = { x: here.x + dx, y: here.y + dy };
      if ((!dx && !dy) || !grid.inBounds(t.x, t.y)) continue;
      const steps = findPath(sim, ship, here, t, { suited });
      if (!steps || steps.length === 0) continue;
      const open = !mine.some((j) => j && j.x === t.x && j.y === t.y);
      if (!best || (open && !bestOpen) || (open === bestOpen && steps.length < best.length)) [best, bestOpen] = [steps, open];
    }
  }
  if (!best) return false;
  (sim.world.get(id, PathC) as Path).steps = best;
  return true;
}
