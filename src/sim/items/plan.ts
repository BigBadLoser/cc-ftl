import { JobC, type WorkCategory } from '../crew/components';
import type { Sim } from '../sim';
import { WARN_DEBOUNCE } from '../tuning';
import type { ItemQty } from '../registry';
import type { HaulRef } from './components';
import { refKey, type Located, type Reservations } from './stock';

/** Create a haul job and record its claims in the reservation snapshot the planner is working from. */
export function makeHaul(
  sim: Sim, res: Reservations, category: WorkCategory, shipId: number, src: Located, dst: HaulRef, item: string, count: number, extra: ItemQty[] = [], then: { job: number; count: number }[] = [],
): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, {
    category, kind: 'haul', x: src.x, y: src.y, struct: 0, work: 1, progress: 0, reservedBy: 0,
    haul: { item, count, phase: 'pickup', src: src.ref, dst, ...(extra.length > 0 ? { extra } : {}), ...(then.length > 0 ? { then } : {}) },
  });
  for (const q of extra) {
    const o = refKey(src.ref.kind, src.ref.id, q.item);
    const n = refKey(dst.kind, dst.id, q.item);
    res.out.set(o, (res.out.get(o) ?? 0) + q.count);
    res.incoming.set(n, (res.incoming.get(n) ?? 0) + q.count);
  }
  const out = refKey(src.ref.kind, src.ref.id, item);
  const inc = refKey(dst.kind, dst.id, item);
  res.out.set(out, (res.out.get(out) ?? 0) + count);
  res.incoming.set(inc, (res.incoming.get(inc) ?? 0) + count - then.reduce((n, t) => n + t.count, 0));
  for (const t of then) {
    const k = refKey('job', t.job, item);
    res.incoming.set(k, (res.incoming.get(k) ?? 0) + t.count);
  }
  return id;
}

/** True (and stamps `holder.warnedAt`) when a warning for this holder is due; false while debounced. */
export function warnDue(sim: Sim, holder: { warnedAt?: number }): boolean {
  if (holder.warnedAt !== undefined && sim.tick - holder.warnedAt < WARN_DEBOUNCE) return false;
  holder.warnedAt = sim.tick;
  return true;
}
