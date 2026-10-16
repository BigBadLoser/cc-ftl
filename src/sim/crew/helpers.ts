import type { Sim } from '../sim';
import {
  AssignmentC, CarriedC, CrewC, DeadC, DownedC, JobC, PathC, PositionC, type Position,
} from './components';
import type { Tile } from './pathfind';

// Facing index per unit step: 0 = +x, counter-clockwise in grid space, 2 = +y.
const FACING_TABLE: Record<string, number> = {
  '1,0': 0, '1,1': 1, '0,1': 2, '-1,1': 3, '-1,0': 4, '-1,-1': 5, '0,-1': 6, '1,-1': 7,
};

/** Facing index (0..7) for a unit step, or `fallback` for no movement. */
export function facingOf(dx: number, dy: number, fallback = 0): number {
  return FACING_TABLE[`${Math.sign(dx)},${Math.sign(dy)}`] ?? fallback;
}

/** The tile an entity occupies for planning: the end of its current step. */
export function origin(p: Position): Tile {
  return { x: p.toX, y: p.toY };
}

/** True when standing still on a tile (not between two). */
export function isSettled(p: Position): boolean {
  return p.toX === p.x && p.toY === p.y;
}

/** True when two tiles are 8-neighbours. */
export function isAdjacent(a: Tile, b: Tile): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}

/** Forget the remaining path (an in-progress step still completes). */
export function clearPath(sim: Sim, crew: number): void {
  const path = sim.world.get(crew, PathC);
  if (path && path.steps.length > 0) path.steps = [];
}

/** Drop a crew member's job: free the reservation, remove the Assignment, clear the path. */
export function releaseAssignment(sim: Sim, crew: number): void {
  const a = sim.world.get(crew, AssignmentC);
  if (a) {
    const job = sim.world.get(a.jobId, JobC);
    if (job && job.reservedBy === crew) job.reservedBy = 0;
    sim.world.remove(crew, AssignmentC);
  }
  clearPath(sim, crew);
}

/** True if the crew member cannot act: downed, dead or being carried. */
export function isIncapacitated(sim: Sim, crew: number): boolean {
  return sim.world.has(crew, DownedC) || sim.world.has(crew, DeadC) || sim.world.has(crew, CarriedC);
}

/** True if any living crew member stands on, or is stepping onto, the tile. */
export function isTileOccupied(sim: Sim, gridId: number, x: number, y: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const p = sim.world.get(id, PositionC) as Position;
    if (p.gridId !== gridId) continue;
    if ((p.x === x && p.y === y) || (p.toX === x && p.toY === y)) return true;
  }
  return false;
}

const PLAYER_JOB_KINDS: readonly string[] = ['build', 'deconstruct', 'module', 'moduleDecon'];

/** The player-made job (build, deconstruct, module blueprint) at a tile, or 0. */
export function findJobAt(sim: Sim, gridId: number, x: number, y: number): number {
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j && j.gridId === gridId && j.x === x && j.y === y && PLAYER_JOB_KINDS.includes(j.kind)) return id;
  }
  return 0;
}
