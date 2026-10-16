import { ItemStackC } from '../items/components';
import { makeHaul, warnDue } from '../items/plan';
import { nearestStorageFor, refKey, reservations } from '../items/stock';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';

/**
 * Clears the floor: every loose stack not already claimed gets a haul job to the nearest storage
 * module that accepts the item and has room (counting space already promised to other hauls).
 * With nowhere to put it, a debounced 'storage.full' event is emitted for that stack.
 */
export function haulJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  for (const id of sim.world.query(ItemStackC)) {
    const stack = sim.world.get(id, ItemStackC);
    if (!stack) continue;
    const avail = stack.count - (res.out.get(refKey('floor', id, stack.item)) ?? 0);
    if (avail <= 0) continue;
    const dest = nearestStorageFor(sim, stack.gridId, stack.item, stack, res);
    if (!dest) {
      if (warnDue(sim, stack)) {
        sim.events.emit({ type: 'storage.full', gridId: stack.gridId, x: stack.x, y: stack.y, item: stack.item });
      }
      continue;
    }
    const src = { ref: { kind: 'floor' as const, id }, x: stack.x, y: stack.y, avail };
    makeHaul(sim, res, 'hauling', stack.gridId, src, dest.ref, stack.item, Math.min(avail, dest.room, DEFAULT_CARRY_CAPACITY));
  }
}
