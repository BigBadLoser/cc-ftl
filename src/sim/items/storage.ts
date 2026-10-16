import type { Sim } from '../sim';
import { StorageC } from './components';
import { stackSizeOf } from './stacks';

/** True if the storage accepts the item (its filter is null or lists it). */
export function accepts(filter: string[] | null, item: string): boolean {
  return filter === null || filter.includes(item);
}

/** Units of `item` a storage module could still take, ignoring reservations. 0 if filtered out. */
export function storageSpace(sim: Sim, id: number, item: string): number {
  const s = sim.world.get(id, StorageC);
  if (!s || !accepts(s.filter, item)) return 0;
  const max = stackSizeOf(sim, item);
  let space = Math.max(0, s.capacity - s.stacks.length) * max;
  for (const st of s.stacks) if (st.item === item) space += max - st.count;
  return space;
}

/** Units of `item` held by a storage module. */
export function storageCount(sim: Sim, id: number, item: string): number {
  let n = 0;
  for (const st of sim.world.get(id, StorageC)?.stacks ?? []) if (st.item === item) n += st.count;
  return n;
}

/** Put items into a storage module; returns how many went in (fills partial stacks first). */
export function storageAdd(sim: Sim, id: number, item: string, count: number): number {
  const s = sim.world.get(id, StorageC);
  if (!s || !accepts(s.filter, item)) return 0;
  const max = stackSizeOf(sim, item);
  let left = count;
  for (const st of s.stacks) {
    if (st.item !== item || st.count >= max) continue;
    const add = Math.min(left, max - st.count);
    st.count += add;
    left -= add;
  }
  while (left > 0 && s.stacks.length < s.capacity) {
    const add = Math.min(left, max);
    s.stacks.push({ item, count: add });
    left -= add;
  }
  return count - left;
}

/** Take items out of a storage module; returns how many came out. Emptied slots are removed. */
export function storageTake(sim: Sim, id: number, item: string, count: number): number {
  const s = sim.world.get(id, StorageC);
  if (!s) return 0;
  let left = count;
  for (let i = s.stacks.length - 1; i >= 0 && left > 0; i--) {
    const st = s.stacks[i];
    if (!st || st.item !== item) continue;
    const take = Math.min(left, st.count);
    st.count -= take;
    left -= take;
    if (st.count === 0) s.stacks.splice(i, 1);
  }
  return count - left;
}
