import { defineComponent } from '../ecs';
import type { SkillName } from '../registry';
import type { Modifier, ModifierSource } from '../stats';

/** Skill experience a crew member earned from events: every XP_PER_LEVEL adds one level through the stat resolver. */
export interface SkillXp {
  xp: Partial<Record<SkillName, number>>;
}
export const SkillXpC = defineComponent<SkillXp>('skillXp');

/**
 * Implants a crew member carries (content ids). Placeholder until the implant system lands: events only read it.
 * Nothing grants these yet except tests and the debug hook.
 */
export interface Implants {
  list: string[];
}
export const ImplantsC = defineComponent<Implants>('implants');

export const XP_PER_LEVEL = 100;

const NONE: readonly Modifier[] = [];

/** Stat modifier source: levels earned from event skill xp. */
export const xpSkillModifiers: ModifierSource = (sim, entity) => {
  const xp = sim.world.get(entity, SkillXpC)?.xp;
  if (!xp) return NONE;
  return Object.entries(xp).map(([stat, v]) => ({ stat: stat as Modifier['stat'], op: 'add' as const, value: Math.floor((v ?? 0) / XP_PER_LEVEL) }));
};
