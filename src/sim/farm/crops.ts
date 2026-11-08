import { ModuleC } from '../modules/components';
import { totalStock } from '../items/stock';
import type { CropDef } from '../registry';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { PlotC, type Plot } from './components';

/** How many times a small bed's yield and water the module takes (`ModuleDef.plot.scale`). */
export function plotScale(sim: Sim, moduleId: number): number {
  const m = sim.world.get(moduleId, ModuleC);
  return (m && sim.content.modules[m.def]?.plot?.scale) || 1;
}

/** How many times a small bed's water a sowing takes (`plot.waterScale`, else the yield scale). */
export function plotWaterScale(sim: Sim, moduleId: number): number {
  const m = sim.world.get(moduleId, ModuleC);
  const p = m && sim.content.modules[m.def]?.plot;
  return p?.waterScale ?? p?.scale ?? 1;
}

/** Ticks of powered growing a crop needs. */
export const growTicks = (crop: CropDef): number => Math.round(crop.growSec * TICK_HZ);

/** Fraction grown 0..1 (1 once ready); 0 for an empty bed. */
export function growth(sim: Sim, plot: Plot): number {
  const crop = plot.planted ? sim.content.crops?.[plot.planted] : undefined;
  return !crop ? 0 : plot.ready ? 1 : Math.min(1, plot.grown / growTicks(crop));
}

/** A bed is waiting to be sown: set to a crop, empty, whole and enabled, and the ship is not already full of that crop. (An empty bed draws no power, so it is not asked for any.) */
export function wantsSowing(sim: Sim, id: number): CropDef | null {
  const plot = sim.world.get(id, PlotC);
  const m = sim.world.get(id, ModuleC);
  const crop = plot?.crop ? sim.content.crops?.[plot.crop] : undefined;
  if (!plot || !m || !crop || plot.planted || !m.enabled || m.hp <= 0) return null;
  return totalStock(sim, crop.item) >= crop.stockCap ? null : crop;
}
