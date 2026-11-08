import { JobC, type Job } from '../crew/components';
import { destroyJob } from '../items/stacks';
import { needsFrom } from '../items/materials';
import { ModuleC } from '../modules/components';
import { moduleSite } from '../modules/footprint';
import type { Sim } from '../sim';
import { PLAN_INTERVAL } from '../tuning';
import { PlotC } from './components';
import { growTicks, plotScale, wantsSowing } from './crops';
import { HARVEST_WORK, PLANT_WORK } from './work';

/**
 * Hydroponics beds, once a tick: a planted crop grows one tick while its bed is whole, enabled and powered, and turns ready at its growing time.
 * Every PLAN_INTERVAL ticks each bed keeps at most one job: 'plant' (the crop's water delivered first) while it is empty and set to a crop, 'harvest'
 * once ready. A job the bed no longer wants (crop changed, bed gone, unpowered, harvested already) is dropped.
 */
export function farmSystem(sim: Sim): void {
  for (const id of sim.world.query(PlotC, ModuleC)) {
    const plot = sim.world.get(id, PlotC);
    const m = sim.world.get(id, ModuleC);
    const crop = plot?.planted ? sim.content.crops?.[plot.planted] : undefined;
    if (!plot || !m) continue;
    if (plot.planted && !crop) { plot.planted = null; plot.grown = 0; plot.ready = false; continue; } // a crop the content lost
    if (crop && !plot.ready && m.enabled && m.powered && m.hp > 0 && ++plot.grown >= growTicks(crop)) plot.ready = true;
  }
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const jobs = new Map<number, number>();
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (j && (j.kind === 'plant' || j.kind === 'harvest')) jobs.set(j.target ?? 0, jid);
  }
  for (const [moduleId, jid] of jobs) {
    const job = sim.world.get(jid, JobC) as Job;
    const plot = sim.world.get(moduleId, PlotC);
    // A plant job already under way (progress, or its water in) is kept when only the power blinks or the stock cap is reached.
    const started = job.progress > 0 || !!job.delivered?.length;
    const keep = !!plot && (job.kind === 'harvest' ? plot.ready : !plot.planted && plot.crop === job.crop && (started || !!wantsSowing(sim, moduleId)));
    if (!keep) {
      destroyJob(sim, jid);
      jobs.delete(moduleId);
    }
  }
  for (const id of sim.world.query(PlotC, ModuleC)) {
    if (jobs.has(id)) continue;
    const plot = sim.world.get(id, PlotC);
    const m = sim.world.get(id, ModuleC);
    if (!plot || !m || m.hp <= 0 || !m.enabled) continue;
    const site = moduleSite(sim.content.modules[m.def], m);
    const base = { category: 'farming' as const, ...site, struct: 0, progress: 0, reservedBy: 0, target: id };
    const sow = plot.ready ? null : wantsSowing(sim, id);
    if (plot.ready) sim.world.add(sim.world.createEntity(), JobC, { ...base, kind: 'harvest', work: HARVEST_WORK });
    else if (sow && plot.crop) {
      sim.world.add(sim.world.createEntity(), JobC, {
        ...base, kind: 'plant', work: PLANT_WORK, crop: plot.crop, needs: needsFrom([{ item: 'item.water', count: sow.water * plotScale(sim, id) }]), delivered: [],
      });
    }
  }
}
