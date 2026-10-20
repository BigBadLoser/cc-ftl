import { findPath, type PathGoal, type Tile } from '../crew/pathfind';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isWalkable } from '../structure';
import { EVA_THIN_AIR_BELOW } from '../tuning';
import { hasSuitAir, isSuited, needsAir } from './suit';

/** A walk on one grid. `thin`: it crosses thin air and the walker has no suit for it. */
export interface WalkPlan {
  steps: Tile[];
  thin: boolean;
}

const thinMemo = new WeakMap<Grid, { tick: number; thin: boolean }>();

/** True if any walkable tile of the grid has thin air. Memoised per tick (derived data, never saved). */
function gridHasThinAir(sim: Sim, grid: Grid): boolean {
  const hit = thinMemo.get(grid);
  if (hit && hit.tick === sim.tick) return hit.thin;
  let thin = false;
  if (grid.has('o2')) {
    const o2 = grid.load('o2');
    const struct = grid.load('struct');
    for (let i = 0; i < o2.length; i++) {
      if ((o2[i] as number) < EVA_THIN_AIR_BELOW && isWalkable(struct[i] as number)) {
        thin = true;
        break;
      }
    }
  }
  thinMemo.set(grid, { tick: sim.tick, thin });
  return thin;
}

/**
 * Plan a walk on one grid for a particular crew member. Suited crew (with air) and bodies that need no air walk
 * anywhere. Everyone else first looks for a path that keeps out of thin air (the prefer-no-EVA rule); if only a thin-air
 * path exists they get it with `thin` set, so the caller can send them for a suit or let a player's order stand.
 */
export function planWalk(sim: Sim, crew: number, gridId: number, from: Tile, goal: PathGoal): WalkPlan | null {
  const grid = sim.grids.get(gridId);
  if (!grid?.has('struct')) return null;
  const suited = hasSuitAir(sim, crew);
  if (suited || !needsAir(sim, crew) || !gridHasThinAir(sim, grid)) {
    const steps = findPath(sim, gridId, from, goal, { suited: isSuited(sim, crew) });
    return steps && { steps, thin: false };
  }
  const clean = findPath(sim, gridId, from, goal, { avoidThin: true });
  if (clean) return { steps: clean, thin: false };
  const steps = findPath(sim, gridId, from, goal);
  return steps && { steps, thin: true };
}
