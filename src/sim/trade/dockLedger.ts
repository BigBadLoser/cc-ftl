import { AssignmentC, JobC } from '../crew/components';
import { stowOrDrop } from '../items/deck';
import { CarryingC } from '../items/components';
import { destroyJob } from '../items/stacks';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { cargoOf } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { playerShip } from './player';
import type { Deal } from './types';

/**
 * The exact units a docked station deal has moved (`Deal.dock`), so a deal that ends early moves only its own goods and never the station's unrelated
 * stock of the same item. `staged`: the bought goods set into station storage; `direct`: bought units `stageGoods` put straight into the hold (never in storage).
 * `hand`: units station crew were carrying for the deal when it ended (taken from their hands by `takeCarried`). `seen`: per item, the most of a bought item the shuttle's hold has
 * held (so the rest is still staged) or the least of a given item (so the rest left the hold toward the station). Updated every station-work tick.
 */

/** Note the shuttle's hold: the high mark of each bought item, the low mark of each given item. */
export function noteHolds(sim: Sim, d: Deal): void {
  const dock = d.dock;
  if (!dock) return;
  noteCarrying(sim, d);
  const seen = (dock.seen ??= {});
  for (const l of d.get) seen[l.item] = Math.max(seen[l.item] ?? 0, cargoOf(sim, d.vehicle, l.item));
  for (const l of d.give) if (!d.get.some((g) => g.item === l.item)) seen[l.item] = Math.min(seen[l.item] ?? l.count, cargoOf(sim, d.vehicle, l.item));
}

/** The exchange is done: nothing of this deal is staged or in motion any more (what is left of it is the trader's or the player's already). */
export function settleDock(d: Deal): void {
  if (!d.dock) return;
  d.dock.staged = [];
  d.dock.seen = {};
}

/** Record units `stageGoods` put straight into the hold. */
export function noteDirect(d: Deal, item: string, count: number): void {
  if (!d.dock || count <= 0) return;
  const direct = (d.dock.direct ??= {});
  direct[item] = (direct[item] ?? 0) + count;
}

type Bucket = 'get' | 'give';
interface Hauler { crew: number; job: number | undefined; bucket: Bucket; count: number; item: string }

/** Station crew carrying the deal's goods: bought goods heading into the hold (`get`), the player's goods heading into storage (`give`). */
function haulers(sim: Sim, d: Deal): Hauler[] {
  const out: Hauler[] = [];
  for (const crew of sim.world.query(CarryingC)) {
    const c = sim.world.get(crew, CarryingC);
    const job = sim.world.get(crew, AssignmentC)?.jobId;
    const h = job === undefined ? undefined : sim.world.get(job, JobC)?.haul;
    if (!c || !h || h.phase !== 'deliver' || c.item !== h.item) continue;
    const bucket: Bucket | null = h.dst.kind === 'vehicle' && h.dst.id === d.vehicle ? 'get' : h.src.kind === 'vehicle' && h.src.id === d.vehicle ? 'give' : null;
    if (bucket) out.push({ crew, job, bucket, count: c.count, item: c.item });
  }
  return out;
}

/**
 * Take the deal's goods out of the hands of station crew mid-haul (their jobs end): bought goods heading into the hold left storage already, the
 * player's given goods heading into storage left the hold already. The counts are kept on `dock.hand`. A shuttle lost this tick has already taken the
 * hauls' jobs with it, so the hands are read from the last station-work tick's snapshot (`dock.carrying`) and the empty-jobbed carriers it names.
 */
export function takeCarried(sim: Sim, d: Deal): void {
  const dock = d.dock;
  if (!dock) return;
  const hand = (dock.hand ??= { get: {}, give: {} });
  const strip = (crew: number, bucket: Bucket, item: string, count: number): void => {
    hand[bucket][item] = (hand[bucket][item] ?? 0) + count;
    sim.world.remove(crew, CarryingC);
  };
  for (const h of haulers(sim, d)) {
    strip(h.crew, h.bucket, h.item, h.count);
    if (h.job !== undefined) destroyJob(sim, h.job);
  }
  const snap = dock.carrying;
  delete dock.carrying;
  if (!snap) return;
  for (const bucket of ['get', 'give'] as const) {
    for (const [item, want] of Object.entries(snap[bucket])) {
      let left = want - (hand[bucket][item] ?? 0);
      for (const crew of [...sim.world.query(CarryingC)]) {
        const c = sim.world.get(crew, CarryingC);
        const job = sim.world.get(crew, AssignmentC)?.jobId;
        if (left <= 0 || !c || c.item !== item || (job !== undefined && sim.world.has(job, JobC))) continue; // only one whose haul is gone
        left -= c.count;
        strip(crew, bucket, item, c.count);
      }
    }
  }
}

/** Remember what station crew are carrying for the deal (read again if the shuttle is lost before the next look). */
function noteCarrying(sim: Sim, d: Deal): void {
  if (!d.dock) return;
  const snap = { get: {} as Record<string, number>, give: {} as Record<string, number> };
  for (const h of haulers(sim, d)) snap[h.bucket][h.item] = (snap[h.bucket][h.item] ?? 0) + h.count;
  d.dock.carrying = snap;
}

/** Units of a bought item still on the shelf: staged, less what left storage (reached the hold, or is in a crew member's hands). */
const stillStaged = (d: Deal, item: string): number => {
  const gone = Math.max(0, (d.dock?.seen?.[item] ?? 0) - (d.dock?.direct?.[item] ?? 0)) + (d.dock?.hand?.get[item] ?? 0);
  return (d.dock?.staged ?? []).filter((s) => s.item === item).reduce((n, s) => n + s.count, 0) - gone;
};

/** Take this deal's still-staged bought goods back out of station storage (they return to the trader's stock). Only those units. */
export function unstage(sim: Sim, d: Deal): void {
  if (!d.dock) return;
  takeCarried(sim, d);
  const left = new Map<string, number>();
  for (const l of d.get) left.set(l.item, Math.max(0, stillStaged(d, l.item)));
  for (const s of d.dock.staged) {
    const n = Math.min(s.count, left.get(s.item) ?? 0);
    if (n <= 0) continue;
    storageTake(sim, s.storage, s.item, n);
    left.set(s.item, (left.get(s.item) ?? 0) - n);
  }
  d.dock.staged = [];
  if (d.dock.hand) d.dock.hand.get = {};
}

/** Bought units that were in a lost shuttle's hold: they are gone with it (the trader's stock does not get them back). */
export function lostInHold(sim: Sim, d: Deal, item: string): number {
  return sim.world.has(d.vehicle, VehicleC) ? 0 : d.dock?.seen?.[item] ?? 0;
}

/**
 * A shuttle lost at the station after crew hauled the player's given goods into station storage: those goods go back to the player's ship (never
 * both refunded and kept by the station). Only the units the hold gave up, and only as many as the station still holds.
 */
export function returnGiven(sim: Sim, d: Deal): void {
  if (!d.dock || sim.world.has(d.vehicle, VehicleC)) return;
  takeCarried(sim, d);
  for (const l of d.give) {
    if (d.get.some((g) => g.item === l.item)) continue;
    const carried = d.dock.hand?.give[l.item] ?? 0; // still in a crew member's hands: not in storage, returned from there
    let left = l.count - (d.dock.seen?.[l.item] ?? l.count) - carried;
    let back = carried;
    for (const id of sim.world.query(ModuleC)) {
      if (left <= 0) break;
      if (shipIdOf(sim, sim.world.get(id, ModuleC)) !== d.ship || storageCount(sim, id, l.item) <= 0) continue;
      const n = storageTake(sim, id, l.item, left);
      left -= n;
      back += n;
    }
    if (back > 0) stowOrDrop(sim, playerShip(sim), l.item, back);
  }
  if (d.dock.hand) d.dock.hand.give = {};
}
