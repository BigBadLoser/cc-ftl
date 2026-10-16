import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { BedClaimC } from './components';
import { findPath, type Tile } from './pathfind';

/** A reachable free bed and the steps to it. */
export interface BedPlan {
  bed: number;
  steps: Tile[];
}

/**
 * The nearest unreserved, intact bed module on a grid (fewest steps, then lowest id). With
 * `adjacent`, the path ends next to the bed (for carriers) instead of on it.
 */
export function findFreeBed(sim: Sim, gridId: number, from: Tile, adjacent = false): BedPlan | null {
  let best: BedPlan | null = null;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || m.gridId !== gridId || m.reservedBy !== 0 || m.hp <= 0) continue;
    if (!sim.content.modules[m.def]?.bed) continue;
    const steps = findPath(sim, gridId, from, { x: m.x, y: m.y, adjacent });
    if (steps && (!best || steps.length < best.steps.length)) best = { bed: id, steps };
  }
  return best;
}

/** Free a bed reserved by `crew` (no-op if it is not theirs). */
export function releaseBed(sim: Sim, bed: number, crew: number): void {
  const m = sim.world.get(bed, ModuleC);
  if (m && m.reservedBy === crew) m.reservedBy = 0;
}

/** Drop a crew member's sleeping-bed claim and free the bed. */
export function releaseBedClaim(sim: Sim, crew: number): void {
  const claim = sim.world.get(crew, BedClaimC);
  if (!claim) return;
  releaseBed(sim, claim.bed, crew);
  sim.world.remove(crew, BedClaimC);
}
