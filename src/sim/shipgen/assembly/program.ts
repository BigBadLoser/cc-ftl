import type { Rng } from '../../rng';
import { shuffle } from '../civilKit';
import { allRooms, dockSpec, type RoomSpec, type ShipPlan } from '../plan';
import { reactorRooms } from '../stationKit';

/**
 * A station's rooms as the assembly takes them: the plan's rooms (`stationPlan.ts`) with its reactors and the two
 * standard docks, the crate rooms merged into warehouses, and the shared rooms every station has.
 */

/** Crates a warehouse holds at most; more make a second one. */
const WAREHOUSE = 24;

/** The plan's cargo rooms merged into warehouses: a few large rectangles for aisles of racks, in place of many small crate rooms. */
export function warehoused(rooms: readonly RoomSpec[]): RoomSpec[] {
  const cargo = rooms.filter((r) => r.role === 'cargo');
  if (cargo.length < 2) return [...rooms];
  const mods = cargo.flatMap((r) => r.mods), items = cargo.flatMap((r) => r.items ?? []);
  const k = Math.max(1, Math.ceil(mods.length / WAREHOUSE));
  const area = cargo.reduce((t, r) => t + r.w * r.h, 0) / k;
  const out: RoomSpec[] = rooms.filter((r) => !cargo.includes(r));
  for (let i = 0; i < k; i++) {
    const mine = items.filter((_, j) => j % k === i);
    // Wide and shallow (about 8:5), at least five deep for two aisles of racks.
    const h = Math.max(5, Math.round(Math.sqrt(area / 1.6)));
    out.push({ role: 'cargo', mods: mods.filter((_, j) => j % k === i), w: Math.max(h, Math.ceil(area / h)), h, stock: true, warehouse: true, ...(mine.length > 0 ? { items: mine } : {}) });
  }
  return out;
}

/**
 * The shared rooms: a mess (a galley and a game table; two at hub size) and, from station size up, a rec room (arcade
 * cabinets and a game table). They are the commons department.
 */
export function commonRooms(size: number): RoomSpec[] {
  const mess = (): RoomSpec => ({ role: 'support', dept: 'commons', mods: ['module.galley', 'module.gametable'], w: 6, h: 4 });
  const rec: RoomSpec = { role: 'support', dept: 'commons', mods: ['module.arcade', 'module.arcade', 'module.gametable'], w: 5, h: 4 };
  return [mess(), ...(size >= 3 ? [mess()] : []), ...(size >= 2 ? [rec] : [])];
}

/** Every room of a station plan, for `assemble`. */
export function stationProgram(rng: Rng, plan: ShipPlan): RoomSpec[] {
  const rest = shuffle(rng, [...allRooms(plan).filter((r) => r !== plan.command), ...reactorRooms(plan.reactors), dockSpec(), dockSpec()]);
  return [...warehoused([plan.command, ...rest]), ...commonRooms(plan.size)];
}
