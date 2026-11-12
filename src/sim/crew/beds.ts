import { ModuleC, type Module } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { BedOwnerC } from './components';
import { findPath, type Tile } from './pathfind';
import { shipIdOf } from '../regions';

/** A bed tile a planner must not use (a hazard there for this sleeper). */
export type BedSkip = (x: number, y: number) => boolean;

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

/** Which kind of bed a module is: a recovery pod, a medical bed (patients only) or an ordinary bed. */
export type BedKind = 'recovery' | 'medical' | 'ordinary';
export const bedKind = (def: ModuleDef): BedKind => (def.recovery ? 'recovery' : def.medical ? 'medical' : 'ordinary');

/**
 * The tile crew stand on to use a bed: its own tile, or for a recovery pod (a solid tank) its access tile. Carriers and walkers aim at this one
 * (searchBeds, the rescue job); the patient themselves lie inside the pod (crew/recovery.ts).
 */
export function bedStandTile(def: ModuleDef, m: Module): Tile {
  return (def.recovery ? accessTile(def, m.x, m.y, m.rot) : null) ?? { x: m.x, y: m.y };
}

/** A bed the planners may pick now: intact, free and (a pod) powered. The one answer to "can a patient be sent to this bed". */
export function bedUsable(def: ModuleDef | undefined, m: Module): boolean {
  return !!def?.bed && m.reservedBy === 0 && m.hp > 0 && (!def.recovery || (m.powered && m.enabled));
}

/**
 * The nearest unreserved, intact bed module on a grid (fewest steps, then lowest id). With
 * `adjacent`, the path ends next to the bed (for carriers) instead of on it.
 *
 * Candidates are tried in order of a lower bound on their path length (Chebyshev distance: a step moves one tile at most; one
 * less when ending beside the bed) and the search stops once the best path found beats every remaining bound, so the answer
 * is the exhaustive one (a candidate whose bound ties the best only wins with a lower id).
 */
export function findFreeBed(sim: Sim, shipId: number, from: Tile, adjacent = false, skip?: BedSkip, patient = false): BedPlan | null {
  // Patients prefer a recovery pod (it heals to full with no medic), then a medical bed, then an ordinary bed. Sleepers use ordinary beds only.
  if (patient) return searchBeds(sim, shipId, from, adjacent, skip, 'recovery') ?? searchBeds(sim, shipId, from, adjacent, skip, 'medical') ?? searchBeds(sim, shipId, from, adjacent, skip, 'ordinary');
  return searchBeds(sim, shipId, from, adjacent, skip, 'ordinary');
}

/** The nearest free recovery pod, for a hurt crew member who can still walk (the recover drive, ai/machines/sleep.ts). */
export function findFreePod(sim: Sim, shipId: number, from: Tile, skip?: BedSkip): BedPlan | null {
  return searchBeds(sim, shipId, from, false, skip, 'recovery');
}

/** Only beds of `kind`. */
function searchBeds(sim: Sim, shipId: number, from: Tile, adjacent: boolean, skip: BedSkip | undefined, kind: BedKind): BedPlan | null {
  const cands: { id: number; lb: number }[] = [];
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !bedUsable(def, m) || bedKind(def) !== kind || shipIdOf(sim, m) !== shipId) continue;
    const at = bedStandTile(def, m);
    if (skip?.(at.x, at.y)) continue;
    const cheb = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    cands.push({ id, lb: adjacent ? Math.max(0, cheb - 1) : cheb });
  }
  cands.sort((a, b) => a.lb - b.lb || a.id - b.id);
  let best: BedPlan | null = null;
  for (const c of cands) {
    if (best) {
      if (c.lb > best.steps.length) break;
      if (c.lb === best.steps.length && c.id > best.bed) continue;
    }
    const m = sim.world.get(c.id, ModuleC) as Module;
    const at = bedStandTile(sim.content.modules[m.def] as ModuleDef, m);
    const steps = findPath(sim, shipId, from, { x: at.x, y: at.y, adjacent });
    if (steps && (!best || steps.length < best.steps.length || (steps.length === best.steps.length && c.id < best.bed))) best = { bed: c.id, steps };
  }
  return best;
}

/** Free a bed reserved by `crew` (no-op if it is not theirs). */
export function releaseBed(sim: Sim, bed: number, crew: number): void {
  const m = sim.world.get(bed, ModuleC);
  if (m && m.reservedBy === crew) m.reservedBy = 0;
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
 * reserved by someone else, skipped, unreachable). An owner whose bed is gone or elsewhere is dropped.
 */
export function ownedBedPlan(sim: Sim, crew: number, shipId: number, from: Tile, skip?: BedSkip): BedPlan | null {
  const owner = sim.world.get(crew, BedOwnerC);
  if (!owner) return null;
  if (!isIntactBed(sim, owner.bed, shipId)) {
    releaseBedOwner(sim, crew);
    return null;
  }
  const m = sim.world.get(owner.bed, ModuleC) as { x: number; y: number; reservedBy: number };
  if (m.reservedBy !== 0 || skip?.(m.x, m.y)) return null;
  const steps = findPath(sim, shipId, from, { x: m.x, y: m.y });
  return steps ? { bed: owner.bed, steps } : null;
}
