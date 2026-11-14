import { JobC } from '../crew/components';
import { stowOrDrop } from '../items/deck';
import { CarryingC, ItemStackC } from '../items/components';
import { destroyJob, takeFromStack } from '../items/stacks';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { cargoAdd, cargoOf, cargoTake } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { unitsOf } from './dockCount';
import { playerShip } from './player';
import type { Deal } from './types';

/**
 * What a docked station deal has to settle when it ends early (`Deal.dock.units`, written where the goods move: dockCount.ts). Only the deal's own units
 * move: the station's unrelated stock of the same item is never touched.
 */

/** Count the units that are on the way into the shuttle's hold or in it at the start of the station visit (the ledger's starting facts). */
export function startUnits(sim: Sim, d: Deal): void {
  if (!d.dock) return;
  for (const l of d.give) if (!d.get.some((g) => g.item === l.item)) unitsOf(d, l.item).hold = cargoOf(sim, d.vehicle, l.item);
}

/** The exchange is done: nothing of this deal is staged or in motion any more (what is left of it is the trader's or the player's already). */
export function settleDock(d: Deal): void {
  if (!d.dock) return;
  d.dock.staged = [];
  d.dock.units = {};
}

/** The deal's items: bought lines and given lines that are not also bought (those swap in the hold). */
const lines = (d: Deal): { item: string; dir: 'get' | 'give' }[] => [
  ...d.get.map((l) => ({ item: l.item, dir: 'get' as const })),
  ...d.give.filter((l) => !d.get.some((g) => g.item === l.item)).map((l) => ({ item: l.item, dir: 'give' as const })),
];

/** Units of an item in the hands of station crew for this deal (loads are tagged with the deal where the haul picks them up). */
export function handOf(sim: Sim, d: Deal, item: string): number {
  let n = 0;
  for (const crew of sim.world.query(CarryingC)) {
    const c = sim.world.get(crew, CarryingC);
    if (c?.deal?.id === d.id && c.item === item) n += c.count;
  }
  return n;
}

/**
 * Where the deal's units of an item are, in one answer: in the hold, on the shelf, on the deck, in hands. The station-work exchange is complete when
 * every bought line is in the hold and nothing given is in the hold or in hands (shelf and deck count as delivered).
 */
export function dockDone(sim: Sim, d: Deal): boolean {
  return lines(d).every(({ item, dir }) => {
    const u = unitsOf(d, item);
    if (dir === 'get') return u.hold >= (d.get.find((l) => l.item === item)?.count ?? 0) && handOf(sim, d, item) === 0;
    return u.hold <= 0 && handOf(sim, d, item) === 0;
  });
}

/** Take the deal's loads out of its crew members' hands (their hauls end). Returns the units. */
function takeHands(sim: Sim, d: Deal, item: string): number {
  let got = 0;
  for (const crew of [...sim.world.query(CarryingC)]) {
    const c = sim.world.get(crew, CarryingC);
    if (c?.deal?.id !== d.id || c.item !== item) continue;
    got += c.count;
    sim.world.remove(crew, CarryingC);
  }
  return got;
}

/** Take up to `n` of an item out of the station's storage (the staging storages first). */
function takeShelf(sim: Sim, d: Deal, item: string, n: number): number {
  let left = n;
  const preferred = (d.dock?.staged ?? []).filter((s) => s.item === item).map((s) => s.storage);
  const rest = sim.world.query(ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === d.ship && !preferred.includes(id));
  for (const id of [...preferred, ...rest]) {
    if (left <= 0) break;
    if (storageCount(sim, id, item) > 0) left -= storageTake(sim, id, item, left);
  }
  return n - left;
}

/** Take up to `n` of an item off the station's deck (loose stacks). */
function takeFloor(sim: Sim, d: Deal, item: string, n: number): number {
  let left = n;
  for (const id of sim.world.query(ItemStackC)) {
    const st = sim.world.get(id, ItemStackC);
    if (left <= 0) break;
    if (st?.item === item && !st.job && shipIdAt(sim, st.x, st.y) === d.ship) left -= takeFromStack(sim, id, left);
  }
  return n - left;
}

/** The deal's units of an item that are at the station (deck, then shelf), taken out. The one place that counts what the station holds of the deal. */
function takeAtStation(sim: Sim, d: Deal, item: string): number {
  const u = unitsOf(d, item);
  const got = takeFloor(sim, d, item, u.floor);
  const rest = takeShelf(sim, d, item, u.shelf + (u.floor - got));
  u.floor = 0;
  u.shelf = 0;
  return got + rest;
}

/**
 * Pull everything of the deal back out of the station side, by the ledger: hands emptied, deck and shelf units taken, hauls ended. With the shuttle
 * alive the bought units in its hold come out and the given units go back in; with it lost the given units return to the player's ship, and the bought
 * units that were in the hold are gone with it (`lostInHold`).
 */
export function reclaim(sim: Sim, d: Deal): void {
  if (!d.dock?.units) return;
  const alive = sim.world.has(d.vehicle, VehicleC);
  for (const { item, dir } of lines(d)) {
    const u = unitsOf(d, item);
    const back = takeHands(sim, d, item) + takeAtStation(sim, d, item);
    if (dir === 'get') {
      if (alive) cargoTake(sim, d.vehicle, item, u.hold);
    } else {
      const placed = alive ? cargoAdd(sim, d.vehicle, item, back) : 0; // the hold may not take it all: the rest goes to the player's ship
      if (back > placed) stowOrDrop(sim, playerShip(sim), item, back - placed);
    }
    if (alive) u.hold = 0;
  }
  for (const id of [...sim.world.query(JobC)]) if (sim.world.get(id, JobC)?.haul?.deal?.id === d.id) destroyJob(sim, id);
  d.dock.staged = [];
}

/** The player's given goods that reached station storage, taken out for the trader's stock (the exchange is complete). */
export function deliverGiven(sim: Sim, d: Deal): { item: string; count: number }[] {
  return lines(d).filter((l) => l.dir === 'give').map((l) => ({ item: l.item, count: takeAtStation(sim, d, l.item) }));
}

/** Bought units that were in a lost shuttle's hold: gone with it (the trader's stock does not get them back). Read before `reclaim`. */
export function lostInHold(sim: Sim, d: Deal, item: string): number {
  return sim.world.has(d.vehicle, VehicleC) ? 0 : d.dock?.units?.[item]?.hold ?? 0;
}
