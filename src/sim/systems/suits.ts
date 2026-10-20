import { shipIdOf, shipGrid } from '../regions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { sweepErrands } from '../eva/errands';
import { isThin, suitAir, suitDef } from '../eva/suit';
import { SuitC } from '../eva/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVA_AIR_LOW_FRAC } from '../tuning';

/**
 * Suit upkeep, before vitals. Errands (suit up / off jobs) nobody carries any more are dropped. Every suited crew
 * member breathes from the tank while the air where they stand is thin (a breached room, the airlock, the hull outside): one second of
 * air per second, down to 0 (vitals then treats the suit as empty). The tank is only refilled by taking the suit off
 * at an airlock. Emits `suit.airLow` when the tank falls to the warning level and `suit.airOut` when it runs dry.
 */
export function suitsSystem(sim: Sim): void {
  sweepErrands(sim);
  const full = suitDef(sim).airSec;
  for (const id of sim.world.query(SuitC, CrewC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const suit = sim.world.get(id, SuitC)!;
    const pos = sim.world.get(id, PositionC)!;
    const grid = shipGrid(sim, shipIdOf(sim, pos));
    if (!(grid && isThin(grid, pos.x, pos.y))) continue;
    const before = suitAir(sim, id);
    if (before <= 0) continue;
    const after = Math.max(0, before - 1 / TICK_HZ);
    suit.air = after;
    if (before > full * EVA_AIR_LOW_FRAC && after <= full * EVA_AIR_LOW_FRAC) sim.events.emit({ type: 'suit.airLow', crew: id });
    if (after <= 0) sim.events.emit({ type: 'suit.airOut', crew: id });
  }
}
