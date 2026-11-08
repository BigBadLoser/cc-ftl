import { isContraband } from '../blackmarket/services';
import { INSPECT_SEARCH_SEC, INSPECT_SPOT_TILES } from '../blackmarket/tuning';
import { CrewC, DeadC, JobC, PositionC, type Job } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { ItemStackC, StorageC } from '../items/components';
import { heldItems } from '../items/held';
import { makeHaul } from '../items/plan';
import { spillItems } from '../items/stacks';
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
 * What is claimed is `Inspection.found`, its worth `value`.
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

/** Count claimed units as found. */
function addFound(sim: Sim, insp: Inspection, item: string, n: number): void {
  const q = insp.found.find((f) => f.item === item);
  if (q) q.count += n;
  else insp.found.push({ item, count: n });
  insp.found.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
  insp.value += (sim.content.items[item]?.price ?? 0) * n;
}

/** Hauls of `n` units from `src` into the shuttle, a carry load each, for the party alone. */
function haulOff(sim: Sim, res: Reservations, vehicle: number, ship: number, src: Located, item: string, n: number): void {
  for (let left = n; left > 0;) {
    const count = Math.min(left, DEFAULT_CARRY_CAPACITY);
    const id = makeHaul(sim, res, 'patrol', ship, src, { kind: 'vehicle', id: vehicle }, item, count);
    (sim.world.get(id, JobC) as Job).party = vehicle;
    left -= count;
  }
}

/** Claim the unclaimed contraband stacks lying on the ship within `r` tiles of a point: hauls into the shuttle. */
function claimLoose(sim: Sim, res: Reservations, vehicle: number, insp: Inspection, at: { x: number; y: number }, r: number): void {
  for (const id of [...sim.world.query(ItemStackC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ItemStackC)!;
    if (s.job || !isContraband(sim, s.item) || apart(s, at) > r || shipIdAt(sim, s.x, s.y) !== insp.ship) continue;
    const avail = s.count - (res.out.get(refKey('floor', id, s.item)) ?? 0);
    if (avail <= 0) continue;
    addFound(sim, insp, s.item, avail);
    haulOff(sim, res, vehicle, insp.ship, { ref: { kind: 'floor', id }, x: s.x, y: s.y, avail }, s.item, avail);
  }
}

/** A search job is done (crew/jobWork.ts): what contraband the module holds is claimed for the shuttle. */
export function finishSearch(sim: Sim, job: Job): void {
  const vehicle = job.party ?? 0;
  const insp = sim.world.get(vehicle, InspectionC);
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!insp || !m) return;
  const res = reservations(sim);
  for (const h of heldItems(sim)) {
    if (h.holder !== job.target || !isContraband(sim, h.item) || h.count <= 0) continue;
    if (h.where === 'storage') {
      const avail = h.count - (res.out.get(refKey('storage', h.holder, h.item)) ?? 0);
      if (avail <= 0) continue;
      addFound(sim, insp, h.item, avail);
      haulOff(sim, res, vehicle, insp.ship, { ref: { kind: 'storage', id: h.holder }, x: m.x, y: m.y, avail }, h.item, avail);
    } else if (h.where === 'fitted') {
      h.remove();
      spillItems(sim, insp.ship, job.x, job.y, h.item, h.count);
    }
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
