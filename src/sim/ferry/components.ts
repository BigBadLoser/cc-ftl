import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';

/**
 * 'toFrom': flying to the pickup region (dock at a free working airlock, else hover beside it). 'gather': there, loading the
 * hold and boarding crew. 'toDest': flying to the drop-off region. 'deliver': there, unloading and landing crew. 'home':
 * flying back to the bay (a failed or finished run both end here).
 */
export type FerryPhase = 'toFrom' | 'gather' | 'toDest' | 'deliver' | 'home';

/**
 * A base-logistics run on a shuttle (an order, like `MiningPodC`): carry `items` and `crew` from the player region `from`
 * (home ship or a claimed base) to the player region `to`, then fly home. The shuttle flies itself (`Vehicle.autopilot`).
 * Regions are ShipC entity ids.
 */
export interface Ferry {
  from: number;
  to: number;
  /** Cargo wanted from the pickup region's storage (clipped to what was there when ordered). */
  items: ItemQty[];
  /** Crew to carry; one that cannot board (no suit, no route) is dropped from the list. */
  crew: number[];
  phase: FerryPhase;
  /** Ticks in the current phase. */
  timer: number;
  /** Why the run is heading home early, if it is. */
  reason?: 'noAirlock' | 'timeout' | 'lost' | 'cancelled' | 'nothing' | 'noRoom';
}
export const FerryC = defineComponent<Ferry>('ferry');
