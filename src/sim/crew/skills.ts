import type { Modifier, ModifierSource, StatName } from '../stats';
import { CrewC } from './components';

const NONE: readonly Modifier[] = [];

/** Skill levels a crew member's role grants (gunnery, piloting, shielding) as additive stat modifiers. */
export const roleSkillModifiers: ModifierSource = (sim, entity) => {
  const crew = sim.world.get(entity, CrewC);
  const skills = crew && sim.content.roles[crew.role]?.skills;
  if (!skills) return NONE;
  return Object.entries(skills).map(([stat, value]) => ({ stat: stat as StatName, op: 'add' as const, value: value as number }));
};
