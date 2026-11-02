import { PositionC } from '../crew/components';
import { airValue } from '../eva/air';
import { nearestAirSource } from '../eva/sources';
import { isSuited, isThin, needsAir, suitAir, suitDef } from '../eva/suit';
import { shipGrid, shipIdOf } from '../regions';
import { SalvageCrewC } from '../salvage/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  AIR_CRITICAL_FRAC, AIR_CRITICAL_PAD_SEC, AIR_CRITICAL_TRAVEL, AIR_EVAL_TICKS, AIR_REFILL_FRAC, AIR_REFILL_PAD_SEC, AIR_REFILL_TRAVEL,
} from '../tuning';
import { YardCrewC } from '../yard/types';
import { IntentC } from './components';

/**
 * The air drive's inputs (#286 slice 1; docs/DESIGN.md "Air as a need", docs/ARCHITECTURE.md "Dependency on crew AI Phase 3"). The need
 * exists only while a suited crew member who breathes stands in thin air, so their tank drains. Salvage teams and the shipyard's
 * contractors keep their own air logic until salvage moves onto away sites (slice 3): for them the need is absent.
 *
 * `airMargin` maps the air left onto the drive's two thresholds, which depend on the travel time to the nearest source:
 * 0..500 below the critical line, 500..1000 between it and the refill line, 1000..2000 above (by the fraction of a tank above
 * it). So the policy's `enter: 1000` is the refill line and `urgent.below: 500` the critical one, whatever the distance.
 * `airSource` is 1000 when a source can be reached, else 0 (the drive is then blocked and the pickup request goes out).
 */

/** True while the crew member's suit tank drains and the air drive applies to them. */
export function airDraining(sim: Sim, id: number): boolean {
  if (!needsAir(sim, id) || !isSuited(sim, id) || sim.world.has(id, SalvageCrewC) || sim.world.has(id, YardCrewC)) return false;
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  return !!pos && !!grid && isThin(grid, pos.x, pos.y);
}

/** Ticks to the nearest air source (-1: none reachable), searched at most once per AIR_EVAL_TICKS and kept on the Intent. */
export function sourceTicks(sim: Sim, id: number): number {
  const intent = sim.world.get(id, IntentC);
  if (intent?.air && sim.tick - intent.air.at < AIR_EVAL_TICKS) return intent.air.ticks;
  const src = nearestAirSource(sim, id);
  const ticks = src ? src.ticks : -1;
  if (intent) intent.air = { at: sim.tick, ticks };
  return ticks;
}

/** Drop the kept search (the crew member left thin air, or the refill is done). */
export function forgetAirSearch(sim: Sim, id: number): void {
  const intent = sim.world.get(id, IntentC);
  if (intent) delete intent.air;
}

/** Seconds of air left in the worn tank, counting a Void-born wearer's longer tank. */
export const airLeftSec = (sim: Sim, id: number): number => suitAir(sim, id) * airValue(sim, id);

/** The refill and critical lines (seconds of air) for a travel time of `travel` seconds to the nearest source. */
export function airLines(sim: Sim, id: number, travel: number): { refill: number; critical: number; tank: number } {
  const tank = suitDef(sim).airSec * airValue(sim, id);
  return {
    tank,
    refill: Math.max(AIR_REFILL_FRAC * tank, AIR_REFILL_TRAVEL * travel + AIR_REFILL_PAD_SEC),
    critical: Math.max(AIR_CRITICAL_FRAC * tank, AIR_CRITICAL_TRAVEL * travel + AIR_CRITICAL_PAD_SEC),
  };
}

/** The `airMargin` input (see the file header); undefined while the need does not apply. */
export function airMargin(sim: Sim, id: number): number | undefined {
  if (!airDraining(sim, id)) return undefined;
  const ticks = sourceTicks(sim, id);
  const { refill, critical, tank } = airLines(sim, id, Math.max(0, ticks) / TICK_HZ);
  const air = airLeftSec(sim, id);
  if (air < critical) return Math.floor((500 * air) / critical);
  if (air < refill) return 500 + Math.floor((500 * (air - critical)) / Math.max(1e-6, refill - critical));
  return 1000 + Math.min(1000, Math.floor((1000 * (air - refill)) / tank));
}

/** The `airSource` input: 1000 when a source can be reached, 0 when none can; undefined while the need does not apply. */
export function airSourceInput(sim: Sim, id: number): number | undefined {
  if (!airDraining(sim, id)) return undefined;
  return sourceTicks(sim, id) >= 0 ? 1000 : 0;
}
