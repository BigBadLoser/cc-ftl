import { CarryingC, ItemStackC } from '../items/components';
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
import { dropSlab, liftSlab, rackSlab, sealPrisoner, stowSlab, takeSlabFor, unstowSlab } from './freeze';
import { rackEmpty, rackFull, rackHere, rackRoom, rackTile, siteShuttle } from './rack';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { isFerryRegion } from '../ferry/pick';
import { findPath, type Tile } from '../crew/pathfind';
import { cartsFor, emptySlabsIn, freeSlots, fullSlabs, slabPlace, wheelHatch, wheelTakes } from './query';
import { turnRing, turnsToLoad, turnsToUnload, stowWork } from './ring';
import { SEAL_WORK, SLAB_ITEM, TURN_STEP_WORK, UNSTOW_LIFT, UNSTOW_WORK } from './tuning';

/**
 * The 'stasis' job (#116): seal a prisoner into a stasis slab where they stand and cart the slab to a stasis wheel, or cart a slab lying on the
 * floor to one. The stasis system posts and keeps the jobs (stasis/system.ts); `performStasis` is the work at each stop.
 */

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y) ** 2;

/** A job's stop: a tile (worked from beside it), or a module footprint `size` worked from beside any of its tiles. */
interface Site { x: number; y: number; size?: [number, number] }

/** Can a crew member walk from `from` to beside the site (a plain walk on the ship's grid)? The stasis job's stops must all be reachable from the prisoner. */
function reachable(sim: Sim, ship: number, from: Tile, site: Site): boolean {
  return findPath(sim, ship, from, { x: site.x, y: site.y, adjacent: true, ...(site.size ? { w: site.size[0], h: site.size[1] } : {}) }) !== null;
}

/** Where crew stand to take an empty slab from a source, or null when the source is gone. */
function sourceSite(sim: Sim, from: SlabSource): Site | null {
  if (from.kind === 'floor') {
    const st = sim.world.get(from.id, ItemStackC);
    return st ? { x: st.x, y: st.y } : null;
  }
  if (from.kind === 'rack') {
    const t = rackTile(sim, from.id);
    return t ? { x: t.x, y: t.y } : null;
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

/** Every place on a ship an empty slab can be taken from now, with how many are not yet claimed: wheel slots, a shuttle's rack, storage, loose stacks. */
export function slabSources(sim: Sim, ship: number, reach?: Tile): (Site & { from: SlabSource; avail: number })[] {
  const claims = fetchClaims(sim);
  const claimed = (f: SlabSource): number => claims.get(`${f.kind}:${f.id}`) ?? 0;
  const out: (Site & { from: SlabSource; avail: number })[] = [];
  for (const id of [...sim.world.query(StasisWheelC, ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    const from: SlabSource = { kind: 'wheel', id };
    const avail = emptySlabsIn(sim, id) - claimed(from);
    const site = m && wheelHatch(sim, m);
    if (m && site && m.hp > 0 && shipIdOf(sim, m) === ship && avail > 0 && (!reach || reachable(sim, ship, reach, site))) out.push({ ...site, from, avail });
  }
  const rack = rackHere(sim, ship);
  if (rack) {
    const from: SlabSource = { kind: 'rack', id: rack };
    const avail = rackEmpty(sim, rack) - claimed(from);
    const site = sourceSite(sim, from);
    if (avail > 0 && site && (!reach || reachable(sim, ship, reach, site))) out.push({ ...site, from, avail });
  }
  for (const s of sourcesOf(sim, ship, SLAB_ITEM, reservations(sim))) {
    if (s.ref.kind !== 'floor' && s.ref.kind !== 'storage') continue;
    const from: SlabSource = { kind: s.ref.kind, id: s.ref.id };
    const avail = s.avail - claimed(from);
    const site = sourceSite(sim, from);
    if (avail > 0 && site && (!reach || reachable(sim, ship, reach, site))) out.push({ ...site, from, avail });
  }
  return out;
}

/** The unclaimed empty-slab source nearest to `at` on the ship that a walk from `reach` gets to (ties: wheels first, then lower id), or null. */
export function nearestSlabSource(sim: Sim, ship: number, at: { x: number; y: number }, reach: Tile): (Site & { from: SlabSource }) | null {
  let best: (Site & { from: SlabSource }) | null = null;
  let bestD = Infinity;
  for (const s of slabSources(sim, ship, reach)) {
    const d = dist2(s, at);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** The wheel on the ship a slab carted from `at` goes to: one that can take it and whose hatch a walk from `at` reaches, powered ones first, then the nearest hatch (ties: lower id). 0 for none. */
export function pickWheel(sim: Sim, ship: number, at: { x: number; y: number }): number {
  let best = 0;
  let bestKey = Infinity;
  for (const id of [...sim.world.query(StasisWheelC, ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== ship || !wheelTakes(sim, id)) continue;
    const h = wheelHatch(sim, m);
    const key = (m.powered ? 0 : 1e9) + dist2(h, at);
    if (key < bestKey && reachable(sim, ship, { x: at.x, y: at.y }, h)) {
      best = id;
      bestKey = key;
    }
  }
  return best;
}

/** Slots of the intact wheels on a ship not holding a full slab. */
function wheelRoom(sim: Sim, ship: number): number {
  let room = 0;
  for (const id of sim.world.query(StasisWheelC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && m.hp > 0 && shipIdOf(sim, m) === ship) room += freeSlots(sim, id);
  }
  return room;
}

/**
 * Room a prize's shuttle has for full slabs (#116): free places in its rack once the empty slab a seal uses has come out of it, as far as the
 * wheels of its home ship have room for them on top of what they wait for already (`stasisRoom` there, less the slabs in the rack). 0 for a
 * ship no shuttle carries slabs for (`siteShuttle`).
 */
export function shuttleRoom(sim: Sim, ship: number): number {
  const v = siteShuttle(sim, ship);
  return v ? Math.min(rackRoom(sim, v), Math.max(0, homeRoom(sim, v, ship) - rackFull(sim, v).length)) : 0;
}

/** True for a shuttle that could carry a prize's slabs home: fit to serve an away site (EVA) and based on a ship of the player's other than the prize. */
export function slabCarrier(sim: Sim, vehicle: number, prize: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  return !!v && v.homeShip !== prize && isFerryRegion(sim, v.homeShip) && !!vehicleDefOf(sim, v)?.eva;
}

/**
 * Wheel room at the home ship of a shuttle that could carry slabs from `prize` (`stasisRoom` there; 0 for one that is not a `slabCarrier`). The
 * one answer to "can this shuttle take a prize's slabs home": the seal refusal, the shuttle's room and the pick of a shuttle to send all ask it.
 */
export function homeRoom(sim: Sim, vehicle: number, prize: number): number {
  return slabCarrier(sim, vehicle, prize) ? stasisRoom(sim, sim.world.get(vehicle, VehicleC)!.homeShip) : 0;
}

/**
 * Room on a ship not yet spoken for: slots of intact wheels not holding a full slab, plus the room of a prize's shuttle (`shuttleRoom`), minus
 * slabs already headed for one (on a cart, or with a pickup job) and seal jobs that will make one. The stasis system posts a job only while
 * this is above 0.
 */
export function stasisRoom(sim: Sim, ship: number): number {
  let room = wheelRoom(sim, ship) + shuttleRoom(sim, ship);
  for (const id of fullSlabs(sim)) {
    const p = slabPlace(sim, id);
    if (p?.kind === 'carried' && p.ship === ship) room--;
  }
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    // A handover's job (`deliver`) takes the slab off the ship: it needs no room here.
    if (j?.kind === 'stasis' && j.stasis?.phase !== 'stow' && j.stasis?.phase !== 'ship' && !j.stasis?.deliver && shipIdOf(sim, j) === ship) room--;
  }
  return room;
}

/**
 * Where a slab on a cart at `at` goes: for a handover (`deliver`), the rack of that shuttle while it is at the ship; else a wheel on the ship
 * (`pickWheel`), else the rack of the prize's shuttle while it is there and has room.
 */
export function slabDestination(sim: Sim, ship: number, at: { x: number; y: number }, deliver = 0): { wheel: number } | { rack: number } | null {
  const out = deliver && rackTile(sim, deliver);
  if (deliver && out && out.shipId === ship && rackRoom(sim, deliver) > 0 && reachable(sim, ship, { x: at.x, y: at.y }, out)) return { rack: deliver };
  const wheel = pickWheel(sim, ship, at);
  if (wheel) return { wheel };
  const rack = rackHere(sim, ship);
  const t = rack && rackTile(sim, rack);
  return rack && t && rackRoom(sim, rack) > 0 && reachable(sim, ship, { x: at.x, y: at.y }, t) ? { rack } : null;
}

/** Post a stasis job for a full slab (a pickup off the floor, or a handover's unstow from a wheel) with its first stop at `at`. */
export function postSlabJob(sim: Sim, at: { x: number; y: number }, prisoner: number, stasis: StasisJob, work = 1): void {
  sim.world.add(sim.world.createEntity(), JobC, { category: 'hauling', kind: 'stasis', x: at.x, y: at.y, struct: 0, work, progress: 0, reservedBy: 0, target: prisoner, stasis });
}

/** Aim the job at a stop (clears the footprint size of the last one). */
function aim(job: Job, site: Site): void {
  job.x = site.x;
  job.y = site.y;
  if (site.size) job.size = site.size;
  else delete job.size;
}

/**
 * Point a fetch at the nearest unclaimed source from `at` that the prisoner's tile reaches (the slab is carried there next). False when there is
 * none, or when nowhere to take the full slab (a wheel, a shuttle's rack: `slabDestination`) is reachable from the prisoner either (it would be
 * sealed only to be dropped).
 */
export function aimFetch(sim: Sim, job: Job, st: StasisJob, ship: number, at: { x: number; y: number }): boolean {
  delete st.from; // not a claim of its own while it looks
  const pos = sim.world.get(job.target ?? 0, PositionC);
  if (!pos || !slabDestination(sim, ship, origin(pos))) return false;
  const src = nearestSlabSource(sim, ship, at, origin(pos));
  if (!src) return false;
  st.phase = 'fetch';
  st.from = src.from;
  aim(job, src);
  return true;
}

/**
 * On to a wheel with the slab now on the cart, else to the rack of the prize's shuttle (`slabDestination`); with neither to take it, the slab is
 * set down here and the job ends.
 */
function toWheel(sim: Sim, job: Job, st: StasisJob, prisoner: number, ship: number, me: Position): WorkResult {
  const dest = slabDestination(sim, ship, origin(me), st.deliver);
  delete st.from;
  if (dest && 'rack' in dest) {
    const t = rackTile(sim, dest.rack)!;
    st.phase = 'ship';
    st.rack = dest.rack;
    aim(job, t);
    job.work = 1;
    job.progress = 0;
    return 'working';
  }
  const m = sim.world.get(dest?.wheel ?? 0, ModuleC);
  if (!dest || !m) {
    dropSlab(sim, prisoner, ship, origin(me));
    return 'done';
  }
  const wheel = dest.wheel;
  st.phase = 'stow';
  st.wheel = wheel;
  aim(job, wheelHatch(sim, m));
  const turns = Math.max(0, turnsToLoad(sim.world.get(wheel, StasisWheelC)?.slots ?? []));
  st.turns = turns;
  job.work = stowWork(turns);
  job.progress = 0;
  return 'working';
}

/** At the shuttle's rack tile: hand the slab in while the shuttle is still there with room; else on to wherever it can go now. */
function shipSlab(sim: Sim, crew: number, job: Job, st: StasisJob, prisoner: number, ship: number, me: Position): WorkResult {
  if (!cartsFor(sim, crew, prisoner)) return 'done';
  const t = st.rack ? rackTile(sim, st.rack) : null;
  if (st.rack && t && t.shipId === ship && rackRoom(sim, st.rack) > 0) {
    if (t.x !== job.x || t.y !== job.y) {
      aim(job, t);
      return 'working';
    }
    rackSlab(sim, prisoner, st.rack, t);
    if (!st.deliver) sim.events.emit({ type: 'stasis.shipped', crew: prisoner, vehicle: st.rack, ship }); // a handover logs its own way
    return 'done';
  }
  return toWheel(sim, job, st, prisoner, ship, me); // the shuttle left or filled up meanwhile
}

/**
 * At the wheel's hatch for a handover: the wheel turns the prisoner's slot to the hatch, the slab comes out (the loading animation backwards,
 * render/stasisLoad.ts `unloadPlan`) and onto the cart, then on to the shuttle. The turn is worked out on arrival, from the ring as it stands then.
 */
function unstow(sim: Sim, crew: number, job: Job, st: StasisJob, prisoner: number, ship: number, me: Position, speed: number): WorkResult {
  const slots = sim.world.get(st.wheel ?? 0, StasisWheelC)?.slots;
  if (!slots) return 'done';
  // Lifted already (on this crew member's cart): the hatch shuts behind them, then on to the shuttle.
  if (st.lifted) {
    if (!cartsFor(sim, crew, prisoner)) return 'done';
    job.progress = Math.min(job.work, job.progress + speed);
    return job.progress < job.work ? 'working' : toWheel(sim, job, st, prisoner, ship, me);
  }
  const turns = turnsToUnload(slots, prisoner);
  if (turns < 0 || sim.world.get(prisoner, StasisC)?.at !== 'wheel') return 'done';
  if (job.progress === 0 || st.turns !== turns) {
    st.turns = turns;
    job.work = stowWork(turns, true);
    job.progress = 0;
  }
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < turns * TURN_STEP_WORK + UNSTOW_LIFT * UNSTOW_WORK) return 'working';
  turnRing(slots, turns);
  // The ring stands turned now: the job's work left is the unload's alone (render reads it through stowStage, turning the ring by `turns`).
  st.turns = 0;
  job.progress -= turns * TURN_STEP_WORK;
  job.work -= turns * TURN_STEP_WORK;
  if (!unstowSlab(sim, prisoner, crew)) return 'done';
  st.lifted = true;
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
    if (!takeSlabFor(sim, crew, st.from)) return aimFetch(sim, job, st, ship, origin(me)) ? 'working' : 'done'; // taken meanwhile
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
  if (st.phase === 'unstow') return unstow(sim, crew, job, st, prisoner, ship, me, speed);
  if (st.phase === 'ship') return shipSlab(sim, crew, job, st, prisoner, ship, me);
  if (!cartsFor(sim, crew, prisoner)) return 'done';
  if (st.wheel && wheelTakes(sim, st.wheel)) {
    job.progress = Math.min(job.work, job.progress + speed);                    // the loading animation (render/stasisLoad.ts)
    if (job.progress < job.work) return 'working';
  }
  if (st.wheel && wheelTakes(sim, st.wheel) && stowSlab(sim, prisoner, st.wheel) >= 0) {
    sim.events.emit({ type: 'stasis.stowed', crew: prisoner, wheel: st.wheel, ship });
    return 'done';
  }
  return toWheel(sim, job, st, prisoner, ship, me); // that wheel filled up meanwhile: the next one, or the floor
}
