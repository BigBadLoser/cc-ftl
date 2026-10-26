import { autoLoadout, equipOrders } from '../fight/equip';
import { emergencyArming, stowOrders } from '../fight/emergency';
import type { Sim } from '../sim';

/** Crew fetch weapons from storage: complete the walk-and-take orders, and send unarmed role-loadout crew for gear. */
export function equipSystem(sim: Sim): void {
  equipOrders(sim);
  autoLoadout(sim);
  emergencyArming(sim);
  stowOrders(sim);
}
