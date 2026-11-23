import { DeadC } from '../crew/components';
import { injuryStep } from '../crew/injuryCare';
import { InjuriesC } from '../crew/injuryTypes';
import { INJURY_STEP_TICKS } from '../crew/tuningInjury';
import { isFrozen } from '../stasis/query';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * Crew injuries over time (#601), every `INJURY_STEP_TICKS`: bleeding, healing, scars and a medic's treatment at a medical bed (crew/injuryCare.ts).
 * Not for a prisoner frozen in stasis: their wounds wait. After vitals, so the hp a bleed takes downs them on vitals' next pass, as combat damage does.
 */
export function injurySystem(sim: Sim): void {
  if (sim.tick % INJURY_STEP_TICKS !== 0) return;
  const dt = INJURY_STEP_TICKS / TICK_HZ;
  for (const id of sim.world.query(InjuriesC)) if (!sim.world.has(id, DeadC) && !isFrozen(sim, id)) injuryStep(sim, id, dt);
}
