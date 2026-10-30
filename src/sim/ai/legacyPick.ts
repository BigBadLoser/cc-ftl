import { CrewC, JobC, PrioritiesC, WORK_CATEGORIES, type Job, type Position, type Priorities } from '../crew/components';
import { freeOperatorFor, jobFits, jobTakeable } from '../crew/jobFit';
import { jobGoal, origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { findSuitSource, isErrand, type SuitSource } from '../eva/errands';
import { planSiteWalk } from '../eva/route';
import { operateAffinity } from '../combat/operators';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVA_JOB_PENALTY, OPERATE_MAX_LEVEL, RELIEF_AFTER_SEC, RELIEF_PENALTY } from '../tuning';
import { startErrand } from './machines/eva';
import { reserveJob } from './task';

/**
 * The legacy job picker (docs/CREW_AI.md Phase 1): `decide`'s `pickJob` and its emergency check, moved unchanged. Greedy per
 * crew member in id order: for each priority level 1..4, every open job of that level's categories that fits, scored by walking
 * distance minus repair urgency and operator affinity, plus the EVA and relief penalties; the lowest score wins, ties by job id.
 * Phase 2 replaces it with the scheduler (global per-level matching on an integer tuple, section 7).
 */

/** How often (ticks) a busy crew member looks for an emergency that outranks their job. */
export const EMERGENCY_CHECK_TICKS = 10;

/** True if an empty console may be relieved by crew whose operating priority is low: in a fight, left empty for RELIEF_AFTER_SEC, and one that matters unmanned (the shield console works at base strength without an operator). */
function canRelieve(sim: Sim, crewId: number, job: Job): boolean {
  const role = sim.world.get(crewId, CrewC)?.role;
  if (!role || !sim.content.roles[role]?.relievesStations || !sim.sector.inCombat || sim.tick - (job.freeSince ?? sim.tick) < RELIEF_AFTER_SEC * TICK_HZ) return false;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  return !!m && sim.content.modules[m.def]?.console !== 'shields' && freeOperatorFor(sim, shipIdOf(sim, m), job) === 0;
}

/** Score bonuses (tiles of walking) that put repair jobs in order: a manual priority repair beats combat triage, which beats the rest. */
const MANUAL_REPAIR_BONUS = 100000;
const FIGHT_REPAIR_BONUS = 20000;
const SUPPORT_REPAIR_BONUS = 10000;

/**
 * A priority-repair module's repair job beats any walking distance; a later order goes first. In combat the rest are triaged by what
 * the fight needs: weapons (and their console), reactors, shield generators and consoles and the helm come first, engines and life
 * support next, then everything else (lights, beds, storage) by distance as usual. Outside combat nothing changes.
 */
function repairUrgency(sim: Sim, job: Job): number {
  if (job.kind !== 'repair') return 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!m) return 0;
  if (m.repairFirst) return MANUAL_REPAIR_BONUS + m.repairFirst;
  if (!sim.sector.inCombat) return 0;
  const def = sim.content.modules[m.def];
  if (!def) return 0;
  if (def.console || def.weapon || def.shieldGen || def.power > 0) return FIGHT_REPAIR_BONUS;
  return def.engine || def.o2PerSec ? SUPPORT_REPAIR_BONUS : 0;
}

/** Jobs a crew member drops what they are doing for: a fire, a downed crew member, a hole in the hull. */
const isEmergency = (job: Job): boolean => job.kind === 'extinguish' || job.kind === 'rescue' || (job.kind === 'build' && job.category === 'firefighting');
/** What an emergency never interrupts: a console, a rescue, a suit errand, or another emergency. */
const HOLDS = ['operate', 'rescue', 'suitUp', 'suitOff', 'extinguish'];

/** True when a free emergency job the crew member ranks higher than their current job is waiting and reachable (checked every few ticks). */
export function emergencyWaiting(sim: Sim, crewId: number, pos: Position, current: Job): boolean {
  if (HOLDS.includes(current.kind) || isErrand(current) || (current.kind === 'build' && current.category === 'firefighting')) return false;
  const prio = sim.world.get(crewId, PrioritiesC) as Priorities;
  const held = prio[current.category] || 5; // off counts as the lowest
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (j.reservedBy !== 0 || !isEmergency(j)) continue;
    const level = prio[j.category];
    if (level >= 1 && level < held && jobTakeable(sim, crewId, pos, j)) return true;
  }
  return false;
}

/** Reserve the best job by priority level, then shortest path, then lowest id. */
export function pickJob(sim: Sim, crewId: number, pos: Position): boolean {
  const prio = sim.world.get(crewId, PrioritiesC) as Priorities;
  const jobs = sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.reservedBy === 0);
  if (jobs.length === 0) return false;
  let source: SuitSource | false | undefined; // the nearest suit, looked up the first time a thin-air job comes up
  for (let level = 1; level <= 4; level++) {
    const cats = WORK_CATEGORIES.filter((c) => prio[c] === level);
    let best: { id: number; steps: Tile[]; score: number; thin: boolean } | null = null;
    for (const jobId of jobs) {
      const job = sim.world.get(jobId, JobC);
      if (!job || !cats.includes(job.category) || !jobFits(sim, crewId, pos, job)) continue;
      // Operating is a high-priority job, except in a fight: a console left empty a while is relieved by crew of a role that relieves stations, with nothing better to do (disabled, 0, stays off).
      if (job.kind === 'operate' && level > OPERATE_MAX_LEVEL && !canRelieve(sim, crewId, job)) continue;
      const plan = planSiteWalk(sim, crewId, shipIdOf(sim, pos), origin(pos), jobGoal(job));
      // Prefer jobs that need no EVA; a thin-air job is only on offer when a suit can be had for it.
      if (!plan || (plan.thin && !(source ??= findSuitSource(sim, crewId, pos) ?? false))) continue;
      // a relief takes the console only when nothing else of their rank is waiting
      const score = plan.steps.length - repairUrgency(sim, job) - operateAffinity(sim, crewId, job) + (plan.thin ? EVA_JOB_PENALTY : 0) + (job.kind === 'operate' && level > OPERATE_MAX_LEVEL ? RELIEF_PENALTY : 0);
      if (!best || score < best.score) best = { id: jobId, steps: plan.steps, score, thin: plan.thin };
    }
    if (best) {
      reserveJob(sim, crewId, best.id, best.steps);
      if (best.thin && source) startErrand(sim, crewId, 'suitUp', source, shipIdOf(sim, pos), best.id);
      return true;
    }
  }
  return false;
}
