import type { Sim } from '../sim';
import { advanceDeals } from '../trade/dealFlow';

/**
 * Trade deliveries. Each live deal is a small state machine (see trade/dealFlow.ts): the shuttle docks at the player's
 * airlock and crew load it (outbound goods), flies to the trader's ship, swaps cargo, flies back and docks, crew unload it
 * (cargoJobs), and the escrowed credits are paid when the hold is empty. Flight is ordinary vehicle commands, issued here
 * and applied next tick, like the boarding doctrine does. Runs after the vehicle system so it sees this tick's arrivals. It also notes the credits the game started with in `bestCredits` (later gains go through `addCredits`).
 */
export function tradeSystem(sim: Sim): void {
  const t = sim.trade;
  if (t.credits > (t.bestCredits ?? 0)) t.bestCredits = t.credits;
  if (sim.trade.deals.length > 0) advanceDeals(sim);
}
