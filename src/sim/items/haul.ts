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
import { shipIdOf } from '../regions';

/** Where the haul's destination is (module anchor or the target job's tile), or null if it is gone. */
export function destinationTile(sim: Sim, job: Job): { x: number; y: number } | null {
  const dst = job.haul?.dst;
  if (!dst) return null;
  if (dst.kind === 'vehicle') {
    const t = cargoTile(sim, dst.id, { x: job.x, y: job.y });
    return t && t.shipId === shipIdOf(sim, job) ? { x: t.x, y: t.y } : null;
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
    const asked = h.count;
    const taken = h.src.kind === 'floor' ? takeFromStack(sim, h.src.id, want)
      : h.src.kind === 'vehicle' ? cargoTake(sim, h.src.id, h.item, want)
      : storageTake(sim, h.src.id, h.item, want);
    if (taken <= 0) return 'done';
    const extra: { item: string; count: number }[] = [];
    if (h.src.kind === 'storage') {
      for (const q of h.extra ?? []) {
        const got = storageTake(sim, h.src.id, q.item, Math.min(q.count, cap));
        if (got > 0) extra.push({ item: q.item, count: got });
      }
    }
    sim.world.add(crew, CarryingC, { item: h.item, count: taken, ...(extra.length > 0 ? { extra } : {}) });
    h.count = taken;
    if (taken < asked) delete h.then; // the source held less than planned: no more stops
    if (h.extra) h.extra = extra;
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
  for (const q of carrying.extra ?? []) {
    const target = h.dst.kind === 'job' ? sim.world.get(h.dst.id, JobC) : undefined;
    const got = target ? deliverToJob(target, q.item, q.count) : 0;
    if (q.count > got) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, q.item, q.count - got);
    if (got > 0) sim.events.emit({ type: 'item.hauled', crew, item: q.item, count: got, ship: shipIdOf(sim, job), x: job.x, y: job.y, to: 'job' });
  }
  if (moved > 0) {
    sim.events.emit({ type: 'item.hauled', crew, item: h.item, count: moved, ship: shipIdOf(sim, job), x: job.x, y: job.y, to: h.dst.kind });
  }
  // what is left goes on to the next job on the route
  const left = carrying.count - moved;
  while (left > 0 && h.then?.length) {
    const next = h.then.shift() as { job: number; count: number };
    const nj = sim.world.get(next.job, JobC);
    if (!nj) continue;
    h.dst = { kind: 'job', id: next.job };
    h.count = left;
    if (h.then.length === 0) delete h.then;
    carrying.count = left;
    delete carrying.extra;
    job.x = nj.x;
    job.y = nj.y;
    return 'working';
  }
  if (left > 0) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, h.item, left);
  sim.world.remove(crew, CarryingC);
  return 'done';
}
