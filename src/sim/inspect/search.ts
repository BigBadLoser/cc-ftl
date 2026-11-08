import { isContraband } from '../blackmarket/services';
import { INSPECT_SEARCH_SEC, INSPECT_SPOT_TILES } from '../blackmarket/tuning';
import { CrewC, DeadC, JobC, PositionC, type Job } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { ItemStackC, StorageC } from '../items/components';
import { heldItems } from '../items/held';
import { makeHaul } from '../items/plan';
import { spillItems, takeFromStack } from '../items/stacks';
import { storageTake } from '../items/storage';
import type { ItemQty } from '../registry';
import { cargoSpace } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { refKey, reservations, type Located, type Reservations } from '../items/stock';
import { ModuleC } from '../modules/components';
import { moduleSite } from '../modules/footprint';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY } from '../tuning';
import { InspectionC, type Inspection } from './types';

/**
 * The search (#138): a search job at each module that can hold goods (storage, and a module with a fitted upgrade), taken only by the inspection's
 * party (`Job.party`). A finished search hands what contraband the module holds to ordinary hauls into the inspectors' shuttle (a fitted upgrade
 * comes off first and is carried from the floor). On their way the inspectors also take contraband off the player's crew and floors near them.
 * What they take is tallied when the search ends (`tally`): `Inspection.found`, its worth `value`.
 */

/** The modules of the inspected ship to search, lowest id first: every storage module and every module with an upgrade fitted. */
function toSearch(sim: Sim, ship: number): number[] {
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC)!;
    return shipIdOf(sim, m) === ship && (sim.world.has(id, StorageC) || !!m.upgrade);
  }).sort((a, b) => a - b);
}

/** Post the inspection's search jobs. */
export function postSearches(sim: Sim, vehicle: number, insp: Inspection): void {
  for (const target of toSearch(sim, insp.ship)) {
    const m = sim.world.get(target, ModuleC)!;
    const site = moduleSite(sim.content.modules[m.def], m);
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category: 'patrol', kind: 'search', x: site.x, y: site.y, ...(site.size ? { size: site.size } : {}), struct: 0, work: Math.round(INSPECT_SEARCH_SEC * TICK_HZ),
      progress: 0, reservedBy: 0, target, party: vehicle,
    });
    insp.jobs.push(id);
  }
}

/** Tiles between two sector tiles, diagonals counting one. */
const apart = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** How far from a module's anchor what comes off it can land (the spill's radius, items/stacks.ts, and a large footprint). */
const SPILL_REACH = 9;

/** Add units to an item list (kept by item id). */
function addTo(list: ItemQty[], item: string, n: number): void {
  const q = list.find((f) => f.item === item);
  if (q) q.count += n;
  else list.push({ item, count: n });
  list.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
}

/** Room left in the shuttle's hold: its free space less what hauls already bring it. */
function holdRoom(sim: Sim, res: Reservations, vehicle: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 0;
  let coming = 0;
  for (const [k, n] of res.incoming) if (k.startsWith(`vehicle:${vehicle}:`)) coming += n;
  return Math.max(0, cargoSpace(sim, v) - coming);
}

/**
 * Seize `n` units at `src`: as much as the hold has room for is hauled into the shuttle (a carry load a haul, for the party alone); the rest is impounded
 * where it is (`take` removes it, `Inspection.impounded` keeps it), so a find is never larger than what the shuttle can take away.
 */
function seize(sim: Sim, res: Reservations, vehicle: number, insp: Inspection, src: Located, item: string, n: number, take: (n: number) => number): void {
  const haul = Math.min(n, holdRoom(sim, res, vehicle));
  for (let left = haul; left > 0;) {
    const count = Math.min(left, DEFAULT_CARRY_CAPACITY);
    const id = makeHaul(sim, res, 'patrol', insp.ship, src, { kind: 'vehicle', id: vehicle }, item, count);
    (sim.world.get(id, JobC) as Job).party = vehicle;
    left -= count;
  }
  const kept = n > haul ? take(n - haul) : 0;
  if (kept > 0) addTo((insp.impounded ??= []), item, kept);
}

/**
 * What the search took, once it is over: the shuttle's hold and what was impounded in place. Counted from what they hold, never from what they meant to
 * take, so goods dropped on the way and picked up again count once.
 */
export function tally(sim: Sim, vehicle: number, insp: Inspection): void {
  const found: ItemQty[] = [];
  for (const q of [...(sim.world.get(vehicle, VehicleC)?.cargo ?? []), ...(insp.impounded ?? [])]) if (q.count > 0) addTo(found, q.item, q.count);
  insp.found = found;
  insp.value = found.reduce((n, q) => n + (sim.content.items[q.item]?.price ?? 0) * q.count, 0);
}

/** Claim the unclaimed contraband stacks lying on the ship within `r` tiles of a point: hauls into the shuttle. */
function claimLoose(sim: Sim, res: Reservations, vehicle: number, insp: Inspection, at: { x: number; y: number }, r: number): void {
  for (const id of [...sim.world.query(ItemStackC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ItemStackC)!;
    if (s.job || !isContraband(sim, s.item) || apart(s, at) > r || shipIdAt(sim, s.x, s.y) !== insp.ship) continue;
    const avail = s.count - (res.out.get(refKey('floor', id, s.item)) ?? 0);
    if (avail <= 0) continue;
    seize(sim, res, vehicle, insp, { ref: { kind: 'floor', id }, x: s.x, y: s.y, avail }, s.item, avail, (n) => takeFromStack(sim, id, n));
  }
}

/** A search job is done (crew/jobWork.ts): what contraband the module holds is claimed for the shuttle. */
export function finishSearch(sim: Sim, job: Job): void {
  const vehicle = job.party ?? 0;
  const insp = sim.world.get(vehicle, InspectionC);
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!insp || !m) return;
  const res = reservations(sim);
  // The module's stock by item (one entry per stack in the held list), less what hauls already take out of it.
  const stored: ItemQty[] = [];
  for (const h of heldItems(sim)) {
    if (h.holder !== job.target || !isContraband(sim, h.item) || h.count <= 0) continue;
    if (h.where === 'storage') addTo(stored, h.item, h.count);
    else if (h.where === 'fitted') {
      h.remove();
      spillItems(sim, insp.ship, job.x, job.y, h.item, h.count);
    }
  }
  const store = job.target ?? 0;
  for (const q of stored) {
    const avail = q.count - (res.out.get(refKey('storage', store, q.item)) ?? 0);
    if (avail > 0) seize(sim, res, vehicle, insp, { ref: { kind: 'storage', id: store }, x: m.x, y: m.y, avail }, q.item, avail, (n) => storageTake(sim, store, q.item, n));
  }
  claimLoose(sim, res, vehicle, insp, job, SPILL_REACH);
}

/**
 * The inspectors look at who and what they pass: contraband a player crew member holds within INSPECT_SPOT_TILES of an inspector is taken off them
 * (dropped where they stand), and contraband lying near an inspector is claimed.
 */
export function spotCheck(sim: Sim, vehicle: number, insp: Inspection): void {
  const res = reservations(sim);
  const near = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => apart(a, b) <= INSPECT_SPOT_TILES;
  const eyes = insp.crew.map((c) => sim.world.get(c, PositionC)).filter((p): p is NonNullable<typeof p> => !!p && shipIdOf(sim, p) === insp.ship);
  if (!eyes.length) return;
  for (const h of heldItems(sim)) {
    if ((h.where !== 'carried' && h.where !== 'wielded') || !isContraband(sim, h.item) || sim.world.has(h.holder, DeadC)) continue;
    const at = sim.world.get(h.holder, PositionC);
    if (!at || !sim.world.has(h.holder, CrewC) || sim.world.get(h.holder, AllegianceC)?.faction !== 'player' || !eyes.some((e) => near(e, at))) continue;
    h.remove();
    spillItems(sim, insp.ship, Math.round(at.x), Math.round(at.y), h.item, h.count);
  }
  for (const e of eyes) claimLoose(sim, res, vehicle, insp, { x: Math.round(e.x), y: Math.round(e.y) }, INSPECT_SPOT_TILES);
}

/** The party's open jobs (searches and seizure hauls). */
export const partyJobs = (sim: Sim, vehicle: number): number[] => sim.world.query(JobC).filter((id) => sim.world.get(id, JobC)?.party === vehicle);
