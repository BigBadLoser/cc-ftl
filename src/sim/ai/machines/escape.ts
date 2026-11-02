import { AssignmentC, PathC, type Path, type Position } from '../../crew/components';
import { exposure, tileHazards } from '../../crew/hazard';
import { isSettled, origin } from '../../crew/helpers';
import { findPath, type Tile } from '../../crew/pathfind';
import type { Grid } from '../../grid';
import { isTileWalkable } from '../../modules/walk';
import { shipGrid, shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { IntentC, TaskC } from '../components';
import { abortTask, setJoblessTask } from '../task';

/**
 * The escape machine (docs/CREW_AI.md section 5, the `hazard` interrupt): `Walk` to the nearest tile that is safe for the crew
 * member. It is a jobless task started and stepped under the interrupt, so the interrupt never freezes its own escape; once the
 * crew member stands on a safe tile the interrupt lapses and the task ends with it. With no safe tile in reach they stay put.
 */

/** Tiles searched for a safe one (breadth first) before giving up. */
const ESCAPE_SEARCH = 900;
/** Ticks a job left for a hazard is not given back to the same crew member (10 s). */
const HAZARD_AVOID_TICKS = 200;
/** Candidate safe tiles (nearest first) a path is tried to. */
const ESCAPE_TRIES = 4;

/**
 * Which tiles end an escape. Default: a walkable tile with no hazard for this crew member. #286 adds air sources here (on a
 * site with no breathable tile, escape means a refill), as another goal for the same search.
 */
export type EscapeGoal = (sim: Sim, id: number, grid: Grid, x: number, y: number) => boolean;

export const safeTile: EscapeGoal = (sim, id, grid, x, y) => {
  const { suited, airless } = exposure(sim, id);
  return isTileWalkable(sim, grid, x, y, suited) && tileHazards(grid, x, y, suited, airless) === 0;
};

/** The nearest goal tiles, breadth first over walkable tiles (4-neighbour, fixed order, so the result is deterministic). */
function nearestGoals(sim: Sim, id: number, grid: Grid, from: Tile, goal: EscapeGoal, suited: boolean): Tile[] {
  const out: Tile[] = [];
  const seen = new Set<number>([from.y * grid.width + from.x]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length && i < ESCAPE_SEARCH && out.length < ESCAPE_TRIES; i++) {
    const t = queue[i] as Tile;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = t.x + dx, y = t.y + dy, k = y * grid.width + x;
      if (!grid.inBounds(x, y) || seen.has(k) || !isTileWalkable(sim, grid, x, y, suited)) continue;
      seen.add(k);
      queue.push({ x, y });
      if (goal(sim, id, grid, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/**
 * The escape's turn: keep walking, or plan the walk to the nearest goal tile. The walk is planned before anything is dropped:
 * only once a way out is found does the task under way end (`abortTask('hazard')`). False when there is nowhere to go (the
 * crew member carries on as they were). `drafted`: step off without a task (the draft stays theirs).
 */
export function escapeTurn(sim: Sim, id: number, pos: Position, drafted = false, goal: EscapeGoal = safeTile): boolean {
  const path = sim.world.get(id, PathC) as Path;
  const task = sim.world.get(id, TaskC);
  if (task?.machine === 'escape' && (path.steps.length > 0 || !isSettled(pos))) return true;
  const ship = shipIdOf(sim, pos);
  const grid = shipGrid(sim, ship);
  if (!grid) return false;
  const from = origin(pos);
  for (const t of nearestGoals(sim, id, grid, from, goal, exposure(sim, id).suited)) {
    const steps = findPath(sim, ship, from, t, { suited: exposure(sim, id).suited });
    if (!steps || steps.length === 0) continue;
    if (task?.machine !== 'escape' && !drafted) {
      const job = sim.world.get(id, AssignmentC)?.jobId;
      const intent = sim.world.get(id, IntentC);
      if (job && intent) intent.avoid = { job, until: sim.tick + HAZARD_AVOID_TICKS };
      abortTask(sim, id, 'hazard');
    }
    path.steps = steps;
    if (!drafted) setJoblessTask(sim, id, 'idle', 'escape', 'Walk', { tile: t });
    return true;
  }
  return false;
}
