import { findFreeBed } from '../crew/beds';
import { abortTask } from '../ai/task';
import { breachTiles, canAffordWall } from '../crew/breach';
import { CarriedC, DownedC, JobC, PositionC, type Job } from '../crew/components';
import { origin } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { keepRobotJob, robotJobs } from '../robots/jobs';
import { keepSabotage } from '../boarding/sabotage';
import type { Sim } from '../sim';
import { regions, shipIdOf, shipGrid } from '../regions';
import { createJob, BUILD_TICKS } from '../crew/handlers';
import { findJobAt } from '../crew/helpers';
import { Struct } from '../structure';

/** Work value for jobs that finish by condition (fire out, hp full, patient delivered), not by progress. */
const CONDITIONAL_WORK = 1;
/** How often (ticks) the hull is scanned for holes to post wall jobs on. */
const BREACH_SCAN_TICKS = 10;

function addJob(sim: Sim, job: Partial<Job> & Pick<Job, 'category' | 'kind' | 'x' | 'y'>): void {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { struct: 0, work: CONDITIONAL_WORK, progress: 0, reservedBy: 0, ...job });
}

function drop(sim: Sim, jobId: number, job: Job): void {
  if (job.reservedBy) abortTask(sim, job.reservedBy, 'cancelled');
  sim.world.destroyEntity(jobId);
}

/**
 * Maintains the jobs the colony creates for itself, so crew react to emergencies without orders:
 *  - extinguish (firefighting): one per burning tile, removed once the fire is out;
 *  - breach: a wall build (category firefighting) on each hole in a player ship's hull, once the stock can pay for a wall;
 *  - repair (repair): one per damaged module, removed at full hp or when the module is gone;
 *  - rescue (medical): one per downed, unstabilized crew member while a free bed exists;
 *  - robots (robots/jobs): mend damaged robots, salvage wrecks; ordered hacks are dropped once their hacker lets go.
 * Jobs are keyed by (kind, tile) or (kind, target) so none is duplicated.
 */
export function autoJobsSystem(sim: Sim): void {
  const seen = new Set<string>();
  for (const jobId of [...sim.world.query(JobC)]) {
    const job = sim.world.get(jobId, JobC) as Job;
    const keep = job.kind === 'extinguish' ? keepExtinguish(sim, job)
      : job.kind === 'repair' ? keepRepair(sim, job)
      : job.kind === 'rescue' ? keepRescue(sim, job)
      : job.kind === 'sabotage' ? keepSabotage(sim, jobId, job)
      : keepRobotJob(sim, jobId, job);
    if (keep === null) continue;
    if (!keep) drop(sim, jobId, job);
    else seen.add(jobKey(job));
  }

  for (const { grid } of regions(sim)) {
    if (!grid.has('fire')) continue;
    const fire = grid.load('fire');
    for (let i = 0; i < fire.length; i++) {
      if (fire[i] === 0) continue;
      const x = grid.x0 + (i % grid.width);
      const y = grid.y0 + Math.floor(i / grid.width);
      if (!seen.has(`extinguish:${x}:${y}`)) {
        addJob(sim, { category: 'firefighting', kind: 'extinguish', x, y });
      }
    }
  }
  // Hull breaches: a wall build (firefighting category, ahead of ordinary construction) on each hole, once the stock can pay for one.
  if (sim.tick % BREACH_SCAN_TICKS === 0 && canAffordWall(sim)) {
    for (const { ship, tile } of breachTiles(sim)) {
      if (!findJobAt(sim, ship, tile.x, tile.y)) createJob(sim, 'build', ship, tile.x, tile.y, Struct.Wall, BUILD_TICKS[Struct.Wall] as number, false, { category: 'firefighting' });
    }
  }
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (m && def && m.hp >= def.maxHp) delete m.repairFirst; // mended: the priority repair order is done
    if (!m || !def || m.hp >= def.maxHp || seen.has(`repair:${id}`)) continue;
    addJob(sim, { category: 'repair', kind: 'repair', x: m.x, y: m.y, target: id });
  }
  for (const id of sim.world.query(DownedC, PositionC)) {
    const downed = sim.world.get(id, DownedC);
    const pos = sim.world.get(id, PositionC);
    if (!downed || !pos || downed.stabilized || seen.has(`rescue:${id}`)) continue;
    if (!downed.bed && !findFreeBed(sim, shipIdOf(sim, pos), origin(pos))) continue; // nowhere to take them
    addJob(sim, { category: 'medical', kind: 'rescue', x: pos.x, y: pos.y, target: id, bed: downed.bed });
  }
  robotJobs(sim, seen, (job) => addJob(sim, job));
}

function jobKey(job: Job): string {
  return job.kind === 'extinguish' ? `extinguish:${job.x}:${job.y}` : `${job.kind}:${job.target}`;
}

function keepExtinguish(sim: Sim, job: Job): boolean {
  const grid = shipGrid(sim, shipIdOf(sim, job));
  return !!grid?.has('fire') && grid.inBounds(job.x, job.y) && grid.get('fire', job.x, job.y) > 0;
}

function keepRepair(sim: Sim, job: Job): boolean {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const def = m && sim.content.modules[m.def];
  return !!m && !!def && m.hp < def.maxHp;
}

/** Rescue jobs aim at the patient while on the floor and at their bed while being carried. */
function keepRescue(sim: Sim, job: Job): boolean {
  const target = job.target ?? 0;
  const downed = sim.world.get(target, DownedC);
  const pos = sim.world.get(target, PositionC);
  if (!downed || !pos || downed.stabilized) return false;
  const bed = sim.world.get(job.bed ?? 0, ModuleC);
  const goal = sim.world.has(target, CarriedC) && bed ? bed : pos;
  job.x = goal.x;
  job.y = goal.y;
  return true;
}
