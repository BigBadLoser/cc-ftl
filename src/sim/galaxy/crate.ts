import { STOLEN_GOODS } from '../blackmarket/services';
import { ItemStackC } from '../items/components';
import { spillItems, takeFromStack } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips, playerStorages } from '../story/world';
import { playerShip } from '../trade/player';
import type { StationJob } from './types';

/**
 * A delivery's sealed crate (ItemStack.job): set on deck beside the hold when the job is taken, apart from storage (haulers leave it be) until the
 * station shuttle collects it (handover.ts), or broken open.
 */

/** The item id of a delivery crate (content items, `cargo`). */
export const CRATE = 'item.cargo_crate';

/** The loose stack holding a delivery's crate on a player ship, or undefined (lost, or not aboard). */
export function crateOf(sim: Sim, jobId: number): number | undefined {
  const ships = playerShips(sim);
  return sim.world.query(ItemStackC).find((id) => {
    const s = sim.world.get(id, ItemStackC);
    return s?.job === jobId && ships.has(shipIdAt(sim, s.x, s.y));
  });
}

/** Set a delivery's crate on deck beside the player's first hold (else beside any module). False when there is no free floor near it. */
export function loadCrate(sim: Sim, jobId: number): boolean {
  const ship = playerShip(sim);
  const at = [...playerStorages(sim), ...sim.world.query(ModuleC)].map((id) => sim.world.get(id, ModuleC)).find((m) => m && shipIdOf(sim, m) === ship);
  return !!at && spillItems(sim, ship, at.x, at.y, CRATE, 1, jobId) === 0;
}

/** Hand a crate over (`open` false: it leaves the ship) or break it open (its goods spill out where it stood as stolen goods). */
export function unloadCrate(sim: Sim, job: StationJob, open: boolean): void {
  const id = crateOf(sim, job.id);
  if (id === undefined) return;
  const { x, y } = sim.world.get(id, ItemStackC)!;
  const ship = shipIdAt(sim, x, y);
  takeFromStack(sim, id, 1);
  // A crate broken open is a breach of contract: what spills is stolen goods (contraband), not the delivery.
  if (open && job.item && job.count) spillItems(sim, ship, x, y, sim.content.items[STOLEN_GOODS] ? STOLEN_GOODS : job.item, job.count);
}

/**
 * A crate a crew member was carrying when the haul was cut short is dropped as a plain stack (the job tag is lost): tag the first such loose crate on a
 * player ship as the job's again. True when the job's crate is on deck afterwards.
 */
export function recoverCrate(sim: Sim, jobId: number): boolean {
  if (crateOf(sim, jobId) !== undefined) return true;
  const ships = playerShips(sim);
  const loose = sim.world.query(ItemStackC).find((id) => {
    const s = sim.world.get(id, ItemStackC);
    return s?.item === CRATE && s.job === undefined && ships.has(shipIdAt(sim, s.x, s.y));
  });
  const s = loose === undefined ? undefined : sim.world.get(loose, ItemStackC);
  if (!s) return false;
  s.job = jobId;
  return true;
}
