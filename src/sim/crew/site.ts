import { AllegianceC } from '../fight/components';
import { isOffDuty } from '../fight/relations';
import { footprintBlockedByCrew } from '../modules/spawn';
import { missingMaterials } from '../items/materials';
import { reservations, sourcesOf } from '../items/stock';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { TICK_HZ } from '../time';
import { AssignmentC, CrewC, DeadC, DraftedC, JobC, PositionC, PrioritiesC, type Job } from './components';
import { isIncapacitated, jobGoal, origin } from './helpers';
import { findPath } from './pathfind';

/** Why a construction site is stuck (the first that applies). */
export type SiteBlock =
  | { kind: 'noBuilder' }
  | { kind: 'siteUnreachable' }
  /** `count` units of `item` exist nowhere in reach: the stock is short. */
  | { kind: 'noStock'; item: string; count: number }
  | { kind: 'stockUnreachable'; item: string }
  | { kind: 'crewInWay' };

export interface SiteMaterial {
  item: string;
  need: number;
  delivered: number;
  /** Units a crew member is carrying (or about to carry) to the site. */
  inTransit: number;
  missing: number;
}

export interface SiteStatus {
  id: number;
  ship: number;
  def: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ticks of work, and done so far. */
  work: number;
  progress: number;
  /** 0..1 */
  frac: number;
  materials: SiteMaterial[];
  /** Crew building it, and crew hauling its materials. */
  builders: number[];
  haulers: number[];
  /** Seconds of work left at the working (or likeliest) builder's speed, not counting hauling still to do; null with nobody able to build. */
  etaSec: number | null;
  block: SiteBlock | null;
}

/** The module blueprint jobs, by entity id. */
export function siteIds(sim: Sim): number[] {
  return [...sim.world.query(JobC)].filter((id) => sim.world.get(id, JobC)?.kind === 'module');
}

/** Crew able to build or haul for the player on a ship: living, undrafted, not busy fighting, with construction work enabled. */
function capableCrew(sim: Sim, ship: number): number[] {
  const out: number[] = [];
  for (const id of sim.world.query(CrewC, PositionC, PrioritiesC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || shipIdOf(sim, p) !== ship || sim.world.has(id, DeadC) || sim.world.has(id, DraftedC)) continue;
    if (sim.world.get(id, AllegianceC)?.faction !== 'player' || isIncapacitated(sim, id) || isOffDuty(sim, id)) continue;
    if ((sim.world.get(id, PrioritiesC)?.construction ?? 0) <= 0 || stat(sim, id, 'workSpeed') <= 0) continue;
    out.push(id);
  }
  return out;
}

/** Progress, materials, workers, time left and the blocking reason (if any) of a module site; null when `id` is not one. */
export function siteStatus(sim: Sim, id: number): SiteStatus | null {
  const job = sim.world.get(id, JobC);
  const def = job?.module && sim.content.modules[job.module.def];
  if (!job || job.kind !== 'module' || !job.module || !def) return null;
  const ship = shipIdOf(sim, job);
  const size = job.size ?? def.footprint;
  const builders: number[] = [];
  const haulers: number[] = [];
  const flight = new Map<string, number>();
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (!j) continue;
    if (j.haul?.dst.kind === 'job' && j.haul.dst.id === id) {
      for (const q of [{ item: j.haul.item, count: j.haul.count }, ...(j.haul.extra ?? [])]) flight.set(q.item, (flight.get(q.item) ?? 0) + q.count);
      if (j.reservedBy) haulers.push(j.reservedBy);
    }
  }
  for (const c of sim.world.query(AssignmentC)) if (sim.world.get(c, AssignmentC)?.jobId === id) builders.push(c);
  const missing = new Map(missingMaterials(job).map((q) => [q.item, q.count]));
  const materials: SiteMaterial[] = (job.needs ?? []).map((q) => {
    const m = missing.get(q.item) ?? 0;
    return { item: q.item, need: q.count, delivered: q.count - m, inTransit: Math.min(m, flight.get(q.item) ?? 0), missing: m };
  });
  const capable = capableCrew(sim, ship);
  const rate = Math.max(0, ...(builders.length ? builders : capable).map((c) => stat(sim, c, 'workSpeed')));
  const left = Math.max(0, job.work - job.progress);
  return {
    id, ship, def: job.module.def, x: job.x, y: job.y, w: size[0], h: size[1], work: job.work, progress: job.progress,
    frac: job.work > 0 ? Math.min(1, job.progress / job.work) : 0, materials, builders, haulers,
    etaSec: rate > 0 ? left / (rate * TICK_HZ) : null, block: siteBlock(sim, id, job, ship, capable, materials),
  };
}

function siteBlock(sim: Sim, id: number, job: Job, ship: number, capable: number[], materials: SiteMaterial[]): SiteBlock | null {
  if (capable.length === 0) return { kind: 'noBuilder' };
  const reach = (goal: { x: number; y: number; adjacent: boolean; w?: number; h?: number }): boolean =>
    capable.some((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && findPath(sim, ship, origin(p), goal) !== null;
    });
  if (!reach(jobGoal(job))) return { kind: 'siteUnreachable' };
  const res = reservations(sim);
  for (const m of materials) {
    if (m.missing - m.inTransit <= 0) continue;
    const src = sourcesOf(sim, ship, m.item, res);
    const avail = src.reduce((n, s) => n + s.avail, 0);
    if (avail < m.missing - m.inTransit) return { kind: 'noStock', item: m.item, count: m.missing - m.inTransit - avail };
    if (!src.some((s) => reach({ x: s.x, y: s.y, adjacent: true }))) return { kind: 'stockUnreachable', item: m.item };
  }
  const grid = shipGrid(sim, ship);
  if (grid && job.progress >= job.work && job.module && footprintBlockedByCrew(sim, ship, job.module.def, job.x, job.y, job.module.rot)) return { kind: 'crewInWay' };
  return null;
}
