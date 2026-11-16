import { goalTiles, reaches, startLabels, viewOf } from '../ai/navView';
import { ShipC } from '../combat/components';
import { ContainerC } from '../containers/components';
import { shipIdAt , shipIdOf } from '../regions';
import { JobC } from '../crew/components';
import { jobGoal } from '../crew/helpers';
import { ModuleC, type Module } from '../modules/components';
import { moduleSite } from '../modules/footprint';
import type { Sim } from '../sim';
import { ItemStackC, StorageC, type HaulRef } from './components';
import { storageCount, storageSpace, storageTake } from './storage';

/**
 * The item index: where stock is, how much of it is spoken for. Not a system; planners call it.
 * Reservations are never stored: they are derived from the pending haul jobs, so a cancelled job
 * releases its reservation by simply no longer existing.
 */
export interface Reservations {
  /** Units a pending 'pickup' haul will take from a source, by `refKey`. */
  out: Map<string, number>;
  /** Units pending hauls will deliver to a destination, by `refKey`. */
  incoming: Map<string, number>;
}

export interface Located {
  ref: HaulRef;
  x: number;
  y: number;
  /** Units free to claim (stock minus reservations). */
  avail: number;
  /** A storage module's rotated footprint, worked from beside any side (`storageStop`). */
  size?: [number, number];
}

/**
 * Where a haul stops at a storage module: the module's site (`moduleSite`: its anchor and rotated footprint), so crew put in and take out from
 * beside any side of it, as every job aimed at a module is worked. The anchor alone would need that one corner reachable: a pallet whose
 * anchor corner is walled in could never be emptied (#488).
 */
export function storageStop(sim: Sim, m: Module): { x: number; y: number; size?: [number, number] } {
  return moduleSite(sim.content.modules[m.def], m);
}

export const refKey = (kind: string, id: number, item: string): string => `${kind}:${id}:${item}`;

const bump = (m: Map<string, number>, k: string, n: number): void => void m.set(k, (m.get(k) ?? 0) + n);

/** Snapshot every pending haul's claims on sources and destinations. */
export function reservations(sim: Sim): Reservations {
  const res: Reservations = { out: new Map(), incoming: new Map() };
  for (const id of sim.world.query(JobC)) {
    const h = sim.world.get(id, JobC)?.haul;
    if (!h) continue;
    if (h.phase === 'pickup') bump(res.out, refKey(h.src.kind, h.src.id, h.item), h.count);
    const later = (h.then ?? []).reduce((n, t) => n + t.count, 0);
    bump(res.incoming, refKey(h.dst.kind, h.dst.id, h.item), h.count - later);
    for (const t of h.then ?? []) bump(res.incoming, refKey('job', t.job, h.item), t.count);
    for (const q of h.extra ?? []) {
      if (h.phase === 'pickup') bump(res.out, refKey(h.src.kind, h.src.id, q.item), q.count);
      bump(res.incoming, refKey(h.dst.kind, h.dst.id, q.item), q.count);
    }
    for (const q of h.gathered ?? []) bump(res.incoming, refKey(h.dst.kind, h.dst.id, q.item), q.count); // in hand, on its way
  }
  return res;
}

const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

/** Every unreserved source of `item` on a grid: loose stacks and storage contents. */
export function sourcesOf(sim: Sim, shipId: number, item: string, res: Reservations): Located[] {
  const out: Located[] = [];
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (!s || s.item !== item || shipIdAt(sim, s.x, s.y) !== shipId) continue;
    const avail = s.count - (res.out.get(refKey('floor', id, item)) ?? 0);
    if (avail > 0) out.push({ ref: { kind: 'floor', id }, x: s.x, y: s.y, avail });
  }
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    // Sealed containers are never reached by crew (their stock moves by unloader or shuttle, later).
    if (!m || shipIdOf(sim, m) !== shipId || sim.world.has(id, ContainerC)) continue;
    const avail = storageCount(sim, id, item) - (res.out.get(refKey('storage', id, item)) ?? 0);
    if (avail > 0) out.push({ ref: { kind: 'storage', id }, ...storageStop(sim, m), avail });
  }
  return out;
}

/** Units of `item` the planners could still claim on a ship: every unreserved source (loose stacks and storage), as `sourcesOf` finds them. */
export function claimableCount(sim: Sim, shipId: number, item: string, res: Reservations): number {
  return sourcesOf(sim, shipId, item, res).reduce((n, s) => n + s.avail, 0);
}

/**
 * The unreserved source of `item` nearest to a point (ties: lower id). With `carry`, the point is also the haul stop the load goes to (a docked
 * hold's cargo tile, a job with its `size`), and only a source whose load can be carried there counts (`canCarry`): a planner must not post a
 * haul nobody can ever claim, as `nearestStorageFor` will not send one to storage nobody can get to (#488).
 */
export function nearestSource(
  sim: Sim, shipId: number, item: string, at: { x: number; y: number; size?: [number, number] }, res: Reservations, carry = false,
): Located | null {
  const found = sourcesOf(sim, shipId, item, res).map((s) => ({ s, d: dist2(s.x, s.y, at.x, at.y) }));
  found.sort((a, b) => a.d - b.d); // stable: ties keep the order sourcesOf found them in, as before
  return found.find((f) => !carry || canCarry(sim, shipId, f.s, at))?.s ?? null; // nearest first: the labelling is checked only until one reaches
}

/**
 * True when a load lying at `from` can be carried on foot to a haul stop at `to` (where a haul job is aimed: a storage module's site, `storageStop`,
 * a job's tile, each with its `size`): the walker stands on or beside `from` (beside any side of it, with a `size`) and ends beside `to`, the
 * widest way crew walk (suited: the deck and the hull, as `zoneTilesNear` asks), so a load out on the hull still has somewhere to go. Components labelling, no search (#476: a planner must not
 * send a load to storage nobody can get to; the carrier's own way is checked again at pickup, `performHaul`).
 */
export function canCarry(
  sim: Sim, shipId: number, from: { x: number; y: number; size?: [number, number] }, to: { x: number; y: number; size?: [number, number] },
): boolean {
  const v = viewOf(sim, shipId, { suited: true });
  if (!v) return false;
  // A load in a storage module (`from` with its footprint) is taken out from beside any side of it, as `storageStop` puts the haul.
  const starts = from.size ? [...new Set(goalTiles(v, jobGoal({ kind: 'haul', ...from })).map((i) => v.label[i] as number))] : startLabels(v, from);
  return reaches(v, from, starts, jobGoal({ kind: 'haul', ...to }));
}

/** The storage module nearest to a point that can still take at least one unit of `item` and that a load at that point can be carried to (`canCarry`). */
export function nearestStorageFor(sim: Sim, shipId: number, item: string, at: { x: number; y: number }, res: Reservations): (Located & { room: number }) | null {
  const found: { id: number; m: { x: number; y: number; size?: [number, number] }; room: number; d: number }[] = [];
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || sim.world.has(id, ContainerC)) continue;
    const room = storageSpace(sim, id, item) - (res.incoming.get(refKey('storage', id, item)) ?? 0);
    if (room > 0) found.push({ id, m: storageStop(sim, m), room, d: dist2(m.x, m.y, at.x, at.y) });
  }
  found.sort((a, b) => a.d - b.d); // stable: ties keep query order, as before
  const best = found.find((f) => canCarry(sim, shipId, at, f.m)); // nearest first: the labelling is checked only until one reaches
  return best ? { ref: { kind: 'storage', id: best.id }, ...best.m, avail: 0, room: best.room } : null;
}

/**
 * Stock of an item on the player's own ships (home ship, claimed bases, prizes): loose stacks plus storage, not carried or
 * delivered. Other ships' and stations' stock is not ours: a docked station's crates must not satisfy a 'keep' order.
 */
export function totalStock(sim: Sim, item: string): number {
  const ours = (shipId: number): boolean => sim.world.get(shipId, ShipC)?.faction === 'player';
  let n = 0;
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === item && ours(shipIdAt(sim, s.x, s.y))) n += s.count;
  }
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && ours(shipIdOf(sim, m))) n += storageCount(sim, id, item);
  }
  return n;
}

/** Storage modules of one ship crew can reach (not sealed containers), ascending id. */
export function shipStorages(sim: Sim, shipId: number): number[] {
  return sim.world.query(StorageC, ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && shipIdOf(sim, m) === shipId && !sim.world.has(id, ContainerC);
  }).sort((a, b) => a - b);
}

/** Units of an item in one ship's stores (storage modules, not floor stacks). */
export function shipStoreCount(sim: Sim, shipId: number, item: string): number {
  return shipStorages(sim, shipId).reduce((n, id) => n + storageCount(sim, id, item), 0);
}

/**
 * Draw units of an item straight out of one ship's stores, as a module piped to them would (life support's bottled oxygen): no haul.
 * Returns how many came out.
 */
export function drawFromStores(sim: Sim, shipId: number, item: string, count: number): number {
  let got = 0;
  for (const id of shipStorages(sim, shipId)) {
    if (got >= count) break;
    got += storageTake(sim, id, item, count - got);
  }
  return got;
}
