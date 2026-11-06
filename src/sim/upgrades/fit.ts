import { JobC, type Job } from '../crew/components';
import { ContainerC } from '../containers/components';
import { StorageC } from '../items/components';
import { shipStoreCount } from '../items/stock';
import { spillItems } from '../items/stacks';
import { storageAdd } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Fitting an upgrade is a crew job (kind 'fit', repair work) at the module: a job with `fit.item` fetches that item from cargo like a build
 * job's materials and swaps it in; one with `fit.item` null takes the fitted one out. The module is offline while the work runs (`fitting`).
 */

/** The fit job of a module: [job id, job], if one is posted. */
export function fitJobOf(sim: Sim, moduleId: number): [number, Job] | undefined {
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'fit' && j.target === moduleId) return [id, j];
  }
  return undefined;
}

/** True while the module's upgrade is being fitted or removed (the crew are at the work): the module is offline. */
export function fitting(sim: Sim, moduleId: number): boolean {
  const j = fitJobOf(sim, moduleId)?.[1];
  return !!j && j.progress > 0;
}

/** Every module whose upgrade is being fitted or removed right now. */
export function fittingModules(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'fit' && j.progress > 0 && j.target) out.add(j.target);
  }
  return out;
}

/** Why `item` cannot go in the module's slot, or null. */
export function fitError(sim: Sim, moduleId: number, item: string): string | null {
  const m = sim.world.get(moduleId, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return 'noModule';
  const up = sim.content.items[item]?.upgrade;
  if (!up) return 'notUpgrade';
  if (!def.upgradeSlot || def.upgradeSlot !== up.slot) return 'noSlot';
  if (up.fits && !up.fits.includes(m.def) && !up.fits.includes(def.weapon ?? '')) return 'wontFit';
  return null;
}

/** Upgrade items in the ship's cargo a module could take, by item id. */
export function fittingChoices(sim: Sim, moduleId: number): string[] {
  const shipId = shipIdOf(sim, sim.world.get(moduleId, ModuleC));
  return Object.keys(sim.content.items).filter((i) => fitError(sim, moduleId, i) === null && shipStoreCount(sim, shipId, i) > 0);
}

/** Put one item into the ship's cargo (first storage with room), or on the floor by the module when there is none. */
export function returnToCargo(sim: Sim, shipId: number, item: string, at: { x: number; y: number }): void {
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || sim.world.has(id, ContainerC)) continue;
    if (storageAdd(sim, id, item, 1) === 1) return;
  }
  spillItems(sim, shipId, at.x, at.y, item, 1);
}

/** The job's work is done: take the fitted upgrade out (into cargo) and put the fetched one in. */
export function finishFit(sim: Sim, job: Job): void {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!m) return;
  const shipId = shipIdOf(sim, m);
  if (m.upgrade) returnToCargo(sim, shipId, m.upgrade, m);
  const next = job.fit?.item ?? null;
  if (next) m.upgrade = next;
  else delete m.upgrade;
  job.delivered = [];
  sim.events.emit({ type: 'module.upgradeFitted', moduleId: job.target ?? 0, item: next, ship: shipId });
}
