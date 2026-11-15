import { AwaySiteC, SiteRunC } from '../away/components';
import { openSite, siteShuttleOk } from '../away/handlers';
import { ShipC } from '../combat/components';
import { CarriedC, CrewC, DeadC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { removeCrew } from '../crew/depart';
import { PrisonerC } from '../fight/components';
import { CarryingC, ItemStackC, StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import { storageCount } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips } from '../story/world';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { SlabRackC, StasisC } from './components';
import { dropSlab, rackEmptySlab, takeEmptySlab } from './freeze';
import { homeRoom, pickWheel, slabSources } from './jobs';
import { sealMarked } from './order';
import { rackEmpty, rackFree, rackFull, rackHome, siteShuttle, wayAboard } from './rack';
import { boardingTile } from '../vehicles/geometry';
import { RACK_LOAD_SEC, RACK_SLOTS, SLAB_ITEM } from './tuning';

/**
 * Slabs by shuttle (#116, docs/DESIGN.md "Prisoners and prizes"). A prisoner marked for sealing on a prize with no wheel of its own to take the slab
 * is the crew's to see to: the shuttle serving the prize's away site (boarding, salvage, or one opened here for it, owner 'stasis') brings empty
 * slabs out in its rack, the party seals the prisoner on the spot and hands the full slab into the rack (stasis jobs), and at home the shuttle
 * sets the full slabs down by its bay, where the crew cart them to a wheel. The stasis system runs this each tick (`tendShuttles`).
 */

/** A prisoner the crew will seal: marked, in the world, alive, not carried. */
const toSeal = (sim: Sim, id: number): boolean =>
  sealMarked(sim, id) && sim.world.has(id, PositionC) && !sim.world.has(id, DeadC) && !sim.world.has(id, CarriedC) && !sim.world.has(id, StasisC);

/** Marked prisoners on a prize whose slabs no wheel there can take (they go by shuttle), ascending ids. */
export function shuttleSeals(sim: Sim, ship: number): number[] {
  return [...sim.world.query(PrisonerC, PositionC, CrewC)].filter((id) => {
    const pos = sim.world.get(id, PositionC)!;
    return shipIdOf(sim, pos) === ship && toSeal(sim, id) && !pickWheel(sim, ship, origin(pos));
  }).sort((a, b) => a - b);
}

/** Full slabs on a prize, on the floor or on a cart, that no wheel there can take: they wait for its shuttle. */
export function shuttleSlabs(sim: Sim, ship: number): number[] {
  return [...sim.world.query(StasisC)].filter((id) => {
    const s = sim.world.get(id, StasisC)!;
    return (s.at === 'floor' || s.at === 'carried') && shipIdAt(sim, s.x, s.y) === ship && !pickWheel(sim, ship, s);
  }).sort((a, b) => a - b);
}

/** The shuttle work a ship has: prisoners to seal and slabs to carry home. 0 for any ship but a prize. */
export function shuttleWork(sim: Sim, ship: number): number {
  if (sim.world.get(ship, ShipC)?.state !== 'prize') return 0;
  return shuttleSeals(sim, ship).length + shuttleSlabs(sim, ship).length;
}

/** Empty slabs on a ship off any shuttle: in storage, loose on the floor, and on the carts of crew there. */
function emptiesOn(sim: Sim, ship: number): number {
  let n = 0;
  for (const id of sim.world.query(StorageC, ModuleC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) n += storageCount(sim, id, SLAB_ITEM);
  for (const id of sim.world.query(ItemStackC)) {
    const st = sim.world.get(id, ItemStackC)!;
    if (st.item === SLAB_ITEM && shipIdAt(sim, st.x, st.y) === ship) n += st.count;
  }
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.get(id, CarryingC)?.item === SLAB_ITEM && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) n++;
  }
  return n;
}

/** Empty slabs the prize's shuttle should hold in its rack for its marked prisoners (those not covered by empty slabs on the prize), at most a rackful. */
export function rackWant(sim: Sim, ship: number): number {
  return Math.max(0, Math.min(RACK_SLOTS, shuttleSeals(sim, ship).length - emptiesOn(sim, ship)));
}

/** The prize a shuttle's run serves and carries slabs for, or 0. */
function servedPrize(sim: Sim, vehicle: number): number {
  const site = sim.world.get(vehicle, SiteRunC)?.site ?? 0;
  return site && !sim.world.get(vehicle, SiteRunC)?.pickup && siteShuttle(sim, site) === vehicle ? site : 0;
}

/** True while the shuttle, at home for its run's stop, still takes empty slabs into its rack (the run waits for it: away/run.ts). */
export function stocking(sim: Sim, vehicle: number): boolean {
  const prize = servedPrize(sim, vehicle);
  const home = sim.world.get(vehicle, VehicleC)?.homeShip ?? 0;
  return !!prize && rackHome(sim, vehicle) && rackFree(sim, vehicle) > 0 && rackEmpty(sim, vehicle) < rackWant(sim, prize) && slabSources(sim, home).length > 0;
}

/**
 * Whether the run should take a trip home for the slabs (away/trips.ts): full slabs in the rack and it is full or nothing more is to be put in it,
 * or prisoners wait to be sealed and no empty slab is on the prize or in the rack.
 */
export function slabTripDue(sim: Sim, vehicle: number, site: number): boolean {
  if (siteShuttle(sim, site) !== vehicle) return false;
  const full = rackFull(sim, vehicle).length;
  if (full > 0 && (rackFree(sim, vehicle) === 0 || shuttleWork(sim, site) === 0)) return true;
  return shuttleSeals(sim, site).length > 0 && rackEmpty(sim, vehicle) === 0 && emptiesOn(sim, site) === 0;
}

/** The free shuttle to send for a prize's slabs: the lowest id that can serve a site and whose home has wheel room for them (`homeRoom`), or 0. */
function shuttleToSend(sim: Sim, prize: number): number {
  return [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((v) => siteShuttleOk(sim, v) && homeRoom(sim, v, prize) > 0) ?? 0;
}

/**
 * Keep the prizes' away sites in step with their shuttle work: open one ('stasis', with a shuttle whose home can hold the slabs) where none is and
 * a way aboard is (`wayAboard`), and write its demand. The stasis system is the one owner of 'stasis' sites, on whatever ship: one with no shuttle
 * work left (done, the ship no longer a prize, no way aboard) is closed; the slabs in its rack ride home with the party. Sites of other owners are
 * left to them (a boarding party does the sealing; its shuttle carries the slabs).
 */
function tendSites(sim: Sim): void {
  for (const ship of [...playerShips(sim)].sort((a, b) => a - b)) {
    if (sim.world.get(ship, ShipC)?.state !== 'prize' || sim.world.has(ship, AwaySiteC) || shuttleWork(sim, ship) === 0 || !wayAboard(sim, ship)) continue;
    const v = shuttleToSend(sim, ship);
    if (v && openSite(sim, ship, 'stasis', v) === v) sim.world.get(ship, AwaySiteC)!.demand = { hauling: shuttleWork(sim, ship) };
  }
  for (const ship of [...sim.world.query(AwaySiteC)].sort((a, b) => a - b)) {
    const site = sim.world.get(ship, AwaySiteC)!;
    if (site.owner !== 'stasis' || site.status !== 'open') continue;
    const work = wayAboard(sim, ship) ? shuttleWork(sim, ship) : 0;
    if (work > 0) site.demand = { hauling: work };
    else site.status = 'closing';
  }
}

/** At home: the full slabs come out by the bay (for the crew to cart to a wheel), the rack is stocked with empty slabs, spare ones go to the stock. */
function tendRacks(sim: Sim): void {
  const every = Math.max(1, Math.round(RACK_LOAD_SEC * TICK_HZ));
  for (const vehicle of [...sim.world.query(VehicleC)].sort((a, b) => a - b)) {
    // A shuttle sealed for a run (a prisoner's handover, capture/delivery.ts) keeps the slab it was loaded with, at home or not.
    if (sim.world.get(vehicle, VehicleC)?.outbound) continue;
    const full = rackFull(sim, vehicle);
    const prize = servedPrize(sim, vehicle);
    if (full.length === 0 && !sim.world.has(vehicle, SlabRackC) && !prize) continue;
    // In its bay or docked, the slabs aboard are where crew board it (slabPlace reads the ship from there); hovering or flying they keep the tile
    // they were loaded on.
    const t = boardingTile(sim, vehicle);
    for (const id of full) if (t) Object.assign(sim.world.get(id, StasisC)!, { x: t.x, y: t.y });
    if (!t || !rackHome(sim, vehicle)) continue;
    if (full.length > 0) {
      for (const id of full) dropSlab(sim, id, t.shipId, t);
      sim.events.emit({ type: 'stasis.unloaded', vehicle, ship: t.shipId, crew: full });
    }
    const want = prize ? rackWant(sim, prize) : 0;
    const spare = rackEmpty(sim, vehicle) - want;
    if (spare > 0) {
      sim.world.get(vehicle, SlabRackC)!.empty -= spare;
      spillItems(sim, t.shipId, t.x, t.y, SLAB_ITEM, spare);
    } else if (prize && rackEmpty(sim, vehicle) < want && rackFree(sim, vehicle) > 0 && sim.world.get(vehicle, SiteRunC)?.phase === 'board' && sim.tick % every === 0) {
      // One empty slab a beat from the ship's stock (nearest to the bay first), as the hold is unloaded a crate at a time, crew at home or not.
      const src = slabSources(sim, t.shipId).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
      if (src && takeEmptySlab(sim, src.from)) rackEmptySlab(sim, vehicle);
    }
    if (rackEmpty(sim, vehicle) === 0 && rackFull(sim, vehicle).length === 0) sim.world.remove(vehicle, SlabRackC);
  }
}

/** Slabs whose shuttle is gone (destroyed): the prisoner went with it. */
function lostSlabs(sim: Sim): void {
  for (const id of [...sim.world.query(StasisC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, StasisC)!;
    if (s.at !== 'vehicle' || sim.world.has(s.carrier, VehicleC)) continue;
    const name = sim.world.get(id, CrewC)?.name ?? 'A prisoner';
    sim.world.remove(id, StasisC);
    removeCrew(sim, id);
    sim.events.emit({ type: 'stasis.lost', crew: id, name, vehicle: s.carrier });
  }
}

/** Each tick (from the stasis system): lost slabs, the racks at home, and every PLAN_INTERVAL the prizes' sites (`plan`). */
export function tendShuttles(sim: Sim, plan: boolean): void {
  lostSlabs(sim);
  tendRacks(sim);
  if (plan) tendSites(sim);
}

