import type { Job, Position } from '../crew/components';
import { origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { ModuleC } from '../modules/components';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import { planWalk } from './route';
import { airlockUsable, freeSuits, isThin, suitTile } from './suit';
import { shipIdOf, shipGrid } from '../regions';

/** An airlock to fit or stow a suit at, with the walk to its suit tile. */
export interface SuitSource {
  airlock: number;
  steps: Tile[];
}

/** True for the personal errands the sim makes for a crew member (nobody else may pick them up). */
export function isErrand(job: Job): boolean {
  return job.kind === 'suitUp' || job.kind === 'suitOff';
}

function onGrid(sim: Sim, airlock: number, shipId: number): boolean {
  return shipIdOf(sim, sim.world.get(airlock, ModuleC)) === shipId;
}

/**
 * The best airlock on the crew member's grid to get a suit from: one with a free suit and a walk to its suit tile that
 * keeps out of thin air. Shortest walk wins, then the lowest module id. Null when there is none.
 */
export function findSuitSource(sim: Sim, crew: number, pos: Position): SuitSource | null {
  let best: SuitSource | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!at || !airlockUsable(sim, id) || freeSuits(sim, id) <= 0 || !onGrid(sim, id, shipIdOf(sim, pos))) continue;
    const plan = planWalk(sim, crew, shipIdOf(sim, pos), origin(pos), at);
    if (!plan || plan.thin) continue;
    if (!best || plan.steps.length < best.steps.length) best = { airlock: id, steps: plan.steps };
  }
  return best;
}

/** The nearest airlock on the grid whose suit tile has breathable air, to take the suit off at. */
export function findSuitStow(sim: Sim, crew: number, pos: Position): SuitSource | null {
  const grid = shipGrid(sim, shipIdOf(sim, pos));
  let best: SuitSource | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!grid || !at || !airlockUsable(sim, id) || !onGrid(sim, id, shipIdOf(sim, pos)) || isThin(grid, at.x, at.y)) continue;
    const plan = planWalk(sim, crew, shipIdOf(sim, pos), origin(pos), at);
    if (plan && (!best || plan.steps.length < best.steps.length)) best = { airlock: id, steps: plan.steps };
  }
  return best;
}
