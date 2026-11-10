import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import type { Modifier, ModifierSource, StatName } from '../stats';
import { CrewC } from './components';
import { RolledSkillsC } from './traits';

const NONE: readonly Modifier[] = [];
const NO_SKILLS: Readonly<Partial<Record<SkillName, number>>> = {};

/**
 * A crew member's starting skill levels (0-10): the rolled snapshot (`RolledSkillsC`) when there is one, which replaces the
 * role's skills (a skill missing from it is 0), else the role's (crew kind's) skills (robots, aliens, NPC crew). The one owner
 * of "what did they start with"; XP levels and traits stack on top in the stat resolver.
 */
export function baseSkills(sim: Sim, entity: number): Readonly<Partial<Record<SkillName, number>>> {
  const rolled = sim.world.get(entity, RolledSkillsC);
  if (rolled) return rolled.skills;
  const crew = sim.world.get(entity, CrewC);
  return (crew && sim.content.roles[crew.role]?.skills) || NO_SKILLS;
}

/** `baseSkills` as additive stat modifiers. */
export const roleSkillModifiers: ModifierSource = (sim, entity) => {
  const skills = baseSkills(sim, entity);
  if (skills === NO_SKILLS) return NONE;
  return Object.entries(skills).map(([stat, value]) => ({ stat: stat as StatName, op: 'add' as const, value: value as number }));
};
