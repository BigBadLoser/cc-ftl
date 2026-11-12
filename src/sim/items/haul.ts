import { haulDeposited, haulPicked } from '../trade/dockCount';
import { JobC, PositionC, type Job } from '../crew/components';
import { jobGoal, origin } from '../crew/helpers';
import { reaches, startLabels, viewOf } from '../ai/navView';
import { siteWalkModes } from '../eva/route';
import type { WorkResult } from '../crew/jobWork';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { CarryingC, ItemStackC, type HaulData, type HaulRef } from './components';
import { deliverToJob } from './materials';
import { destroyJob, dropCarried, spillItems, takeFromStack } from './stacks';
import { storageAdd, storageTake } from './storage';
import { cargoAdd, cargoTake } from '../vehicles/cargo';
import { cargoTile } from '../vehicles/geometry';
import { shipIdOf } from '../regions';
import type { ItemQty } from '../registry';
import { GATHER_RADIUS } from '../tuning';
import { stageAdd, stageTile } from './staging';

/** Where the haul's destination is (module anchor, the target job's tile, the zone tile its item goes to), or null if it is gone. */
export function destinationTile(sim: Sim, job: Job): { x: number; y: number; size?: [number, number] } | null {
  const dst = job.haul?.dst;
  if (!dst) return null;
  if (dst.kind === 'vehicle') {
    const t = cargoTile(sim, dst.id, { x: job.x, y: job.y });
    return t && t.shipId === shipIdOf(sim, job) ? { x: t.x, y: t.y } : null;
  }
  if (dst.kind === 'zone') return dst.id === shipIdOf(sim, job) ? stageTile(sim, dst.id, job.haul!.item) : null;
  const at = dst.kind === 'job' ? sim.world.get(dst.id, JobC) : sim.world.get(dst.id, ModuleC);
  if (!at) return null;
  const size = dst.kind === 'job' ? (at as Job).size : undefined; // a job on a module site: crew deliver from any reachable side of it, not onto it
  return size ? { x: at.x, y: at.y, size } : { x: at.x, y: at.y };
}

/** Put units down at a haul's destination; returns how many went in (the rest stays in hand). */
function deposit(sim: Sim, dst: HaulRef, item: string, n: number): number {
  if (dst.kind === 'storage') return storageAdd(sim, dst.id, item, n);
  if (dst.kind === 'vehicle') return cargoAdd(sim, dst.id, item, n);
  if (dst.kind === 'zone') return stageAdd(sim, dst.id, item, n);
  const target = dst.kind === 'job' ? sim.world.get(dst.id, JobC) : undefined;
  return target ? deliverToJob(target, item, n) : 0;
}

/** Units a crew member holds, every item. */
const inHand = (sim: Sim, crew: number): number => {
  const c = sim.world.get(crew, CarryingC);
  return c ? c.count + (c.extra ?? []).reduce((n, q) => n + q.count, 0) : 0;
};

/** Add units to what a crew member holds (the same item joins its count; another goes in `extra`). */
function addToHand(sim: Sim, crew: number, item: string, n: number): void {
  const c = sim.world.get(crew, CarryingC);
  if (!c) return void sim.world.add(crew, CarryingC, { item, count: n });
  if (c.item === item) return void (c.count += n);
  const q = c.extra?.find((e) => e.item === item);
  if (q) q.count += n;
  else (c.extra ??= []).push({ item, count: n });
}

/** True if the crew member can walk to the goal now, the way they walk (components labelling, no search). */
function reachable(sim: Sim, crew: number, goal: { x: number; y: number; adjacent: boolean }): boolean {
  const pos = sim.world.get(crew, PositionC);
  const mode = pos && siteWalkModes(sim, crew, shipIdOf(sim, pos))[0];
  const v = mode && viewOf(sim, shipIdOf(sim, pos), mode.opts);
  if (!pos || !v) return false;
  const from = origin(pos);
  return reaches(v, from, startLabels(v, from), goal);
}

/**
 * Gathering: the haul of a loose stack the hauler would take next on this trip, or 0. Another haul of a loose stack to the same destination,
 * of the same work category, nobody holds it, within GATHER_RADIUS tiles and within the hauler's reach; the nearest (ties: lower id).
 */
function nextGather(sim: Sim, crew: number, job: Job): number {
  const h = job.haul as HaulData;
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return 0;
  const ship = shipIdOf(sim, pos);
  let best = 0, bestD = Infinity;
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC)!;
    const o = j.haul;
    if (!o || j.reservedBy !== 0 || j.category !== job.category || o.phase !== 'pickup' || o.src.kind !== 'floor' || o.then || o.extra || o.gathered) continue;
    if (o.dst.kind !== h.dst.kind || o.dst.id !== h.dst.id) continue;
    const st = sim.world.get(o.src.id, ItemStackC);
    const d = st ? Math.hypot(st.x - pos.toX, st.y - pos.toY) : Infinity;
    if (!st || d > GATHER_RADIUS || shipIdOf(sim, st) !== ship || d > bestD || (d === bestD && id > best)) continue;
    if (!reachable(sim, crew, jobGoal(j))) continue;
    best = id;
    bestD = d;
  }
  return best;
}

/**
 * One tick of a haul job with the crew member next to its current tile.
 * Pickup: take what the carry capacity allows (less what is already in hand), shrink the job to that. A loose stack with room left in hand
 * gathers: the nearest unheld haul of another loose stack to the same destination joins this trip (its stack becomes the next stop and its
 * job goes), so a hauler collects several stacks and walks to the destination once. Then the job is aimed at the destination with all
 * that is in hand.
 * Deliver: deposit everything carried; anything that no longer fits goes on to the next stop (`then`) or is dropped nearby.
 */
export function performHaul(sim: Sim, crew: number, job: Job): WorkResult {
  const h = job.haul;
  if (!h) return 'done';
  if (h.phase === 'pickup') {
    if (!h.gathered) dropCarried(sim, crew); // a fresh trip starts empty-handed
    const dest = destinationTile(sim, job);
    if (!dest) return 'done';
    const cap = Math.max(1, Math.floor(stat(sim, crew, 'carryCapacity')));
    const room = Math.max(0, cap - inHand(sim, crew));
    const want = Math.min(h.count, room);
    const asked = h.count;
    const taken = want <= 0 ? 0 : h.src.kind === 'floor' ? takeFromStack(sim, h.src.id, want)
      : h.src.kind === 'vehicle' ? cargoTake(sim, h.src.id, h.item, want)
      : storageTake(sim, h.src.id, h.item, want);
    if (taken <= 0 && !h.gathered) return 'done';
    haulPicked(sim, h, taken);
    if (h.src.kind === 'storage') {
      const extra: ItemQty[] = [];
      for (const q of h.extra ?? []) {
        const got = storageTake(sim, h.src.id, q.item, Math.min(q.count, cap));
        if (got > 0) extra.push({ item: q.item, count: got });
      }
      sim.world.add(crew, CarryingC, { item: h.item, count: taken, ...(extra.length > 0 ? { extra } : {}) });
    } else if (taken > 0) addToHand(sim, crew, h.item, taken);
    if (taken < asked) delete h.then; // the source held less than planned: no more stops
    if (h.src.kind === 'floor' && !h.then && !h.extra && inHand(sim, crew) < cap) {
      const next = nextGather(sim, crew, job);
      const nj = next ? sim.world.get(next, JobC) : undefined;
      if (nj?.haul) {
        const c = sim.world.get(crew, CarryingC)!;
        h.gathered = [{ item: c.item, count: c.count }, ...(c.extra ?? []).map((q) => ({ ...q }))];
        h.src = nj.haul.src;
        h.item = nj.haul.item;
        h.count = Math.min(nj.haul.count, cap - inHand(sim, crew));
        job.x = nj.x;
        job.y = nj.y;
        destroyJob(sim, next);
        return 'working';
      }
    }
    // To the destination with everything in hand (`item`/`count` and `extra` are now what is carried: the reservations at the destination).
    const c = sim.world.get(crew, CarryingC);
    if (!c) return 'done';
    h.item = c.item;
    h.count = c.count;
    if (c.extra) h.extra = c.extra.map((q) => ({ ...q }));
    else delete h.extra;
    delete h.gathered;
    h.phase = 'deliver';
    const to = destinationTile(sim, job) ?? dest;
    job.x = to.x;
    job.y = to.y;
    if (to.size) job.size = to.size;
    return 'working';
  }

  const carrying = sim.world.get(crew, CarryingC);
  const pos = sim.world.get(crew, PositionC);
  if (!carrying || carrying.item !== h.item || !pos) return 'done';
  const moved = deposit(sim, h.dst, h.item, carrying.count);
  haulDeposited(sim, h, carrying.count, moved);
  for (const q of carrying.extra ?? []) {
    const got = deposit(sim, h.dst, q.item, q.count);
    if (q.count > got) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, q.item, q.count - got);
    if (got > 0) sim.events.emit({ type: 'item.hauled', crew, item: q.item, count: got, ship: shipIdOf(sim, job), x: job.x, y: job.y, to: h.dst.kind });
  }
  if (moved > 0) {
    sim.events.emit({ type: 'item.hauled', crew, item: h.item, count: moved, ship: shipIdOf(sim, job), x: job.x, y: job.y, to: h.dst.kind });
  }
  // what is left goes on to the next job on the route
  const left = carrying.count - moved;
  while (left > 0 && h.then?.length) {
    const next = h.then.shift() as { job: number; count: number };
    const nj = sim.world.get(next.job, JobC);
    if (!nj) continue;
    h.dst = { kind: 'job', id: next.job };
    h.count = left;
    if (h.then.length === 0) delete h.then;
    carrying.count = left;
    delete carrying.extra;
    delete h.extra; // delivered above; reservations() must not count it at the next stop
    job.x = nj.x;
    job.y = nj.y;
    if (nj.size) job.size = nj.size;
    else delete job.size;
    return 'working';
  }
  if (left > 0) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, h.item, left);
  sim.world.remove(crew, CarryingC);
  return 'done';
}
