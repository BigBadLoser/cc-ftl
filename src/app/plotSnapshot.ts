import { growth, growTicks, JobC, ModuleC, needsMaterials, PlotC, plotScale, plotWaterScale, TICK_HZ, totalStock, wantsSowing, type Sim } from '../sim';

import type { UiCrop, UiPlot } from '../ui/api';

/** The crops a bed can be set to (the picker's rows), in content order. */
function cropRows(sim: Sim, scale: number, waterScale: number): UiCrop[] {
  return Object.entries(sim.content.crops ?? {}).map(([id, c]) => ({
    id, name: c.name, item: c.item, itemName: sim.content.items[c.item]?.name ?? c.item, yield: c.yield * scale, growSec: c.growSec, water: c.water * waterScale, blurb: c.blurb,
  }));
}

/** A hydroponics bed's state for the module panel, or null for any other module. Reads the sim, never mutates it. */
export function buildPlot(sim: Sim, id: number): UiPlot | null {
  const plot = sim.world.get(id, PlotC);
  const m = sim.world.get(id, ModuleC);
  if (!plot || !m) return null;
  const planted = plot.planted ? sim.content.crops?.[plot.planted] : undefined;
  let job;
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (j && (j.kind === 'plant' || j.kind === 'harvest') && j.target === id) job = j;
  }
  const live = m.enabled && m.hp > 0;
  const state = plot.ready ? 'ready' : planted ? 'growing' : 'fallow';
  let note: string;
  if (state === 'ready') note = job?.reservedBy ? 'Harvesting' : 'Ready: waiting for a crew member to harvest';
  else if (planted) {
    const left = Math.max(0, Math.ceil((growTicks(planted) - plot.grown) / TICK_HZ));
    note = !live || !m.powered ? 'No power: growth paused' : `Growing: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
  } else if (!plot.crop) note = 'Pick a crop to sow';
  else if (!live) note = 'Bed is switched off';
  else if (!wantsSowing(sim, id) && !job) note = `Plenty of ${sim.content.items[sim.content.crops?.[plot.crop]?.item ?? '']?.name ?? 'it'} in stock: not sowing`;
  else if (job && needsMaterials(job)) note = 'Waiting for water to be brought';
  else note = job?.reservedBy ? 'Sowing' : 'Waiting for a crew member to sow';
  const next = plot.crop ? sim.content.crops?.[plot.crop] : undefined;
  return {
    crop: plot.crop, planted: plot.planted, plantedName: planted?.name ?? null, state, progress: growth(sim, plot), note,
    stock: next ? totalStock(sim, next.item) : 0, crops: cropRows(sim, plotScale(sim, id), plotWaterScale(sim, id)),
  };
}
