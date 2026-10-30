import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { BedClaimC, BedOwnerC } from './components';
import { findPath, type Tile } from './pathfind';
import { shipIdOf } from '../regions';

/** A reachable free bed and the steps to it. */
export interface BedPlan {
  bed: number;
  steps: Tile[];
}

/** True if module `id` is an intact bed on ship `shipId`. */
export function isIntactBed(sim: Sim, id: number, shipId: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.bed && shipIdOf(sim, m) === shipId;
}

/**
 * The nearest unreserved, intact bed module on a grid (fewest steps, then lowest id). With
 * `adjacent`, the path ends next to the bed (for carriers) instead of on it.
 *
 * Candidates are tried in order of a lower bound on their path length (Chebyshev distance: a step moves one tile at most; one
 * less when ending beside the bed) and the search stops once the best path found beats every remaining bound, so the answer
 * is the exhaustive one (a candidate whose bound ties the best only wins with a lower id).
 */
export function findFreeBed(sim: Sim, shipId: number, from: Tile, adjacent = false): BedPlan | null {
  const cands: { id: number; lb: number }[] = [];
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || m.reservedBy !== 0 || m.hp <= 0 || !sim.content.modules[m.def]?.bed || shipIdOf(sim, m) !== shipId) continue;
    const cheb = Math.max(Math.abs(m.x - from.x), Math.abs(m.y - from.y));
    cands.push({ id, lb: adjacent ? Math.max(0, cheb - 1) : cheb });
  }
  cands.sort((a, b) => a.lb - b.lb || a.id - b.id);
  let best: BedPlan | null = null;
  for (const c of cands) {
    if (best) {
      if (c.lb > best.steps.length) break;
      if (c.lb === best.steps.length && c.id > best.bed) continue;
    }
    const m = sim.world.get(c.id, ModuleC) as { x: number; y: number };
    const steps = findPath(sim, shipId, from, { x: m.x, y: m.y, adjacent });
    if (steps && (!best || steps.length < best.steps.length || (steps.length === best.steps.length && c.id < best.bed))) best = { bed: c.id, steps };
  }
  return best;
}

/** Claim a bed for one sleep: the bed is reserved to the sleeper, who holds it until they wake or are pulled away. */
export function claimBed(sim: Sim, crew: number, bed: number): void {
  (sim.world.get(bed, ModuleC) as { reservedBy: number }).reservedBy = crew;
  sim.world.add(crew, BedClaimC, { bed });
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

/** Drop a crew member's owned bed (the next bed-owner pass may give them another). */
export function releaseBedOwner(sim: Sim, crew: number): void {
  sim.world.remove(crew, BedOwnerC);
}

/** A bed module is gone: whoever owned it owns nothing. */
export function clearBedOwners(sim: Sim, bed: number): void {
  for (const id of sim.world.query(BedOwnerC)) if (sim.world.get(id, BedOwnerC)?.bed === bed) sim.world.remove(id, BedOwnerC);
}

/**
 * The path to the bed this crew member owns, or null when they own none or it is unusable (gone, wrecked, on another ship,
 * reserved by someone else, unreachable). An owner whose bed is gone or elsewhere is dropped.
 */
export function ownedBedPlan(sim: Sim, crew: number, shipId: number, from: Tile): BedPlan | null {
  const owner = sim.world.get(crew, BedOwnerC);
  if (!owner) return null;
  if (!isIntactBed(sim, owner.bed, shipId)) {
    releaseBedOwner(sim, crew);
    return null;
  }
  const m = sim.world.get(owner.bed, ModuleC) as { x: number; y: number; reservedBy: number };
  if (m.reservedBy !== 0) return null;
  const steps = findPath(sim, shipId, from, { x: m.x, y: m.y });
  return steps ? { bed: owner.bed, steps } : null;
}
