import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { InterestsC, WontDoC } from './background';
import type { WorkCategory } from './components';
import { crewTitle, defaultPriorities } from './profile';
import { SKILLS } from './skillList';

/** A crew member's skill levels now (rolled, XP and traits), for the profile owners. */
export function currentSkills(sim: Sim, id: number): Partial<Record<SkillName, number>> {
  const out: Partial<Record<SkillName, number>> = {};
  for (const k of SKILLS) out[k] = Math.max(0, Math.round(stat(sim, id, k)));
  return out;
}

/** `defaultPriorities` of a crew member as they are now (`crew.resetPriorities`). */
export function priorityDefaults(sim: Sim, id: number): Record<WorkCategory, number> {
  return defaultPriorities(currentSkills(sim, id), sim.world.get(id, InterestsC), sim.world.get(id, WontDoC)?.ids);
}

/** A crew member's title from their skills now (cosmetic), or undefined for crew without a background (robots, NPC kinds: their kind's name). */
export function titleOf(sim: Sim, id: number): string | undefined {
  const interests = sim.world.get(id, InterestsC);
  return interests ? crewTitle(currentSkills(sim, id), interests) : undefined;
}
