import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { destroyJob } from '../items/stacks';
import { shipIdOf } from '../regions';
import { ResearchC } from '../research/components';
import { isDone, labsOf, projectOf, researchJobs, startHead } from '../research/research';
import type { Sim } from '../sim';
import { PLAN_INTERVAL } from '../tuning';

/**
 * Keeps a ship's research going: drops queued projects that no longer exist or whose blueprints were learnt meanwhile (an unpaid head
 * too), pays the head from stock when it can, and keeps one 'research' job (category research) per research module while a project is
 * active. A job whose module is gone, disabled or on a ship with no active project is dropped, releasing its crew member.
 */
export function researchJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const active = new Set<number>();
  for (const ship of sim.world.query(ResearchC)) {
    const r = sim.world.get(ship, ResearchC);
    if (!r) continue;
    r.queue = r.queue.filter((id, i) => {
      const def = projectOf(sim, id);
      return !!def && (i === 0 && r.paid ? true : !isDone(sim, def));
    });
    if (r.queue.length === 0) { r.paid = false; r.progress = 0; }
    if (startHead(sim, ship, r)) active.add(ship);
  }
  const jobs = researchJobs(sim);
  for (const [moduleId, jobId] of jobs) {
    const m = sim.world.get(moduleId, ModuleC);
    if (!m || !active.has(shipIdOf(sim, m)) || !labsOf(sim, shipIdOf(sim, m)).includes(moduleId)) {
      destroyJob(sim, jobId);
      jobs.delete(moduleId);
    }
  }
  for (const ship of active) {
    for (const lab of labsOf(sim, ship)) {
      const m = sim.world.get(lab, ModuleC);
      if (!m || jobs.has(lab)) continue;
      const id = sim.world.createEntity();
      sim.world.add(id, JobC, {
        category: 'research', kind: 'research', x: m.x, y: m.y, struct: 0, work: 1, progress: 0, reservedBy: 0, target: lab,
      });
    }
  }
}
