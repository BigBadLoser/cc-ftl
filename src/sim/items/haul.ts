import { JobC, PositionC, type Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { CarryingC } from './components';
import { deliverToJob } from './materials';
import { dropCarried, spillItems, takeFromStack } from './stacks';
import { storageAdd, storageTake } from './storage';
import { cargoAdd, cargoTake } from '../vehicles/cargo';
import { cargoTile } from '../vehicles/geometry';
import { gridIdOf, shipIdOf } from '../regions';

/** Where the haul's destination is (module anchor or the target job's tile), or null if it is gone. */
export function destinationTile(sim: Sim, job: Job): { x: number; y: number } | null {
  const dst = job.haul?.dst;
  if (!dst) return null;
  if (dst.kind === 'vehicle') {
    const t = cargoTile(sim, dst.id, { x: job.x, y: job.y });
    return t && t.gridId === gridIdOf(sim, job) ? { x: t.x, y: t.y } : null;
  }
  const at = dst.kind === 'job' ? sim.world.get(dst.id, JobC) : sim.world.get(dst.id, ModuleC);
  return at ? { x: at.x, y: at.y } : null;
}

/**
 * One tick of a haul job with the crew member next to its current tile.
 * Pickup: take what the carry capacity allows, shrink the job to that, aim it at the destination.
 * Deliver: deposit what is carried; anything that no longer fits is dropped nearby.
 */
export function performHaul(sim: Sim, crew: number, job: Job): WorkResult {
  const h = job.haul;
  if (!h) return 'done';
  if (h.phase === 'pickup') {
    dropCarried(sim, crew);
    const dest = destinationTile(sim, job);
    if (!dest) return 'done';
    const cap = Math.max(1, Math.floor(stat(sim, crew, 'carryCapacity')));
    const want = Math.min(h.count, cap);
    const taken = h.src.kind === 'floor' ? takeFromStack(sim, h.src.id, want)
      : h.src.kind === 'vehicle' ? cargoTake(sim, h.src.id, h.item, want)
      : storageTake(sim, h.src.id, h.item, want);
    if (taken <= 0) return 'done';
    sim.world.add(crew, CarryingC, { item: h.item, count: taken });
    h.count = taken;
    h.phase = 'deliver';
    job.x = dest.x;
    job.y = dest.y;
    return 'working';
  }

  const carrying = sim.world.get(crew, CarryingC);
  const pos = sim.world.get(crew, PositionC);
  if (!carrying || carrying.item !== h.item || !pos) return 'done';
  let moved = 0;
  if (h.dst.kind === 'storage') moved = storageAdd(sim, h.dst.id, h.item, carrying.count);
  else if (h.dst.kind === 'vehicle') moved = cargoAdd(sim, h.dst.id, h.item, carrying.count);
  else {
    const target = sim.world.get(h.dst.id, JobC);
    moved = target ? deliverToJob(target, h.item, carrying.count) : 0;
  }
  if (carrying.count > moved) spillItems(sim, gridIdOf(sim, pos), pos.toX, pos.toY, h.item, carrying.count - moved);
  sim.world.remove(crew, CarryingC);
  if (moved > 0) {
    sim.events.emit({ type: 'item.hauled', crew, item: h.item, count: moved, ship: shipIdOf(sim, job), x: job.x, y: job.y, to: h.dst.kind });
  }
  return 'done';
}
