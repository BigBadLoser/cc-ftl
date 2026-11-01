import { findPath, type PathGoal, type PathOpts, type Tile } from '../crew/pathfind';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { isWalkable } from '../structure';
import { EVA_THIN_AIR_BELOW } from '../tuning';
import { hasSuitAir, isSuited, needsAir } from './suit';
import { shipGrid } from '../regions';

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
export function planWalk(sim: Sim, crew: number, shipId: number, from: Tile, goal: PathGoal, thinOk: () => boolean = () => true): WalkPlan | null {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return null;
  const suited = hasSuitAir(sim, crew);
  if (suited || !needsAir(sim, crew) || !gridHasThinAir(sim, grid)) {
    const steps = findPath(sim, shipId, from, goal, { suited: isSuited(sim, crew) });
    return steps && { steps, thin: false };
  }
  const clean = findPath(sim, shipId, from, goal, { avoidThin: true });
  if (clean) return { steps: clean, thin: false };
  if (!thinOk()) return null; // the caller would drop a thin plan anyway: skip the search for it
  const steps = findPath(sim, shipId, from, goal);
  return steps && { steps, thin: true };
}

/**
 * `planWalk` for a work site: a site only the hull ring reaches (building out on the hull, the shipyard's tiles) is still on offer to a crew member
 * who breathes, as an EVA job: the plan is `thin`, so the caller sends them for a suit first. Sites inside the ship are planned as before.
 * `thinOk` is asked before any search for a thin plan; a caller that has no use for one (no suit to be had) answers false and gets null for those.
 */
export function planSiteWalk(sim: Sim, crew: number, shipId: number, from: Tile, goal: PathGoal, thinOk: () => boolean = () => true): WalkPlan | null {
  for (const m of siteWalkModes(sim, crew, shipId)) {
    if (m.thin && !thinOk()) return null;
    const steps = findPath(sim, shipId, from, goal, m.opts);
    if (steps) return { steps, thin: m.thin };
  }
  return null;
}

/** One search of `planSiteWalk`: the walker conditions, and whether a plan found with them is `thin` (the walker needs a suit first). */
export interface WalkMode {
  opts: PathOpts;
  thin: boolean;
}

/**
 * The searches `planSiteWalk` tries for this crew member on this ship, in order; the first that finds a path wins. Suited crew (with air) and
 * airless bodies: one search, anywhere they can walk. A grid with no thin air: the plain search, then (thin) suited across the hull. Otherwise:
 * keep out of thin air, then (thin) through it, then (thin) suited across the hull. The scheduler reads the same order (ai/scheduler.ts).
 */
export function siteWalkModes(sim: Sim, crew: number, shipId: number): WalkMode[] {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return [];
  if (hasSuitAir(sim, crew) || !needsAir(sim, crew)) return [{ opts: { suited: isSuited(sim, crew) }, thin: false }];
  if (!gridHasThinAir(sim, grid)) return [{ opts: { suited: isSuited(sim, crew) }, thin: false }, { opts: { suited: true }, thin: true }];
  return [{ opts: { avoidThin: true }, thin: false }, { opts: {}, thin: true }, { opts: { suited: true }, thin: true }];
}
