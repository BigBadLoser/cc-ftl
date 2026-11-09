import { findPath, type PathGoal, type PathOpts, type Tile } from '../crew/pathfind';
import { snapshot, thinMask, type ThinMask } from '../gridSnapshot';
import type { ShipGrid } from '../shipGrid';
import type { Sim } from '../sim';
import { isWalkable } from '../structure';
import { isSuited, needsAir, walksOutside } from './suit';
import { shipGrid } from '../regions';

/** A walk on one grid. `thin`: it crosses thin air and the walker has no suit for it. */
export interface WalkPlan {
  steps: Tile[];
  thin: boolean;
}

const thinMemo = new WeakMap<ThinMask, { struct: Float64Array; thin: boolean }>();

/** True if any walkable tile of the grid has thin air. Memoised on the grid's thin-air mask and struct copy (derived data, never saved). */
function gridHasThinAir(grid: ShipGrid): boolean {
  if (!grid.has('o2')) return false;
  const mask = thinMask(grid);
  const struct = snapshot(grid, 'struct');
  const hit = thinMemo.get(mask);
  if (hit && hit.struct === struct) return hit.thin;
  let thin = false;
  for (let i = 0; i < mask.thin.length; i++) {
    if (mask.thin[i] && isWalkable(struct[i] as number)) {
      thin = true;
      break;
    }
  }
  thinMemo.set(mask, { struct, thin });
  return thin;
}

/**
 * The walk mode for a crew member's own errands (a bed, a meal, a break, a robot bay): the exterior counts for those who walk outside
 * (suited, or needing no air), as in `planWalk`. One helper, so the need machines cannot drift from it (Codex 4449530807).
 */
export function walkOpts(sim: Sim, crew: number): PathOpts {
  return { suited: walksOutside(sim, crew) };
}

/**
 * Plan a walk on one grid for a particular crew member. Suited crew (whatever is left in the tank: an empty suit still walks) and bodies that need no air walk
 * anywhere. Everyone else first looks for a path that keeps out of thin air (the prefer-no-EVA rule); if only a thin-air
 * path exists they get it with `thin` set, so the caller can send them for a suit or let a player's order stand.
 */
export function planWalk(sim: Sim, crew: number, shipId: number, from: Tile, goal: PathGoal, thinOk: () => boolean = () => true): WalkPlan | null {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return null;
  if (isSuited(sim, crew) || !needsAir(sim, crew) || !gridHasThinAir(grid)) {
    const steps = findPath(sim, shipId, from, goal, { suited: walksOutside(sim, crew) });
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
  if (isSuited(sim, crew) || !needsAir(sim, crew)) return [{ opts: { suited: walksOutside(sim, crew) }, thin: false }];
  if (!gridHasThinAir(grid)) return [{ opts: { suited: isSuited(sim, crew) }, thin: false }, { opts: { suited: true }, thin: true }];
  return [{ opts: { avoidThin: true }, thin: false }, { opts: {}, thin: true }, { opts: { suited: true }, thin: true }];
}
