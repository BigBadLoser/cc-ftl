import { JobC, type Job } from '../crew/components';
import { missingMaterials } from '../items/materials';
import { makeHaul, warnDue } from '../items/plan';
import { nearestSource, refKey, reservations, type Reservations } from '../items/stock';
import type { ItemQty } from '../registry';
import { storageCount } from '../items/storage';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { shipIdOf } from '../regions';

const MAX_HAULS_PER_ITEM = 8;
/** Most units one trip tops up for further jobs, and how far from the first job (tiles) they may lie. */
const CHAIN_MAX = 30;
const CHAIN_REACH = 10;

/** Other build jobs near `job` still short of `item` (not covered by hauls in flight), nearest first, filling up to `budget` units. */
function chain(sim: Sim, res: Reservations, jobId: number, job: Job, item: string, budget: number): { job: number; count: number }[] {
  const out: { job: number; count: number }[] = [];
  if (budget <= 0 || (job.kind !== 'build' && job.kind !== 'module')) return out;
  const near: { id: number; d: number; lack: number }[] = [];
  for (const id of sim.world.query(JobC)) {
    const k = sim.world.get(id, JobC);
    if (!k || id === jobId || k.haul || (k.kind !== 'build' && k.kind !== 'module') || shipIdOf(sim, k) !== shipIdOf(sim, job)) continue;
    const d = Math.max(Math.abs(k.x - job.x), Math.abs(k.y - job.y));
    const lack = (missingMaterials(k).find((q) => q.item === item)?.count ?? 0) - (res.incoming.get(refKey('job', id, item)) ?? 0);
    if (d <= CHAIN_REACH && lack > 0) near.push({ id, d, lack });
  }
  near.sort((a, b) => a.d - b.d || a.id - b.id);
  for (const k of near) {
    const count = Math.min(k.lack, budget);
    out.push({ job: k.id, count });
    budget -= count;
    if (budget <= 0) break;
  }
  return out;
}

/**
 * Materials delivery. For every job that lacks materials (build, module blueprint, craft), creates
 * haul jobs from the nearest unreserved stock to the job until the shortfall is covered by hauls in
 * flight. If there is no stock, the job just waits and a debounced 'job.missingMaterials' is emitted.
 * Work on the job only begins once everything has been delivered (see jobWork).
 */
export function supplyJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  for (const jobId of sim.world.query(JobC)) {
    const job = sim.world.get(jobId, JobC);
    if (!job || job.haul) continue;
    const missing = missingMaterials(job);
    const lacks = new Map(missing.map((q) => [q.item, q.count - (res.incoming.get(refKey('job', jobId, q.item)) ?? 0)]));
    for (const need of missing) {
      let lack = lacks.get(need.item) ?? 0;
      for (let i = 0; i < MAX_HAULS_PER_ITEM && lack > 0; i++) {
        const src = nearestSource(sim, shipIdOf(sim, job), need.item, job, res);
        if (!src) {
          if (warnDue(sim, job)) {
            sim.events.emit({ type: 'job.missingMaterials', job: jobId, ship: shipIdOf(sim, job), x: job.x, y: job.y, item: need.item });
          }
          break;
        }
        const n = Math.min(lack, src.avail, DEFAULT_CARRY_CAPACITY);
        const category = job.kind === 'craft' ? (sim.content.recipes[job.craft?.recipe ?? '']?.category ?? 'crafting') : 'construction';
        // One trip carries the job's other materials from the same crate too (builders carry what they need).
        const extra: ItemQty[] = [];
        if (src.ref.kind === 'storage' && job.kind !== 'craft') {
          for (const o of missing) {
            if (o.item === need.item) continue;
            const left = lacks.get(o.item) ?? 0;
            const have = storageCount(sim, src.ref.id, o.item) - (res.out.get(refKey('storage', src.ref.id, o.item)) ?? 0);
            const m = Math.min(left, have, DEFAULT_CARRY_CAPACITY);
            if (m > 0) { extra.push({ item: o.item, count: m }); lacks.set(o.item, left - m); }
          }
        }
        // ...and when the load is not full, it carries on to nearby jobs short of the same item (one trip serves a run of walls).
        const then = job.kind === 'craft' ? [] : chain(sim, res, jobId, job, need.item, Math.min(CHAIN_MAX, src.avail) - n);
        const total = n + then.reduce((s, t) => s + t.count, 0);
        makeHaul(sim, res, category, shipIdOf(sim, job), src, { kind: 'job', id: jobId }, need.item, total, extra, then);
        lack -= n;
      }
      lacks.set(need.item, lack);
    }
  }
}
