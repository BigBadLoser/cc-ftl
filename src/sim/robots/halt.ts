import { releaseBedClaim } from '../crew/beds';
import { CrewC, DeadC, PositionC, type Crew } from '../crew/components';
import { releaseAssignment } from '../crew/helpers';
import { FighterC } from '../fight/components';
import { dropCarried } from '../items/stacks';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { StunC } from './components';
import { freeze, speciesOf } from './core';

/** Stop a crew member in place: job, bed claim, load and fight dropped; activity 'inert'. */
export function haltCrew(sim: Sim, id: number): void {
  releaseAssignment(sim, id);
  releaseBedClaim(sim, id);
  dropCarried(sim, id);
  const f = sim.world.get(id, FighterC);
  if (f) Object.assign(f, { mode: 'idle', target: 0, ordered: 0 });
  const pos = sim.world.get(id, PositionC);
  if (pos) freeze(pos);
  (sim.world.get(id, CrewC) as Crew).activity = 'inert';
}

/** Ion/EMP hit on a crew member: an ion-vulnerable species is stunned for its ionStunSec (timers do not stack). */
export function stunCrew(sim: Sim, id: number): boolean {
  const sec = speciesOf(sim, id)?.ionStunSec;
  if (!sec || sim.world.has(id, DeadC)) return false;
  const until = sim.tick + Math.round(sec * TICK_HZ);
  const cur = sim.world.get(id, StunC);
  sim.world.add(id, StunC, { until: Math.max(until, cur?.until ?? 0) });
  haltCrew(sim, id);
  sim.events.emit({ type: 'robot.stunned', crew: id, until: Math.max(until, cur?.until ?? 0) });
  return true;
}
