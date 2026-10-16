import type { Job } from '../crew/components';
import type { ItemQty } from '../registry';

const qtyOf = (list: ItemQty[] | undefined, item: string): number =>
  (list ?? []).filter((q) => q.item === item).reduce((n, q) => n + q.count, 0);

/** What a job still lacks: needs minus delivered, only positive entries. */
export function missingMaterials(job: Job): ItemQty[] {
  return (job.needs ?? [])
    .map((q) => ({ item: q.item, count: q.count - qtyOf(job.delivered, q.item) }))
    .filter((q) => q.count > 0);
}

/** True while a build/module/craft job waits for materials (its 'needsMaterials' state). */
export function needsMaterials(job: Job): boolean {
  return missingMaterials(job).length > 0;
}

/** Hand units to a job; returns how many it accepted (never more than it still lacks). */
export function deliverToJob(job: Job, item: string, count: number): number {
  const lack = missingMaterials(job).find((q) => q.item === item)?.count ?? 0;
  const n = Math.min(lack, count);
  if (n <= 0) return 0;
  job.delivered ??= [];
  const row = job.delivered.find((q) => q.item === item);
  if (row) row.count += n;
  else job.delivered.push({ item, count: n });
  return n;
}

/** The materials were used up by finished work. */
export function consumeDelivered(job: Job): void {
  job.delivered = [];
}

/** Copy a cost list for a new job's `needs` (undefined when free). */
export function needsFrom(cost: ItemQty[] | undefined): ItemQty[] | undefined {
  return cost && cost.length > 0 ? cost.map((q) => ({ ...q })) : undefined;
}
