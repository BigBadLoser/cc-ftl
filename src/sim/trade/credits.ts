import type { Sim } from '../sim';

/** Pay the player `n` credits and keep the high-water mark (`TradeState.bestCredits`) in step: every credit gain goes through here. */
export function addCredits(sim: Sim, n: number): void {
  const t = sim.trade;
  t.credits += n;
  if (t.credits > (t.bestCredits ?? 0)) t.bestCredits = t.credits;
}
