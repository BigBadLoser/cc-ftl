import type { Modifier, ModifierSource, StatName } from '../stats';
import { CrewC } from './components';
import { RolledSkillsC } from './traits';

const NONE: readonly Modifier[] = [];

/**
 * A crew member's starting skill levels as additive stat modifiers: the rolled snapshot (`RolledSkillsC`) when there is one,
 * which replaces the role's skills (a skill missing from it is 0), else the role's skills (robots, aliens, NPC crew, old saves).
 */
export const roleSkillModifiers: ModifierSource = (sim, entity) => {
  const rolled = sim.world.get(entity, RolledSkillsC);
  const crew = rolled ? undefined : sim.world.get(entity, CrewC);
  const skills = rolled ? rolled.skills : crew && sim.content.roles[crew.role]?.skills;
  if (!skills) return NONE;
  return Object.entries(skills).map(([stat, value]) => ({ stat: stat as StatName, op: 'add' as const, value: value as number }));
};
