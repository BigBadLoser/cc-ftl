import { reaches, startLabels, viewOf } from '../ai/navView';
import { shipGrid, shipIdAt } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { cargoAdd, cargoSpace } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { ItemStackC, StagingC, type ItemStack, type Staging } from './components';
import { crateUnits, stackSizeOf, takeFromStack } from './stacks';
import { refKey, type Reservations } from './stock';

/**
 * Staging zones (`StagingC`, docs/ARCHITECTURE.md "Away sites and the air drive", "Staging"): floor tiles on a ship where haulers gather
 * loose goods for a shuttle, which loads them a crate at a time. A haul into a zone is an ordinary haul with a `{kind: 'zone', id: ship}`
 * destination; its reservation is the haul job itself (items/stock.ts), released when the job ends. One stack per tile: a full stack
 * overflows to the next tile of the zone, in the zone's tile order.
 */

/** True if goods can lie on the tile: bare floor or open ground, no module (the rule `spillItems` puts stacks down by). */
function stackable(grid: NonNullable<ReturnType<typeof shipGrid>>, x: number, y: number): boolean {
  if (!grid.inBounds(x, y)) return false;
  const kind = grid.get('struct', x, y);
  return (kind === Struct.Floor || kind === Struct.Ground) && (!grid.has('module') || grid.get('module', x, y) === 0);
}

/**
 * The `n` tiles of the ship nearest to `at` (ties: row, then column) where goods can lie and that a suited walker at `at` can walk to
 * (the scheduler's labelling, no search: a hovering shuttle's hatch spot is outside the hull), `at` itself left clear (people come and go
 * there). Fewer when the ship has fewer within reach.
 */
export function zoneTilesNear(sim: Sim, ship: number, at: { x: number; y: number }, n: number): { x: number; y: number }[] {
  const grid = shipGrid(sim, ship);
  const v = grid?.has('struct') ? viewOf(sim, ship, { suited: true }) : null;
  if (!grid || !v) return [];
  const starts = startLabels(v, at);
  const all: { x: number; y: number; d: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if ((x === at.x && y === at.y) || grid.get('ship', x, y) !== ship || !stackable(grid, x, y)) continue;
      all.push({ x, y, d: (x - at.x) ** 2 + (y - at.y) ** 2 });
    }
  }
  all.sort((p, q) => p.d - q.d || p.y - q.y || p.x - q.x);
  const out: { x: number; y: number }[] = [];
  for (const t of all) {
    if (out.length >= n) break;
    if (reaches(v, at, starts, { x: t.x, y: t.y })) out.push({ x: t.x, y: t.y });
  }
  return out;
}

/** True while every tile of the zone can still hold goods (a tile stripped or built on makes the zone stale). */
export function zoneIntact(sim: Sim, ship: number, z: Staging): boolean {
  const grid = shipGrid(sim, ship);
  return !!grid && z.tiles.length > 0 && z.tiles.every((t) => stackable(grid, t.x, t.y));
}

/** True if the stack lies on a tile of its ship's staging zone. */
export function isStaged(sim: Sim, s: ItemStack): boolean {
  const z = sim.world.get(shipIdAt(sim, s.x, s.y), StagingC);
  return !!z && z.tiles.some((t) => t.x === s.x && t.y === s.y);
}

/** The stacks lying in a ship's staging zone, in its tile order. */
export function stagedStacks(sim: Sim, ship: number): number[] {
  const z = sim.world.get(ship, StagingC);
  const grid = shipGrid(sim, ship);
  if (!z || !grid?.has('item')) return [];
  return z.tiles.map((t) => (grid.inBounds(t.x, t.y) ? grid.get('item', t.x, t.y) : 0)).filter((id) => id !== 0 && sim.world.has(id, ItemStackC));
}

/** Units lying in the zone. */
export const stagedUnits = (sim: Sim, ship: number): number => stagedStacks(sim, ship).reduce((n, id) => n + (sim.world.get(id, ItemStackC)?.count ?? 0), 0);

/**
 * Units of `item` the zone can still take: its room under `cap` (less what pending hauls bring, any item), and the room its tiles have for
 * this item (the part of a full stack its stacks of it lack, a full stack on each empty tile, less what pending hauls bring of it).
 */
export function stagingRoom(sim: Sim, ship: number, item: string, res: Reservations): number {
  const z = sim.world.get(ship, StagingC);
  const grid = shipGrid(sim, ship);
  if (!z || !grid?.has('item')) return 0;
  let coming = 0;
  for (const [k, n] of res.incoming) if (k.startsWith(`zone:${ship}:`)) coming += n;
  const max = stackSizeOf(sim, item);
  let tiles = 0;
  for (const t of z.tiles) {
    if (!stackable(grid, t.x, t.y)) continue;
    const s = sim.world.get(grid.get('item', t.x, t.y), ItemStackC);
    if (!s) tiles += max;
    else if (s.item === item && !s.job) tiles += Math.max(0, max - s.count);
  }
  tiles -= res.incoming.get(refKey('zone', ship, item)) ?? 0;
  return Math.max(0, Math.min(z.cap - stagedUnits(sim, ship) - coming, tiles));
}

/** The zone tile a load of `item` goes to: the first stack of it with room, else the first empty tile. Null when it has none. */
export function stageTile(sim: Sim, ship: number, item: string): { x: number; y: number } | null {
  const z = sim.world.get(ship, StagingC);
  const grid = shipGrid(sim, ship);
  if (!z || !grid?.has('item')) return null;
  const max = stackSizeOf(sim, item);
  const open = z.tiles.filter((t) => stackable(grid, t.x, t.y));
  const stack = (t: { x: number; y: number }): ItemStack | undefined => sim.world.get(grid.get('item', t.x, t.y), ItemStackC);
  return open.find((t) => stack(t)?.item === item && !stack(t)?.job && stack(t)!.count < max) ?? open.find((t) => !stack(t)) ?? null;
}

/** Put units of `item` down in the zone: onto its stacks of it with room, then onto empty tiles, a full stack each. Returns how many went. */
export function stageAdd(sim: Sim, ship: number, item: string, n: number): number {
  const grid = shipGrid(sim, ship);
  let left = n;
  while (left > 0 && grid?.has('item')) {
    const t = stageTile(sim, ship, item);
    if (!t) break;
    const max = stackSizeOf(sim, item);
    const s = sim.world.get(grid.get('item', t.x, t.y), ItemStackC);
    const add = Math.min(left, max - (s?.count ?? 0));
    if (s) s.count += add;
    else {
      const id = sim.world.createEntity();
      sim.world.add(id, ItemStackC, { item, count: add, x: t.x, y: t.y });
      grid.set('item', t.x, t.y, id);
    }
    left -= add;
  }
  return n - left;
}

/** Load one crate from the zone into a shuttle's hold (the first staged stack; what the hold has room for). Returns the units moved. */
export function loadCrate(sim: Sim, ship: number, vehicle: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v || cargoSpace(sim, v) <= 0) return 0;
  const id = stagedStacks(sim, ship)[0];
  const s = id ? sim.world.get(id, ItemStackC) : undefined;
  if (!id || !s) return 0;
  const { item } = s;
  const got = takeFromStack(sim, id, Math.min(crateUnits(sim, item), cargoSpace(sim, v)));
  return cargoAdd(sim, vehicle, item, got);
}
