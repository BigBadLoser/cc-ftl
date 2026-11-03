import { JobC, PositionC, type Job } from '../crew/components';
import type { PathGoal, Tile } from '../crew/pathfind';
import { origin } from '../crew/helpers';
import { isErrand } from '../eva/errands';
import { airValue } from '../eva/air';
import { sourceCandidates } from '../eva/sources';
import { isSuited, isThin, needsAir, suitAir, suitDef } from '../eva/suit';
import { shipGrid } from '../regions';
import { SalvageCrewC } from '../salvage/components';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { TICK_HZ } from '../time';
import { AIR_RESERVE_SEC, STINT_SEC } from '../tuning';
import { YardCrewC } from '../yard/types';
import { isEmergency } from './emergency';
import { dijkstraFrom } from './navSearch';
import { goalTiles, indexOf, isFallbackStop, viewOf, type View } from './navView';
import { travelTicks } from './travel';

/**
 * Partial-work admission (docs/DESIGN.md "Partial work", #286). A suited (or suiting) crew member in thin air is admitted for a job if the
 * walk there, one work stint (`STINT_SEC` of work, or what is left of the job), the walk from the job to its nearest air source and
 * `AIR_RESERVE_SEC` fit in the air they have; a fresh suit counts as a full tank. So a long job is done in stints with refill trips between,
 * and a job no source can be reached from is never admitted (an emergency, a fire, a breach or a rescue, is: it must still fit the walk and a stint). The scheduler asks `admits` as it accepts a match (it has the steps then).
 * The map from a job to its nearest source is one search out of each source per pass, made the first time a pair needs it.
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

/** The searches out of one ship's sources, to every open job on it. */
interface Reach {
  view: View;
  /** Per source: the reverse search, the key of a job in it and the source's own tile and added ticks. */
  from: { r: ReturnType<typeof dijkstraFrom>; tile: Tile; extra: number }[];
}

export class AirAdmission {
  private reach = new Map<number, Reach | null>();
  private byShip = new Map<number, AirJob[]>();
  constructor(private sim: Sim, jobs: readonly AirJob[]) {
    for (const j of jobs) {
      const l = this.byShip.get(j.ship);
      if (l) l.push(j);
      else this.byShip.set(j.ship, [j]);
    }
  }

  /** Whether the pair is turned away for want of air, and why (null: admitted). `thin`: the walk is a thin-air one (a suit goes on first). */
  rejection(w: AirWalker, jobId: number, steps: readonly Tile[], thin: boolean): AirRejection | null {
    const sim = this.sim;
    const job = sim.world.get(jobId, JobC) as Job | undefined;
    if (!job || isErrand(job) || !needsAir(sim, w.id) || sim.world.has(w.id, SalvageCrewC) || sim.world.has(w.id, YardCrewC)) return null;
    const suited = isSuited(sim, w.id);
    const grid = shipGrid(sim, w.ship);
    if (!grid || (!suited && !thin)) return null;
    const work = steps.length > 0 ? (steps[steps.length - 1] as Tile) : (w.from ?? this.tileOf(w.id)); // the tile the work is done from (an adjacent job's own tile is the wall or module)
    if (!work) return null;
    const jobThin = isThin(grid, work.x, work.y);
    if (!jobThin && !thin && !steps.some((s) => isThin(grid, s.x, s.y))) return null; // a suit in breathable air does not drain
    const sec = (ticks: number): number => ticks / TICK_HZ;
    const left = (suited ? suitAir(sim, w.id) : suitDef(sim).airSec) * airValue(sim, w.id);
    const walk = sec(travelTicks(sim, w.id, steps, { shipId: w.ship, suited: true }));
    if (!jobThin) return walk + AIR_RESERVE_SEC <= left ? null : 'noAir';
    let back = this.toSource(w, work);
    if (back === null) {
      if (!isEmergency(job)) return 'noSource';
      back = 0; // a fire, a breach or a patient is not left because there is no way home: they go if the walk and a stint fit
    }
    const speed = stat(sim, w.id, 'workSpeed') * (suited ? 1 : suitDef(sim).workMult);
    // Only a job that finishes by progress has a stint shorter than STINT_SEC; a repair, a fire, a rescue or a console runs until its condition is met (`work` is a placeholder).
    const stint = PROGRESS_KINDS.has(job.kind) ? Math.min(STINT_SEC, Math.max(0, job.work - job.progress) / (TICK_HZ * Math.max(0.05, speed))) : STINT_SEC;
    return walk + stint + sec(back) + AIR_RESERVE_SEC <= left ? null : 'noAir';
  }

  /** True if the pair is admitted. */
  admits(w: AirWalker, jobId: number, steps: readonly Tile[], thin: boolean): boolean {
    return this.rejection(w, jobId, steps, thin) === null;
  }

  private tileOf(id: number): Tile | null {
    const p = this.sim.world.get(id, PositionC);
    return p ? origin(p) : null;
  }

  /** Ticks from the work tile to its nearest source for this walker, or null when none can be reached from that very tile. */
  private toSource(w: AirWalker, work: Tile): number | null {
    const reach = this.reachOf(w.ship);
    if (!reach) return null;
    const key = indexOf(reach.view, work.x, work.y);
    let best: number | null = null;
    for (const s of reach.from) {
      if (!s.r.cost.has(key)) continue;
      const path = s.r.steps(key); // from the source to the work tile
      const back = [...path.slice(0, -1).reverse(), s.tile];
      const ticks = travelTicks(this.sim, w.id, back, { from: path.length ? (path[path.length - 1] as Tile) : s.tile, shipId: w.ship, suited: true }) + s.extra;
      if (best === null || ticks < best) best = ticks;
    }
    return best;
  }

  private reachOf(ship: number): Reach | null {
    if (this.reach.has(ship)) return this.reach.get(ship) as Reach | null;
    const view = viewOf(this.sim, ship, { suited: true });
    const sources = view ? sourceCandidates(this.sim, ship) : [];
    let made: Reach | null = null;
    if (view && sources.length > 0) {
      const goals = new Map<number, number[]>();
      const fallbacks = new Map<number, number[]>();
      for (const j of this.byShip.get(ship) ?? []) {
        for (const t of goalTiles(view, j.goal)) (isFallbackStop(view, j.goal, t) ? fallbacks : goals).set(t, [t]); // keyed by tile: the work tile the scheduler chose
      }
      made = { view, from: sources.map((s) => ({ r: dijkstraFrom(view, s.tile, goals, fallbacks), tile: s.tile, extra: s.extra })) };
    }
    this.reach.set(ship, made);
    return made;
  }
}
