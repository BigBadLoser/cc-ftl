/** Shared setup of the salvage playtest regressions (#404). */
import type { Sim } from '../../../src/sim/sim';
import { passagesOf } from '../../../src/sim/away/boarding';
import { shuttleOf } from './ferry';
import { setup } from './salvageEva';
import { crewOn, play, siteWork } from './away';

/** A site open on the fixture's wreck, played until its passages are posted at home; the home crew. */
export function boarding(): { sim: Sim; home: number; wreck: number; shuttle: number; crew: number[] } {
  const { sim, home, wreck } = setup(3);
  siteWork(sim, wreck, 3);
  const shuttle = shuttleOf(sim);
  sim.enqueue({ type: 'away.open', ship: wreck });
  play(sim, 20 * 10, () => passagesOf(sim, shuttle).length > 0);
  return { sim, home, wreck, shuttle, crew: crewOn(sim, home) };
}
