import { JobC } from '../crew/components';
import { AssignmentC } from '../crew/components';
import { stowOrDrop } from '../items/deck';
import { CarryingC } from '../items/components';
import { destroyJob } from '../items/stacks';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
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

/** Take the deal's goods out of its crew members' hands (their hauls end). A carrier whose job is already gone with a lost shuttle is found by what it carries. */
function takeHands(sim: Sim, d: Deal, item: string): number {
  const want = unitsOf(d, item).hand;
  let got = 0;
  for (const crew of [...sim.world.query(CarryingC)]) {
    if (got >= want) break;
    const c = sim.world.get(crew, CarryingC);
    const job = sim.world.get(crew, AssignmentC)?.jobId;
    const haul = job === undefined ? undefined : sim.world.get(job, JobC)?.haul;
    if (!c || c.item !== item || (haul && haul.deal?.id !== d.id)) continue; // another job's load
    got += c.count;
    sim.world.remove(crew, CarryingC);
    if (job !== undefined && haul) destroyJob(sim, job);
  }
  return got;
}

/** Take up to `n` of an item out of the station's storage (the deal's own shelf units; the staging storages first). */
export function takeShelf(sim: Sim, d: Deal, item: string, n: number): number {
  let left = n;
  const preferred = (d.dock?.staged ?? []).filter((s) => s.item === item).map((s) => s.storage);
  const rest = sim.world.query(ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === d.ship && !preferred.includes(id));
  for (const id of [...preferred, ...rest]) {
    if (left <= 0) break;
    if (storageCount(sim, id, item) > 0) left -= storageTake(sim, id, item, left);
  }
  return n - left;
}

/**
 * Pull everything of the deal back out of the station side, by the exact counters: hands emptied, shelf units out of storage, hauls ended. With the
 * shuttle alive the bought units in its hold come out and the given units go back in; with it lost the given units (hands and shelf) return to the
 * player's ship, and the bought units that were in the hold are gone with it (`lostInHold`). The deal's counters are cleared.
 */
export function reclaim(sim: Sim, d: Deal): void {
  if (!d.dock?.units) return;
  const alive = sim.world.has(d.vehicle, VehicleC);
  for (const { item, dir } of lines(d)) {
    const u = unitsOf(d, item);
    const back = takeHands(sim, d, item) + takeShelf(sim, d, item, u.shelf);
    if (dir === 'get') {
      if (alive) cargoTake(sim, d.vehicle, item, u.hold);
    } else if (alive) cargoAdd(sim, d.vehicle, item, back);
    else if (back > 0) stowOrDrop(sim, playerShip(sim), item, back);
    u.shelf = 0;
    u.hand = 0;
    if (alive) u.hold = 0;
  }
  for (const id of [...sim.world.query(JobC)]) if (sim.world.get(id, JobC)?.haul?.deal?.id === d.id) destroyJob(sim, id);
  d.dock.staged = [];
}

/** The player's given goods that reached station storage, taken out for the trader's stock (the exchange is complete). */
export function deliverGiven(sim: Sim, d: Deal): { item: string; count: number }[] {
  return lines(d).filter((l) => l.dir === 'give').map((l) => ({ item: l.item, count: takeShelf(sim, d, l.item, unitsOf(d, l.item).shelf) }));
}

/** Bought units that were in a lost shuttle's hold: gone with it (the trader's stock does not get them back). Read before `reclaim`. */
export function lostInHold(sim: Sim, d: Deal, item: string): number {
  return sim.world.has(d.vehicle, VehicleC) ? 0 : d.dock?.units?.[item]?.hold ?? 0;
}
