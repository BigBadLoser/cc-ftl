import type { RoomSpec } from './plan';

/**
 * Departments on round stations ([docs/STATIONFLOWS.md](../../../docs/STATIONFLOWS.md), step 1): the station plan's rooms
 * regrouped by job before the layout. Freight: the plan's many small crate rooms (`cargoSpec`, six crates each) and the
 * kind's stores merge into a few warehouses, large rectangles laid out in aisles at fit-out, that stand as machine-like
 * rooms between the rings instead of as band segments stretched along the ring.
 */

/** Crates a warehouse holds at most; more make a second one. */
const WAREHOUSE = 24;

/** The plan's cargo rooms merged into warehouses (pinned rooms stay as they are); the other rooms unchanged. */
export function warehoused(rooms: readonly RoomSpec[]): RoomSpec[] {
  const cargo = rooms.filter((r) => r.role === 'cargo' && !r.pinned);
  if (cargo.length < 2) return [...rooms];
  const mods = cargo.flatMap((r) => r.mods);
  const k = Math.max(1, Math.ceil(mods.length / WAREHOUSE));
  const area = cargo.reduce((t, r) => t + r.w * r.h, 0) / k;
  const out: RoomSpec[] = rooms.filter((r) => !cargo.includes(r));
  for (let i = 0; i < k; i++) {
    const mine = mods.filter((_, j) => j % k === i);
    const items = cargo.flatMap((r) => r.items ?? []).filter((_, j) => j % k === i);
    // Wide and shallow (about 8:5), at least five deep for two aisles of racks.
    const h = Math.max(5, Math.round(Math.sqrt(area / 1.6)));
    const w = Math.max(h, Math.ceil(area / h));
    out.push({ role: 'cargo', mods: mine, w, h, stock: true, warehouse: true, ...(items.length > 0 ? { items } : {}) });
  }
  return out;
}
