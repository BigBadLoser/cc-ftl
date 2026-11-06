import type { Sim } from '../sim';
import { ModuleC, type Module } from './components';

/** How long one refresh of a work hold lasts, in ticks: it outlives the tick of work that set it however the systems are ordered. */
const HOLD_TICKS = 2;

/** Take a module offline while it is being worked on (a fit job, later a retool or a deep repair): refresh this each tick of the work. */
export function holdOffline(sim: Sim, moduleId: number): void {
  const m = sim.world.get(moduleId, ModuleC);
  if (m) m.offlineUntil = sim.tick + HOLD_TICKS;
}

/** End a work hold now. */
export function releaseHold(sim: Sim, moduleId: number): void {
  const m = sim.world.get(moduleId, ModuleC);
  if (m) delete m.offlineUntil;
}

/** True while a work hold keeps this module offline. */
export const isHeldOffline = (sim: Sim, m: Module): boolean => m.offlineUntil !== undefined && sim.tick < m.offlineUntil;
