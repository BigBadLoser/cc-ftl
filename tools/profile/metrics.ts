/**
 * Crew-AI metrics harness (docs/CREW_AI.md section 7.4). Reads sim state only, outside any timed span, so it never changes the sim and its numbers are
 * counts in ticks (deterministic for a seed; wall-clock figures are not). Step the sim with `rec.probe(sim, inner)` and call `observe(sim, events)` after each
 * step with the events the step drained (`sim.events.drain()`), then `summary()`.
 *
 * **When each field is sampled, and why.** Within one step `sim/work` can finish a job and destroy it, so anything that must see a job or an assignment that
 * lives only inside a step has to be read before `sim/work` begins (the probe does that: every poster of jobs and every assigner except `resumeAfter` runs
 * before work). What describes the board at the end of the step is read after the step.
 * - Before `sim/work` (probe), stamped with the step's own tick: job discovery (`jobsSeen`, created tick), first reservation (time to assign), and the job
 *   category each crew member holds (to file a `crew.jobDone` under its category). A job posted, taken and finished within one step is therefore counted, with a
 *   wait of 0.
 * - After the step (`observe`), stamped with the incremented tick: the same scan again (jobs posted by systems after work, and every job when the step ran
 *   without the probe), the open list and the per-tick oldest open age (the board the next decide pass will see), the completions (events), and the
 *   idle-with-work sample (idle crew and open jobs at the end of the step).
 * - Not visible: a job posted and destroyed entirely after work in one step (nothing can assign it: assigners all run before work or are commands), or
 *   assigned and destroyed before work (a cancel or drop system).
 *
 * Definitions (all ticks; TICK_HZ ticks per second):
 * - **open job**: a job entity nobody has reserved. Errands (suitUp/suitOff) and `operate` jobs are left out: errands are personal, and an operate job never
 *   finishes by design (it waits for relief rules, not for a free hand), so both would only add noise.
 * - **oldest open job age**: each tick, the age of the oldest open job (now minus the tick it was first seen; jobs already there when the recorder is
 *   attached count from the attach tick). `max` and `p95` are over the per-tick series; `atEnd` is the last tick's value.
 * - **time to assign**: first-seen to first-reserved, per job (p50/p95/max). `neverAssigned` is the jobs still open at the end.
 * - **completion**: `crew.jobDone` events (the sim already emits them when work finishes) by job category, plus a per-1000-ticks rate.
 * - **idle-with-work** (an approximation, sampled every `stride` ticks and scaled): a crew member counts as idle when they are not drafted, down, off duty,
 *   eating, claiming a bed or holding a job, and their activity is idle or walking (wandering). They have work when an open job of a category whose
 *   priority they have enabled (> 0) exists that `jobTakeable` accepts: same ship, funded, not barred to them, and a walk exists (with a suit to be had when
 *   the way is thin air). Not checked: relief and exhaustion rules, and the tick of lag between a job appearing and the next decide pass, so a few idle
 *   samples right after a job appears are expected. `crewTicks` = samples x stride.
 */
import {
  AssignmentC, BedClaimC, CrewC, DraftedC, EatC, JobC, PositionC, PrioritiesC, TICK_HZ, shipIdOf,
  NOOP_PROBE, type Job, type Probe, type Sim, type SimEvent, type WorkCategory,
} from '../../src/sim';
import { isIncapacitated } from '../../src/sim/crew/helpers';
import { jobTakeable, jobFits } from '../../src/sim/crew/jobFit';
import { OBSERVE_LABEL, runPlain, type Excluder } from './excluded';
import { isErrand } from '../../src/sim/eva/errands';
import { isOffDuty } from '../../src/sim/fight/relations';

export interface Dist { n: number; p50: number; p95: number; max: number }

export interface MetricsSummary {
  ticksObserved: number;
  tickHz: number;
  jobsSeen: number;
  oldestOpenAge: { max: number; p95: number; atEnd: number };
  timeToAssign: Dist & { neverAssigned: number };
  completion: { total: number; per1000: number; byCategory: Record<string, { done: number; per1000: number }> };
  idleWithWork: { stride: number; samples: number; crewSamples: number; idleSamples: number; idleWithWorkSamples: number; crewTicks: number; idleCrewTicks: number; share: number };
}

interface Tracked { created: number; category: WorkCategory; assigned: number; seen: number }

/** Nearest-rank percentile of an ascending-sorted array (0 for an empty one). `p` in 0..1. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] as number;
}

const dist = (values: number[]): Dist => {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, p50: percentile(s, 0.5), p95: percentile(s, 0.95), max: s.length ? (s[s.length - 1] as number) : 0 };
};

/** Jobs the metrics ignore (see the header). */
const skip = (job: Job): boolean => job.kind === 'operate' || isErrand(job);

/**
 * `jobTakeable` without leaving a trace. Route planning memoises "does this grid have thin air" keyed by `sim.tick`, and an observer runs after the
 * step has already incremented the tick, so an entry written here would be reused by the next step after commands and atmosphere changed the grid: the
 * measurement would change the sim. Running the check with `sim.tick` set to -1 stores the entry under a tick no step ever runs at, then restores the tick.
 */
function takeableWithoutMemo(sim: Sim, id: number, pos: Parameters<typeof jobTakeable>[2], job: Job): boolean {
  const tick = sim.tick;
  sim.tick = -1;
  try {
    return jobTakeable(sim, id, pos, job);
  } finally {
    sim.tick = tick;
  }
}

export class MetricsRecorder {
  private categoryByCrew = new Map<number, WorkCategory>();
  private tracked = new Map<number, Tracked>();
  private waits: number[] = [];
  private oldest: number[] = [];
  private done: Record<string, number> = {};
  private ticks = 0;
  private jobsSeen = 0;
  private first = -1;
  private idle = { samples: 0, crew: 0, idle: 0, work: 0 };

  constructor(readonly opts: { stride: number } = { stride: 25 }) {}

  /**
   * A probe to step the sim with (`sim.step(rec.probe(sim, inner))`). Job discovery, first reservations and crew job categories are read as `sim/work` begins,
   * after every system that posts or hands out jobs has run and before work can finish and destroy one (see the header). Read-only.
   */
  probe(sim: Sim, inner: Probe = NOOP_PROBE, excluded: Excluder = runPlain): Probe {
    return {
      begin: (label) => {
        if (label === 'sim/work') {
          excluded(OBSERVE_LABEL, () => {
            this.scanJobs(sim, sim.tick);
            this.snapshotCategories(sim);
          });
        }
        inner.begin(label);
      },
      end: (label) => inner.end(label),
      count: (label, n) => inner.count(label, n),
    };
  }

  private snapshotCategories(sim: Sim): void {
    this.categoryByCrew.clear();
    for (const id of sim.world.query(CrewC, AssignmentC)) {
      const cat = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC)?.category;
      if (cat) this.categoryByCrew.set(id, cat);
    }
  }

  /**
   * Walk the jobs: first sight (`jobsSeen`, created tick), first reservation (time to assign) and the open list with the oldest age. Run twice per step with the
   * probe (stamped with the step's tick before work, with the incremented tick after the step), once without. A job seen only before work and gone after
   * it (finished in the step) keeps its stamp and is dropped by `observe`.
   */
  private scanJobs(sim: Sim, now: number): { open: number[]; oldest: number } {
    const open: number[] = [];
    let oldest = 0;
    for (const id of sim.world.query(JobC)) {
      const job = sim.world.get(id, JobC) as Job;
      if (skip(job)) continue;
      let t = this.tracked.get(id);
      if (!t) {
        this.tracked.set(id, (t = { created: now, category: job.category, assigned: -1, seen: now }));
        this.jobsSeen++;
      }
      t.seen = now;
      if (job.reservedBy !== 0) {
        if (t.assigned < 0) {
          t.assigned = now;
          this.waits.push(now - t.created);
        }
      } else {
        open.push(id);
        oldest = Math.max(oldest, now - t.created);
      }
    }
    return { open, oldest };
  }

  /** Observe the sim after a step. `events` are the events that step emitted (drained by the caller). */
  observe(sim: Sim, events: readonly SimEvent[] = []): void {
    const now = sim.tick;
    if (this.first < 0) this.first = now;
    this.ticks++;
    const { open, oldest } = this.scanJobs(sim, now);
    for (const [id, t] of this.tracked) if (t.seen !== now) this.tracked.delete(id); // finished or cancelled since the last scan: no longer waiting
    this.oldest.push(oldest);
    // Completions are the sim's own `crew.jobDone` events; the category is that of the job the crew member held at the previous observation.
    for (const e of events) {
      if (e.type !== 'crew.jobDone' || e.kind === 'suitUp' || e.kind === 'suitOff' || e.kind === 'operate') continue;
      const cat = this.categoryByCrew.get(e.crew) ?? 'other';
      this.done[cat] = (this.done[cat] ?? 0) + 1;
    }
    this.snapshotCategories(sim); // for a step run without `probe`: the category of a job held across steps
    if (now % this.opts.stride === 0) this.sampleIdle(sim, open);
  }

  private sampleIdle(sim: Sim, openIds: number[]): void {
    this.idle.samples++;
    const jobs = openIds.map((id) => ({ id, job: sim.world.get(id, JobC) as Job }));
    for (const id of sim.world.query(CrewC, PrioritiesC, PositionC)) {
      const crew = sim.world.get(id, CrewC)!;
      if (crew.activity === 'dead') continue;
      this.idle.crew++;
      if (sim.world.has(id, AssignmentC) || sim.world.has(id, DraftedC) || sim.world.has(id, EatC) || sim.world.has(id, BedClaimC)) continue;
      if (isIncapacitated(sim, id) || isOffDuty(sim, id) || (crew.activity !== 'idle' && crew.activity !== 'walking')) continue;
      this.idle.idle++;
      const pos = sim.world.get(id, PositionC)!;
      const pr = sim.world.get(id, PrioritiesC)!;
      const ship = shipIdOf(sim, pos);
      for (const { job } of jobs) {
        if ((pr[job.category] ?? 0) <= 0 || shipIdOf(sim, job) !== ship || !jobFits(sim, id, pos, job)) continue;
        if (takeableWithoutMemo(sim, id, pos, job)) {
          this.idle.work++;
          break;
        }
      }
    }
  }

  summary(): MetricsSummary {
    const sortedOldest = [...this.oldest].sort((a, b) => a - b);
    const open = [...this.tracked.values()].filter((t) => t.assigned < 0).length;
    const byCategory: Record<string, { done: number; per1000: number }> = {};
    const rate = (n: number): number => (this.ticks ? Math.round((n * 100000) / this.ticks) / 100 : 0);
    let total = 0;
    for (const cat of Object.keys(this.done).sort()) {
      byCategory[cat] = { done: this.done[cat] as number, per1000: rate(this.done[cat] as number) };
      total += this.done[cat] as number;
    }
    const s = this.opts.stride, i = this.idle;
    return {
      ticksObserved: this.ticks,
      tickHz: TICK_HZ,
      jobsSeen: this.jobsSeen,
      oldestOpenAge: { max: sortedOldest.length ? (sortedOldest[sortedOldest.length - 1] as number) : 0, p95: percentile(sortedOldest, 0.95), atEnd: this.oldest[this.oldest.length - 1] ?? 0 },
      timeToAssign: { ...dist(this.waits), neverAssigned: open },
      completion: { total, per1000: rate(total), byCategory },
      idleWithWork: {
        stride: s, samples: i.samples, crewSamples: i.crew, idleSamples: i.idle, idleWithWorkSamples: i.work,
        crewTicks: i.work * s, idleCrewTicks: i.idle * s, share: i.crew ? Math.round((i.work / i.crew) * 10000) / 10000 : 0,
      },
    };
  }
}

/** The metrics as aligned text lines for the profile report. */
export function formatMetrics(m: MetricsSummary): string {
  const w = m.idleWithWork;
  const lines = [
    `crew-AI metrics (ticks; ${m.tickHz} per second; observed ${m.ticksObserved} ticks, ${m.jobsSeen} jobs)`,
    `  oldest open job age   max ${m.oldestOpenAge.max}  p95 ${m.oldestOpenAge.p95}  at end ${m.oldestOpenAge.atEnd}`,
    `  time to assign        n ${m.timeToAssign.n}  p50 ${m.timeToAssign.p50}  p95 ${m.timeToAssign.p95}  max ${m.timeToAssign.max}  never assigned ${m.timeToAssign.neverAssigned}`,
    `  idle with work        ${w.crewTicks} crew-ticks of ${w.idleCrewTicks} idle (share of crew samples ${(w.share * 100).toFixed(2)}%, stride ${w.stride})`,
    `  completed             ${m.completion.total} jobs (${m.completion.per1000} per 1000 ticks)` + Object.entries(m.completion.byCategory).map(([c, v]) => `  ${c} ${v.done} (${v.per1000}/k)`).join(''),
  ];
  return lines.join('\n');
}
