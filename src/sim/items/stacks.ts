import { loadDropped } from '../trade/dockCount';
import { shipIdAt, shipGrid } from '../regions';
import { abortTask } from '../ai/task';
import { CrewC, JobC, PositionC } from '../crew/components';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { DECON_REFUND } from '../tuning';
import { CarryingC, ItemStackC } from './components';
import { shipIdOf } from '../regions';

const SPILL_RADIUS = 6;
/** Fallback when content has no def for an item id. */
const UNKNOWN_STACK_SIZE = 50;

export function stackSizeOf(sim: Sim, item: string): number {
  return sim.content.items[item]?.stackSize ?? UNKNOWN_STACK_SIZE;
}

/**
 * Crates: a loose stack is drawn as one crate per twelfth of the item's stack size (render/stackSlots.ts lays them out), and a shuttle
 * loads a staging stack one crate at a time (items/staging.ts). The one place this unit is defined.
 */
export const STACK_CRATES = 12;

/** Crates a stack of `count` shows: one per twelfth of a full stack, rounded up (any stack shows at least one), at most STACK_CRATES. */
export function crateCount(count: number, stackSize: number): number {
  if (count <= 0) return 0;
  return Math.min(STACK_CRATES, Math.max(1, Math.ceil((count / Math.max(1, stackSize)) * STACK_CRATES)));
}

/** Item units in one crate of an item (a twelfth of its stack size, rounded up). */
export function crateUnits(sim: Sim, item: string): number {
  return Math.max(1, Math.ceil(stackSizeOf(sim, item) / STACK_CRATES));
}

/** A job's sealed cargo (ItemDef.cargo): left where it lies. */
export const isCargo = (sim: Sim, item: string): boolean => !!sim.content.items[item]?.cargo;

/** Entity id of the loose stack on a tile, or 0. */
export function stackAt(sim: Sim, shipId: number, x: number, y: number): number {
  const grid = shipGrid(sim, shipId);
  return grid?.has('item') && grid.inBounds(x, y) ? grid.get('item', x, y) : 0;
}

/** Offsets within `r` tiles ordered by distance, then row, then column (deterministic). */
const SPIRAL: { dx: number; dy: number }[] = [];
for (let dy = -SPILL_RADIUS; dy <= SPILL_RADIUS; dy++) {
  for (let dx = -SPILL_RADIUS; dx <= SPILL_RADIUS; dx++) SPIRAL.push({ dx, dy });
}
SPIRAL.sort((a, b) => (a.dx ** 2 + a.dy ** 2) - (b.dx ** 2 + b.dy ** 2) || a.dy - b.dy || a.dx - b.dx);

/** True if goods can lie on the tile: bare floor or open ground, no module (one stack per tile, `item` field). */
export function holdsGoods(grid: NonNullable<ReturnType<typeof shipGrid>>, x: number, y: number): boolean {
  if (!grid.inBounds(x, y)) return false;
  const kind = grid.get('struct', x, y);
  return (kind === Struct.Floor || kind === Struct.Ground) && (!grid.has('module') || grid.get('module', x, y) === 0);
}

/**
 * Put items on the floor at the nearest tile with room: bare floor or open ground (no module, no door) that is
 * empty or holds the same item below its stack size. Returns how many units found no room (lost). `job`: new stacks are that delivery's crate.
 */
export function spillItems(sim: Sim, shipId: number, x: number, y: number, item: string, count: number, job?: number): number {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('item')) return count;
  const max = stackSizeOf(sim, item);
  let left = count;
  for (const { dx, dy } of SPIRAL) {
    if (left <= 0) break;
    const tx = x + dx;
    const ty = y + dy;
    if (!grid.inBounds(tx, ty)) continue;
    if (!holdsGoods(grid, tx, ty)) continue;
    const existing = grid.get('item', tx, ty);
    const stack = existing ? sim.world.get(existing, ItemStackC) : undefined;
    if (stack) {
      if (stack.item !== item || stack.count >= max) continue;
      const add = Math.min(left, max - stack.count);
      stack.count += add;
      left -= add;
    } else {
      const add = Math.min(left, max);
      const id = sim.world.createEntity();
      sim.world.add(id, ItemStackC, job === undefined ? { item, count: add, x: tx, y: ty } : { item, count: add, x: tx, y: ty, job });
      grid.set('item', tx, ty, id);
      left -= add;
    }
  }
  return left;
}

/** Remove up to `n` units from a floor stack, deleting it when empty. Returns the units taken. */
export function takeFromStack(sim: Sim, stackId: number, n: number): number {
  const s = sim.world.get(stackId, ItemStackC);
  if (!s) return 0;
  const take = Math.min(n, s.count);
  s.count -= take;
  if (s.count <= 0) {
    const grid = shipGrid(sim, shipIdAt(sim, s.x, s.y));
    if (grid?.has('item') && grid.get('item', s.x, s.y) === stackId) grid.set('item', s.x, s.y, 0);
    sim.world.destroyEntity(stackId);
  }
  return take;
}

/** Move a stack off a tile that just became unusable (wall built, module placed) to the nearest free one. */
export function evictStack(sim: Sim, shipId: number, x: number, y: number): void {
  const id = stackAt(sim, shipId, x, y);
  const s = id ? sim.world.get(id, ItemStackC) : undefined;
  if (!s) return;
  const { item, count, job } = s;
  takeFromStack(sim, id, count);
  spillItems(sim, shipId, x, y, item, count, job);
}

/** A crew member puts down whatever they carry, at their feet or the nearest free tile. */
export function dropCarried(sim: Sim, crew: number): void {
  const c = sim.world.get(crew, CarryingC);
  if (!c) return;
  sim.world.remove(crew, CarryingC);
  const p = sim.world.get(crew, PositionC);
  if (p && sim.world.has(crew, CrewC)) {
    const unplaced = spillItems(sim, shipIdOf(sim, p), p.toX, p.toY, c.item, c.count);
    loadDropped(sim, c, c.count - unplaced);
    for (const q of c.extra ?? []) spillItems(sim, shipIdOf(sim, p), p.toX, p.toY, q.item, q.count);
  }
}

/** Drop a cost list scaled by DECON_REFUND (rounded down) on or near a tile. */
export function refundCost(sim: Sim, shipId: number, x: number, y: number, cost: ItemQty[] | undefined): void {
  for (const q of cost ?? []) {
    const n = Math.floor(q.count * DECON_REFUND);
    if (n > 0) spillItems(sim, shipId, x, y, q.item, n);
  }
}

/** Remove a job for good: delivered materials fall to the floor, its crew member is released. */
export function destroyJob(sim: Sim, jobId: number): void {
  const job = sim.world.get(jobId, JobC);
  if (!job) return;
  for (const q of job.delivered ?? []) spillItems(sim, shipIdOf(sim, job), job.x, job.y, q.item, q.count);
  job.delivered = [];
  if (job.reservedBy) abortTask(sim, job.reservedBy, 'cancelled');
  sim.world.destroyEntity(jobId);
}

/** Cost-table key for a struct kind, or undefined for kinds with no cost (Space). */
export function structCostKey(kind: number): string | undefined {
  return kind === Struct.Floor ? 'floor' : kind === Struct.Wall ? 'wall' : kind === Struct.Door ? 'door' : undefined;
}
