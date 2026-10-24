import { ContainerC } from '../containers/components';
import { shipIdAt , shipIdOf } from '../regions';
import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { ItemStackC, StorageC, type HaulRef } from './components';
import { storageCount, storageSpace } from './storage';

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
    if (avail > 0) out.push({ ref: { kind: 'storage', id }, x: m.x, y: m.y, avail });
  }
  return out;
}

/** The unreserved source of `item` nearest to a point (ties: lower id). */
export function nearestSource(sim: Sim, shipId: number, item: string, at: { x: number; y: number }, res: Reservations): Located | null {
  let best: Located | null = null;
  let bestD = Infinity;
  for (const s of sourcesOf(sim, shipId, item, res)) {
    const d = dist2(s.x, s.y, at.x, at.y);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** The storage module nearest to a point that can still take at least one unit of `item`. */
export function nearestStorageFor(sim: Sim, shipId: number, item: string, at: { x: number; y: number }, res: Reservations): (Located & { room: number }) | null {
  let best: (Located & { room: number }) | null = null;
  let bestD = Infinity;
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || sim.world.has(id, ContainerC)) continue;
    const room = storageSpace(sim, id, item) - (res.incoming.get(refKey('storage', id, item)) ?? 0);
    const d = dist2(m.x, m.y, at.x, at.y);
    if (room > 0 && d < bestD) {
      best = { ref: { kind: 'storage', id }, x: m.x, y: m.y, avail: 0, room };
      bestD = d;
    }
  }
  return best;
}

/** Total stock of an item across all grids: loose stacks plus storage (not carried or delivered). */
export function totalStock(sim: Sim, item: string): number {
  let n = 0;
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === item) n += s.count;
  }
  for (const id of sim.world.query(StorageC)) n += storageCount(sim, id, item);
  return n;
}
