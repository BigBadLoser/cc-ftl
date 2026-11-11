import { JobC, PositionC, type Job } from '../crew/components';
import type { PathGoal, Tile } from '../crew/pathfind';
import { origin } from '../crew/helpers';
import { isErrand } from '../eva/errands';
import { airLeft, fitsReserve } from '../eva/airLedger';
import { SourceReach } from '../eva/sources';
import { isSuited, suitNeeded, needsAir, suitDef } from '../eva/suit';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { TICK_HZ } from '../time';
import { STINT_SEC } from '../tuning';
import { isEmergency } from './emergency';
import { travelTicks } from './travel';
import { shuttleDueBack } from '../away/trips';

/**
 * Partial-work admission (docs/DESIGN.md "Partial work", #286). A suited (or suiting) crew member in thin air is admitted for a job if the
 * walk there, one work stint (`STINT_SEC` of work, or what is left of the job), the walk from the job to its nearest air source and
 * `AIR_RESERVE_SEC` fit in the air they have; a fresh suit counts as a full tank. So a long job is done in stints with refill trips between,
 * and a job no source can be reached from is never admitted (an emergency, a fire, a breach or a rescue, is: it must still fit the walk and a stint). The scheduler asks `admits` as it accepts a match (it has the steps then).
 * The way back from a job to its nearest source is the air module's `SourceReach` (one search out of each source per pass), the fit
 * the ledger's `fitsReserve`.
 *
 * Salvage teams and the shipyard's contractors keep their own air logic until it moves onto this one, so they are never turned away here.
 */

/** Jobs whose `work` is real: they finish when `progress` reaches it. */
const PROGRESS_KINDS: ReadonlySet<string> = new Set(['build', 'deconstruct', 'module', 'moduleDecon']);

/** Why a pair was refused: `noAir` (it does not fit the tank) or `noSource` (no source can be reached from the job). */
export type AirRejection = 'noAir' | 'noSource';

/** A job the pass knows of, with the goal the walk ends at. */
export interface AirJob {
  id: number;
  ship: number;
  goal: PathGoal;
}

/** Someone the scheduler is matching. */
export interface AirWalker {
  id: number;
  ship: number;
  /** Where the walk starts; the work tile of a job with no steps. Defaults to the entity's position. */
  from?: Tile;
}

export class AirAdmission {
  private reach: SourceReach;
  constructor(private sim: Sim, jobs: readonly AirJob[]) {
    const byShip = new Map<number, PathGoal[]>();
    for (const j of jobs) {
      const l = byShip.get(j.ship);
      if (l) l.push(j.goal);
      else byShip.set(j.ship, [j.goal]);
    }
    this.reach = new SourceReach(sim, (ship) => byShip.get(ship) ?? []);
  }

  /** Whether the pair is turned away for want of air, and why (null: admitted). `thin`: the walk is a thin-air one (a suit goes on first). */
  rejection(w: AirWalker, jobId: number, steps: readonly Tile[], thin: boolean): AirRejection | null {
    const sim = this.sim;
    const job = sim.world.get(jobId, JobC) as Job | undefined;
    if (!job || isErrand(job) || !needsAir(sim, w.id)) return null;
    const suited = isSuited(sim, w.id);
    const grid = shipGrid(sim, w.ship);
    if (!grid || (!suited && !thin)) return null;
    const work = steps.length > 0 ? (steps[steps.length - 1] as Tile) : (w.from ?? this.tileOf(w.id)); // the tile the work is done from (an adjacent job's own tile is the wall or module)
    if (!work) return null;
    const jobThin = suitNeeded(grid, work.x, work.y);
    if (!jobThin && !thin && !steps.some((s) => suitNeeded(grid, s.x, s.y))) return null; // a suit in breathable air does not drain
    const sec = (ticks: number): number => ticks / TICK_HZ;
    const left = airLeft(sim, w.id, !suited);
    const walk = sec(travelTicks(sim, w.id, steps, { shipId: w.ship, suited: true }));
    if (!jobThin) return fitsReserve(walk, left) ? null : 'noAir';
    const speed = stat(sim, w.id, 'workSpeed') * (suited ? 1 : suitDef(sim).workMult);
    // Only a job that finishes by progress has a stint shorter than STINT_SEC; a repair, a fire, a rescue or a console runs until its condition is met (`work` is a placeholder).
    const stint = PROGRESS_KINDS.has(job.kind) ? Math.min(STINT_SEC, Math.max(0, job.work - job.progress) / (TICK_HZ * Math.max(0.05, speed))) : STINT_SEC;
    let back = this.reach.ticksFrom(w.id, w.ship, work);
    if (back === null) {
      // Their site's shuttle is away on a round trip (#408): it is their source again once back. The tank must last the work, or the wait
      // for the shuttle if that is longer, and then the walk from the job to where it takes them aboard.
      const due = shuttleDueBack(sim, w.id, w.ship);
      const later = due && this.reach.ticksTo(w.id, w.ship, work, due.tile);
      if (due && later !== null && fitsReserve(Math.max(walk + stint, sec(due.ticks)) + sec(later), left)) return null;
      if (!isEmergency(job)) return due && later !== null ? 'noAir' : 'noSource';
      back = 0; // a fire, a breach or a patient is not left because there is no way home: they go if the walk and a stint fit
    }
    return fitsReserve(walk + stint + sec(back), left) ? null : 'noAir';
  }

  /** True if the pair is admitted. */
  admits(w: AirWalker, jobId: number, steps: readonly Tile[], thin: boolean): boolean {
    return this.rejection(w, jobId, steps, thin) === null;
  }

  private tileOf(id: number): Tile | null {
    const p = this.sim.world.get(id, PositionC);
    return p ? origin(p) : null;
  }
}
