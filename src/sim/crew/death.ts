import type { Sim } from '../sim';
import { releaseBedClaim } from './beds';
import {
  AssignmentC, CrewC, DeadC, DownedC, DraftedC, NeedsC, PathC, PrioritiesC, type Crew,
} from './components';
import { dropWeapon } from '../fight/equip';
import { releaseAssignment } from './helpers';

/** Kill a crew member now: drop their job and bed claim, strip AI components, mark dead. No-op if already dead. */
export function killCrew(sim: Sim, id: number): void {
  if (sim.world.has(id, DeadC) || !sim.world.has(id, CrewC)) return;
  releaseAssignment(sim, id);
  releaseBedClaim(sim, id);
  dropWeapon(sim, id);
  sim.world.remove(id, DownedC);
  for (const key of [DraftedC, PrioritiesC, NeedsC, AssignmentC]) sim.world.remove(id, key);
  const path = sim.world.get(id, PathC);
  if (path) path.steps = [];
  sim.world.add(id, DeadC, { tick: sim.tick });
  (sim.world.get(id, CrewC) as Crew).activity = 'dead';
  sim.events.emit({ type: 'crew.died', crew: id });
}
