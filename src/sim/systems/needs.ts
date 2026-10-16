import { releaseBedClaim } from '../crew/beds';
import { BedClaimC, CrewC, NeedsC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { stat } from '../stats';
import { BED_REST_MULT } from '../tuning';

/** Sleeping recovers this many times faster than awake decay. */
const SLEEP_RECOVERY_MULT = 5;

/**
 * Rest decays while awake and recovers while sleeping (BED_REST_MULT times faster again when
 * lying in the bed the crew member reserved); sleepers wake at 100 and give the bed back.
 */
export function needsSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, NeedsC)) {
    const crew = sim.world.get(id, CrewC);
    const needs = sim.world.get(id, NeedsC);
    if (!crew || !needs) continue;
    if (isIncapacitated(sim, id)) continue;
    const perTick = stat(sim, id, 'restDecay') / TICK_HZ;
    if (crew.activity === 'sleeping') {
      needs.rest = Math.min(100, needs.rest + perTick * SLEEP_RECOVERY_MULT * (inBed(sim, id) ? BED_REST_MULT : 1));
      if (needs.rest >= 100) {
        releaseBedClaim(sim, id);
        crew.activity = 'idle';
        sim.events.emit({ type: 'crew.wokeUp', crew: id });
      }
    } else {
      needs.rest = Math.max(0, needs.rest - perTick);
    }
  }
}

/** True if the crew member is on the tile of the bed they reserved. */
function inBed(sim: Sim, id: number): boolean {
  const claim = sim.world.get(id, BedClaimC);
  const bed = claim && sim.world.get(claim.bed, ModuleC);
  const pos = sim.world.get(id, PositionC);
  return !!bed && !!pos && pos.x === bed.x && pos.y === bed.y;
}
