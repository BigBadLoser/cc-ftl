import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';

/** Why an order is not moving: no free shuttle, no free pilot, a region without a usable dock, nothing left to take, or trips keep failing. */
export type TransferBlock = 'noShuttle' | 'noPilot' | 'noAirlock' | 'noStock' | 'failed';

/**
 * 'queued': waiting for a shuttle and a pilot. 'boarding': a shuttle and pilot are chosen and the pilot walks to the bay.
 * 'underway': the shuttle is on a trip (a `FerryC` carries this order's id). 'blocked': cannot go now (`reason`); retried later.
 */
export type TransferStatus = 'queued' | 'boarding' | 'underway' | 'blocked';

/**
 * A logistics order (its own entity): move `items` from the region `from` to the player region `to` by shuttle, in as many trips
 * as the hold needs. `items` is what is still to move. Regions are ShipC entity ids.
 */
export interface Transfer {
  from: number;
  to: number;
  items: ItemQty[];
  /** Units asked for, and units delivered so far. */
  total: number;
  moved: number;
  status: TransferStatus;
  reason?: TransferBlock;
  /** Shuttle and pilot of the current trip (0 when none). */
  vehicle: number;
  pilot: number;
  /** Trips finished with something delivered. */
  trips: number;
  /** Trips in a row that delivered nothing. */
  fails: number;
  /** Do not look for a shuttle before this tick (-1: not until the player cancels). */
  retryAt: number;
  /** Tick the status last changed. */
  since: number;
  /** Queued by the game, not the player. */
  auto?: 'salvage';
}
export const TransferC = defineComponent<Transfer>('transfer');

/** On a salvage site (a prize or derelict): what its loot looked like at the last look, to tell when the salvage went quiet. */
export interface SalvageWatch {
  units: number;
  since: number;
}
export const SalvageWatchC = defineComponent<SalvageWatch>('salvageWatch');
