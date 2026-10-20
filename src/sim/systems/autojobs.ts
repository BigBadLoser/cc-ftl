import { findFreeBed } from '../crew/beds';
import { CarriedC, DownedC, JobC, PositionC, type Job } from '../crew/components';
import { origin, releaseAssignment } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { keepRobotJob, robotJobs } from '../robots/jobs';
import type { Sim } from '../sim';
import { regions } from '../regions';

/** Work value for jobs that finish by condition (fire out, hp full, patient delivered), not by progress. */
const CONDITIONAL_WORK = 1;

function addJob(sim: Sim, job: Partial<Job> & Pick<Job, 'category' | 'kind' | 'gridId' | 'x' | 'y'>): void {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { struct: 0, work: CONDITIONAL_WORK, progress: 0, reservedBy: 0, ...job });
}

function drop(sim: Sim, jobId: number, job: Job): void {
  if (job.reservedBy) releaseAssignment(sim, job.reservedBy);
  sim.world.destroyEntity(jobId);
}

/**
 * Maintains the jobs the colony creates for itself, so crew react to emergencies without orders:
 *  - extinguish (firefighting): one per burning tile, removed once the fire is out;
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
      if (!seen.has(`extinguish:${grid.id}:${x}:${y}`)) {
        addJob(sim, { category: 'firefighting', kind: 'extinguish', gridId: grid.id, x, y });
      }
    }
  }
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || m.hp >= def.maxHp || seen.has(`repair:${id}`)) continue;
    addJob(sim, { category: 'repair', kind: 'repair', gridId: m.gridId, x: m.x, y: m.y, target: id });
  }
  for (const id of sim.world.query(DownedC, PositionC)) {
    const downed = sim.world.get(id, DownedC);
    const pos = sim.world.get(id, PositionC);
    if (!downed || !pos || downed.stabilized || seen.has(`rescue:${id}`)) continue;
    if (!downed.bed && !findFreeBed(sim, pos.gridId, origin(pos))) continue; // nowhere to take them
    addJob(sim, { category: 'medical', kind: 'rescue', gridId: pos.gridId, x: pos.x, y: pos.y, target: id, bed: downed.bed });
  }
  robotJobs(sim, seen, (job) => addJob(sim, job));
}

function jobKey(job: Job): string {
  return job.kind === 'extinguish' ? `extinguish:${job.gridId}:${job.x}:${job.y}` : `${job.kind}:${job.target}`;
}

function keepExtinguish(sim: Sim, job: Job): boolean {
  const grid = sim.grids.get(job.gridId);
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
