import { autoLoadout, equipOrders } from '../fight/equip';
import type { Sim } from '../sim';

/** Crew fetch weapons from storage: complete the walk-and-take orders, and send crew for the weapons `armsFor` wants (fight/arms.ts). */
export function equipSystem(sim: Sim): void {
  equipOrders(sim);
  autoLoadout(sim);
}
