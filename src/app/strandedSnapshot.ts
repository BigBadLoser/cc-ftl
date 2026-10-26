import { distressBlocker, fuelStock, isStranded, cheapestHop, playerShip, tugQuote, type Sim } from '../sim';
import { DISTRESS_TURNS } from '../sim/galaxy/tuning';
import type { UiStranded } from '../ui/api';

/** The stranding banner's data: null while the ship can pay for a jump (or while it is not at a node). */
export function buildStranded(sim: Sim): UiStranded | null {
  if (!sim.content.galaxy || !isStranded(sim)) return null;
  const g = sim.galaxy;
  const q = tugQuote(sim);
  const why = distressBlocker(sim);
  return {
    need: cheapestHop(sim) ?? 0, have: fuelStock(sim, playerShip(sim)), canCall: why === '', blocker: why === 'alreadyCalled' ? '' : why,
    pending: g.distress ? { turnsLeft: Math.max(0, Math.min(DISTRESS_TURNS, g.distress.due - g.turn)) } : null,
    fuel: q.fuel, unit: q.unit, total: q.total, credits: sim.trade.credits,
  };
}
