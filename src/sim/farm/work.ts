import type { Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { consumeDelivered, needsMaterials } from '../items/materials';
import { spillItems } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { PlotC } from './components';
import { growTicks, plotScale } from './crops';

/** Ticks of work (at work speed 1) to sow a bed, and to cut and clear a ripe one. */
export const PLANT_WORK = 60;
export const HARVEST_WORK = 60;

/**
 * One tick of farm work at a hydroponics bed. 'plant': waits for the crop's water to be delivered (an empty bed draws no power, so none is needed), works, then the water is used up
 * and the crop is in the soil, growing. 'harvest': works, then the yield lands on the bed's access tile (hauling carries it to storage) and the bed is empty.
 */
export function performFarm(sim: Sim, job: Job, speed: number): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const plot = sim.world.get(job.target ?? 0, PlotC);
  const def = m && sim.content.modules[m.def];
  if (!m || !plot || !def) return 'done';
  if (!m.enabled) return 'wait'; // a bed switched off pauses its planting and harvesting
  if (job.kind === 'plant') {
    const crop = job.crop ? sim.content.crops?.[job.crop] : undefined;
    if (!crop || plot.planted) return 'done';
    if (needsMaterials(job) || m.hp <= 0) return 'wait';
    job.progress = Math.min(job.work, job.progress + speed);
    if (job.progress < job.work) return 'working';
    consumeDelivered(job);
    plot.planted = job.crop ?? null;
    plot.grown = 0;
    plot.need = growTicks(crop);
    plot.ready = false;
    sim.events.emit({ type: 'crop.planted', module: job.target ?? 0, crop: job.crop ?? '', ship: shipIdOf(sim, job) });
    return 'done';
  }
  const crop = plot.planted ? sim.content.crops?.[plot.planted] : undefined;
  if (!plot.ready || !crop) return 'done';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  const at = accessTile(def, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
  const count = crop.yield * plotScale(sim, job.target ?? 0);
  spillItems(sim, shipIdOf(sim, job), at.x, at.y, crop.item, count);
  plot.planted = null;
  plot.grown = 0;
  plot.ready = false;
  sim.events.emit({ type: 'crop.harvested', module: job.target ?? 0, crop: crop.item, count, ship: shipIdOf(sim, job), x: at.x, y: at.y });
  return 'done';
}
