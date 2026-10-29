import { findFreeBed, ownedBedPlan, releaseBedClaim } from '../crew/beds';
import { abortTask, isCarrying, reserveJob } from '../ai/task';
import { vacateSite } from '../crew/vacate';
import { goEat, wantsToEat } from '../crew/eating';
import {
  AssignmentC, BedClaimC, CrewC, DraftedC, EatC, JobC, NeedsC, PathC, PositionC, PrioritiesC, WORK_CATEGORIES,
  type Crew, type Job, type Path, type Position, type Priorities,
} from '../crew/components';
import { freeOperatorFor, jobFits, jobTakeable } from '../crew/jobFit';
import { atJob, clearPath, isIncapacitated, jobGoal, isSettled, origin } from '../crew/helpers';
import { findPath, type Tile } from '../crew/pathfind';
import { findSuitSource, findSuitStow, isErrand, type SuitSource } from '../eva/errands';
import { startErrand } from '../ai/machines/eva';
import { planSiteWalk } from '../eva/route';
import { isSuited } from '../eva/suit';
import { YardCrewC } from '../yard/types';
import { isOffDuty } from '../fight/relations';
import { dropCarried } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { isTileWalkable } from '../modules/walk';
import { operateAffinity } from '../combat/operators';
import { goToBay, wantsBay } from '../robots/bay';
import { heldForMend } from '../robots/jobs';
import type { Sim } from '../sim';
import { EVA_JOB_PENALTY, OPERATE_MAX_LEVEL, OPERATOR_EXHAUSTED_BELOW, RELIEF_AFTER_SEC, RELIEF_PENALTY } from '../tuning';
import { TICK_HZ } from '../time';
import { shipIdOf, shipGrid } from '../regions';
import { strollTurn } from '../stations/life';

/** Below this rest a non-drafted crew member drops everything and sleeps in place. */
const SLEEP_BELOW = 20;
/** A tired crew member acts when (tick + id) is a multiple of this, so a whole crew crossing the threshold at once does not search for beds in one tick. */
export const SLEEP_STAGGER = 4;
/** Per-tick chance that an idle crew member wanders (about once per 10 s). */
const WANDER_CHANCE = 0.005;
const WANDER_RADIUS = 3;
/** How often (ticks) a busy crew member looks for an emergency that outranks their job. */
const EMERGENCY_CHECK_TICKS = 10;

/** Autonomous decisions for non-drafted crew: hold for a mender, go recharge (robots), sleep, keep/repath a job, pick a job, or idle. */
export function decideSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC, PathC, NeedsC)) {
    if (sim.world.has(id, DraftedC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) continue;
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity === 'sleeping' || crew.activity === 'charging' || crew.activity === 'eating') continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const needs = sim.world.get(id, NeedsC) as { rest: number };

    const assignment = sim.world.get(id, AssignmentC);
    // Robots: hold still for a mender; head to the robot bay when the battery is low or badly damaged.
    if (heldForMend(sim, id) && !isCarrying(sim, id)) {
      abortTask(sim, id, 'heldForMend');
      continue;
    }
    if (wantsBay(sim, id) && !isCarrying(sim, id) && goToBay(sim, id, crew, pos)) {
      if (assignment) {
        abortTask(sim, id, 'drive'); // also clears the path: plan the walk to the bay again
        goToBay(sim, id, crew, pos);
      }
      dropCarried(sim, id);
      continue;
    }
    const operating = assignment && sim.world.get(assignment.jobId, JobC)?.kind === 'operate';
    if (needs.rest < (operating ? OPERATOR_EXHAUSTED_BELOW : SLEEP_BELOW) && !isCarrying(sim, id)) {
      // Crew crossing the threshold together act on different ticks (a crew member already walking to a bed is not held up).
      if (!sim.world.has(id, BedClaimC) && (sim.tick + id) % SLEEP_STAGGER !== 0) continue;
      if (assignment) abortTask(sim, id, 'drive');
      dropCarried(sim, id);
      goToSleep(sim, id, crew, pos);
      continue;
    }

    // Hungry: walk to the galley (or a crate with food) and eat. No food or no way there: carry on, try again later.
    if ((sim.world.has(id, EatC) || wantsToEat(sim, id, !!operating)) && !isCarrying(sim, id) && goEat(sim, id, crew, pos)) continue;

    if (assignment) {
      const job = sim.world.get(assignment.jobId, JobC);
      if (!job) {
        abortTask(sim, id, 'jobGone');
        continue;
      }
      // An emergency (fire, downed crew member, hull hole) the crew member ranks above their job calls them off it.
      if ((sim.tick + id) % EMERGENCY_CHECK_TICKS === 0 && !isCarrying(sim, id) && emergencyWaiting(sim, id, pos, job)) abortTask(sim, id, 'preempt');
      else {
        const path = sim.world.get(id, PathC);
        if (path && path.steps.length === 0 && !atJob(origin(pos), job) && !routeToJob(sim, id, pos, assignment.jobId, job)) abortTask(sim, id, 'unreachable');
        continue;
      }
    }

    dropCarried(sim, id); // a load left over from a lost haul job
    if (!pickJob(sim, id, pos) && !stowSuit(sim, id, pos) && !(isSettled(pos) && vacateSite(sim, id, pos)) && !strollTurn(sim, id, pos)) wander(sim, id, pos, crew);
  }
}

/**
 * Walk to a reserved job. A job that can only be reached through thin air sends an unsuited crew member to fit a suit
 * first (the job stays theirs and resumes afterwards); false when it cannot be reached at all or no suit can be had.
 */
function routeToJob(sim: Sim, id: number, pos: Position, jobId: number, job: Job): boolean {
  const path = sim.world.get(id, PathC) as Path;
  const plan = planSiteWalk(sim, id, shipIdOf(sim, pos), origin(pos), jobGoal(job));
  if (!plan) return false;
  if (plan.thin && !isErrand(job)) {
    const src = findSuitSource(sim, id, pos);
    if (!src) return false;
    startErrand(sim, id, 'suitUp', src, shipIdOf(sim, pos), jobId);
    return true;
  }
  path.steps = plan.steps;
  return true;
}

/** A suited crew member with nothing to do walks to an airlock and takes the suit off, so the suit is free for the next one. */
function stowSuit(sim: Sim, id: number, pos: Position): boolean {
  if (!isSuited(sim, id) || sim.world.has(id, YardCrewC)) return false; // the shipyard's contractors keep their suits on until the shuttle
  if (!isSettled(pos) || (sim.tick + id) % 20 !== 0) return true; // look for an airlock every second or so; meanwhile stand still
  const src = findSuitStow(sim, id, pos);
  if (!src) return false;
  startErrand(sim, id, 'suitOff', src, shipIdOf(sim, pos));
  return true;
}

/**
 * Tired: claim the bed they own (else the nearest free one) and walk to it, then sleep there (faster rest). With no
 * reachable bed, sleep where standing. Only falls asleep once settled on a tile.
 */
function goToSleep(sim: Sim, id: number, crew: Crew, pos: Position): void {
  let claim = sim.world.get(id, BedClaimC);
  const bed = claim && sim.world.get(claim.bed, ModuleC);
  if (claim && (!bed || bed.hp <= 0)) {
    releaseBedClaim(sim, id);
    claim = undefined;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (claim && bed) {
    if (isSettled(pos) && pos.x === bed.x && pos.y === bed.y) return fallAsleep(sim, id, crew);
    if (path.steps.length > 0 || !isSettled(pos)) return; // still walking to the bed
    const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: bed.x, y: bed.y });
    if (steps && steps.length > 0) {
      path.steps = steps;
      return;
    }
    releaseBedClaim(sim, id); // unreachable: sleep on the floor instead
  } else {
    const plan = ownedBedPlan(sim, id, shipIdOf(sim, pos), origin(pos)) ?? findFreeBed(sim, shipIdOf(sim, pos), origin(pos));
    if (plan) {
      (sim.world.get(plan.bed, ModuleC) as { reservedBy: number }).reservedBy = id;
      sim.world.add(id, BedClaimC, { bed: plan.bed });
      path.steps = plan.steps;
      return;
    }
  }
  if (isSettled(pos)) fallAsleep(sim, id, crew);
}

function fallAsleep(sim: Sim, id: number, crew: Crew): void {
  clearPath(sim, id);
  crew.activity = 'sleeping';
  sim.events.emit({ type: 'crew.fellAsleep', crew: id });
}

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
function emergencyWaiting(sim: Sim, crewId: number, pos: Position, current: Job): boolean {
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
function pickJob(sim: Sim, crewId: number, pos: Position): boolean {
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

/** Occasionally stroll a few tiles within the current room. */
function wander(sim: Sim, id: number, pos: Position, crew: Crew): void {
  const path = sim.world.get(id, PathC);
  if (!path || path.steps.length > 0 || !isSettled(pos)) return;
  if (crew.activity !== 'idle') crew.activity = 'idle';
  if (!sim.rng.chance(WANDER_CHANCE)) return;
  const grid = shipGrid(sim, shipIdOf(sim, pos));
  if (!grid?.has('room')) return;
  const room = grid.get('room', pos.x, pos.y);
  if (room === 0) return;
  const tx = pos.x + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  const ty = pos.y + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  if ((tx === pos.x && ty === pos.y) || !grid.inBounds(tx, ty)) return;
  if (!isTileWalkable(sim, grid, tx, ty) || grid.get('room', tx, ty) !== room) return;
  const steps = findPath(sim, shipIdOf(sim, pos), { x: pos.x, y: pos.y }, { x: tx, y: ty });
  if (steps && steps.length <= 2 * WANDER_RADIUS) path.steps = steps;
  else clearPath(sim, id);
}
