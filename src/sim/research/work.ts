import type { Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { skillOf } from '../combat/operators';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { SKILL_STEP } from '../tuning';
import { addProgress } from './research';

/**
 * One tick of research at a research module: waits while the module has no power or there is no active project, otherwise adds work to
 * the ship's project, SKILL_STEP faster per science level of the worker. The job never finishes by itself; the research-jobs system drops it.
 */
export function performResearch(sim: Sim, crew: number, job: Job, speed: number): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!m || !m.powered || m.hp <= 0 || !m.enabled) return 'wait';
  return addProgress(sim, shipIdOf(sim, m), speed * (1 + SKILL_STEP * Math.max(0, skillOf(sim, crew, 'science')))) ? 'working' : 'wait';
}
