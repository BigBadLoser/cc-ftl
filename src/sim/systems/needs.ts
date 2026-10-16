import { CrewC, NeedsC } from '../crew/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../sim';
import { stat } from '../stats';

/** Sleeping recovers this many times faster than awake decay. */
const SLEEP_RECOVERY_MULT = 5;

/** Rest decays while awake and recovers while sleeping; sleepers wake at 100. */
export function needsSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, NeedsC)) {
    const crew = sim.world.get(id, CrewC);
    const needs = sim.world.get(id, NeedsC);
    if (!crew || !needs) continue;
    const perTick = stat(sim, id, 'restDecay') / TICK_HZ;
    if (crew.activity === 'sleeping') {
      needs.rest = Math.min(100, needs.rest + perTick * SLEEP_RECOVERY_MULT);
      if (needs.rest >= 100) {
        crew.activity = 'idle';
        sim.events.emit({ type: 'crew.wokeUp', crew: id });
      }
    } else {
      needs.rest = Math.max(0, needs.rest - perTick);
    }
  }
}
