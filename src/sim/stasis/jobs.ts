import { CarryingC, ItemStackC } from '../items/components';
import { dropCarried } from '../items/stacks';
import { reservations, sourcesOf } from '../items/stock';
import { JobC, PositionC, type Job, type Position } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { origin } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { moduleSite } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { PrisonerC } from '../fight/components';
import { StasisC, StasisWheelC, type SlabSource, type StasisJob } from './components';
import { dropSlab, liftSlab, sealPrisoner, stowSlab, takeEmptySlab } from './freeze';
import { cartsFor, emptySlabsIn, freeSlots, fullSlabs, slabPlace, wheelHatch, wheelTakes } from './query';
import { SEAL_WORK, SLAB_ITEM } from './tuning';

/**
 * The 'stasis' job (#116): seal a prisoner into a stasis slab where they stand and cart the slab to a stasis wheel, or cart a slab lying on the
 * floor to one. The stasis system posts and keeps the jobs (stasis/system.ts); `performStasis` is the work at each stop.
 */

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y) ** 2;

/** A job's stop: a tile (worked from beside it), or a module footprint `size` worked from beside any of its tiles. */
interface Site { x: number; y: number; size?: [number, number] }

/** Where crew stand to take an empty slab from a source, or null when the source is gone. */
function sourceSite(sim: Sim, from: SlabSource): Site | null {
  if (from.kind === 'floor') {
    const st = sim.world.get(from.id, ItemStackC);
    return st ? { x: st.x, y: st.y } : null;
  }
  const m = sim.world.get(from.id, ModuleC);
  if (!m) return null;
  return from.kind === 'wheel' ? wheelHatch(sim, m) : moduleSite(sim.content.modules[m.def], m);
}

/** Fetch-phase stasis jobs headed for each source (`kind:id`), so two do not count on the same empty slab. */
function fetchClaims(sim: Sim): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of sim.world.query(JobC)) {
    const st = sim.world.get(id, JobC)?.stasis;
    if (st?.phase === 'fetch' && st.from) out.set(`${st.from.kind}:${st.from.id}`, (out.get(`${st.from.kind}:${st.from.id}`) ?? 0) + 1);
  }
  return out;
}

/** Every place on a ship an empty slab can be taken from now, with how many are not yet claimed: wheel slots, storage, loose stacks. */
export function slabSources(sim: Sim, ship: number): (Site & { from: SlabSource; avail: number })[] {
  const claims = fetchClaims(sim);
  const claimed = (f: SlabSource): number => claims.get(`${f.kind}:${f.id}`) ?? 0;
  const out: (Site & { from: SlabSource; avail: number })[] = [];
  for (const id of [...sim.world.query(StasisWheelC, ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    const from: SlabSource = { kind: 'wheel', id };
    const avail = emptySlabsIn(sim, id) - claimed(from);
    if (m && m.hp > 0 && shipIdOf(sim, m) === ship && avail > 0) out.push({ ...wheelHatch(sim, m), from, avail });
  }
  for (const s of sourcesOf(sim, ship, SLAB_ITEM, reservations(sim))) {
    if (s.ref.kind !== 'floor' && s.ref.kind !== 'storage') continue;
    const from: SlabSource = { kind: s.ref.kind, id: s.ref.id };
    const avail = s.avail - claimed(from);
    const site = sourceSite(sim, from);
    if (avail > 0 && site) out.push({ ...site, from, avail });
  }
  return out;
}

/** The unclaimed empty-slab source nearest to `at` on the ship (ties: wheels first, then lower id), or null. */
export function nearestSlabSource(sim: Sim, ship: number, at: { x: number; y: number }): (Site & { from: SlabSource }) | null {
  let best: (Site & { from: SlabSource }) | null = null;
  let bestD = Infinity;
  for (const s of slabSources(sim, ship)) {
    const d = dist2(s, at);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** The wheel on the ship a slab carted from `at` goes to: one that can take it, powered ones first, then the nearest hatch (ties: lower id). 0 for none. */
export function pickWheel(sim: Sim, ship: number, at: { x: number; y: number }): number {
  let best = 0;
  let bestKey = Infinity;
  for (const id of [...sim.world.query(StasisWheelC, ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== ship || !wheelTakes(sim, id)) continue;
    const h = wheelHatch(sim, m);
    const key = (m.powered ? 0 : 1e9) + dist2(h, at);
    if (key < bestKey) {
      best = id;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Wheel room on a ship not yet spoken for: slots of intact wheels not holding a full slab, minus slabs already headed for one (on a cart, or
 * with a pickup job) and seal jobs that will make one. The stasis system posts a job only while this is above 0.
 */
export function stasisRoom(sim: Sim, ship: number): number {
  let room = 0;
  for (const id of sim.world.query(StasisWheelC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && m.hp > 0 && shipIdOf(sim, m) === ship) room += freeSlots(sim, id);
  }
  for (const id of fullSlabs(sim)) {
    const p = slabPlace(sim, id);
    if (p?.kind === 'carried' && p.ship === ship) room--;
  }
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'stasis' && j.stasis?.phase !== 'stow' && shipIdOf(sim, j) === ship) room--;
  }
  return room;
}

/** Aim the job at a stop (clears the footprint size of the last one). */
function aim(job: Job, site: Site): void {
  job.x = site.x;
  job.y = site.y;
  if (site.size) job.size = site.size;
  else delete job.size;
}

/** Point a fetch at the nearest unclaimed source from `at`. False when there is none. */
export function aimFetch(sim: Sim, job: Job, st: StasisJob, ship: number, at: { x: number; y: number }): boolean {
  delete st.from; // not a claim of its own while it looks
  const src = nearestSlabSource(sim, ship, at);
  if (!src) return false;
  st.phase = 'fetch';
  st.from = src.from;
  aim(job, src);
  return true;
}

/** On to a wheel with the slab now on the cart; with none to take it, the slab is set down here and the job ends. */
function toWheel(sim: Sim, job: Job, st: StasisJob, prisoner: number, ship: number, me: Position): WorkResult {
  const wheel = pickWheel(sim, ship, origin(me));
  const m = sim.world.get(wheel, ModuleC);
  if (!m) {
    dropSlab(sim, prisoner, ship, origin(me));
    return 'done';
  }
  st.phase = 'stow';
  st.wheel = wheel;
  delete st.from;
  aim(job, wheelHatch(sim, m));
  return 'working';
}

/** One tick of a stasis job at its stop. `speed` is the crew member's work speed (it times the sealing). */
export function performStasis(sim: Sim, crew: number, job: Job, speed: number): WorkResult {
  const st = job.stasis;
  const prisoner = job.target ?? 0;
  const me = sim.world.get(crew, PositionC);
  if (!st || !me) return 'done';
  const ship = shipIdOf(sim, me);
  if (st.phase === 'fetch') {
    if (!st.from || !takeEmptySlab(sim, st.from)) return aimFetch(sim, job, st, ship, origin(me)) ? 'working' : 'done'; // taken meanwhile
    dropCarried(sim, crew);
    sim.world.add(crew, CarryingC, { item: SLAB_ITEM, count: 1 });
    const pos = sim.world.get(prisoner, PositionC);
    if (!pos) return 'done';
    st.phase = 'seal';
    delete st.from;
    aim(job, origin(pos));
    job.work = SEAL_WORK;
    job.progress = 0;
    return 'working';
  }
  if (st.phase === 'seal') {
    const pos = sim.world.get(prisoner, PositionC);
    if (!pos || !sim.world.has(prisoner, PrisonerC)) return 'done';
    if (sim.world.get(crew, CarryingC)?.item !== SLAB_ITEM) return aimFetch(sim, job, st, ship, origin(me)) ? 'working' : 'done'; // lost the slab
    const o = origin(pos);
    if (o.x !== job.x || o.y !== job.y) {
      aim(job, o);
      return 'working';
    }
    job.progress = Math.min(job.work, job.progress + speed);
    if (job.progress < job.work) return 'working';
    sim.world.remove(crew, CarryingC);
    sealPrisoner(sim, prisoner, crew);
    return toWheel(sim, job, st, prisoner, ship, me);
  }
  if (st.phase === 'pickup') {
    if (sim.world.get(prisoner, StasisC)?.at !== 'floor') return 'done';
    liftSlab(sim, prisoner, crew);
    return toWheel(sim, job, st, prisoner, ship, me);
  }
  if (!cartsFor(sim, crew, prisoner)) return 'done';
  if (st.wheel && wheelTakes(sim, st.wheel) && stowSlab(sim, prisoner, st.wheel) >= 0) {
    sim.events.emit({ type: 'stasis.stowed', crew: prisoner, wheel: st.wheel, ship });
    return 'done';
  }
  return toWheel(sim, job, st, prisoner, ship, me); // that wheel filled up meanwhile: the next one, or the floor
}
