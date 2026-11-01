import { defineComponent } from '../ecs';
import type { SkillName } from '../registry';
import type { Modifier, ModifierSource } from '../stats';
import { levelsFor } from '../crew/xpCurve';

/** Skill experience a crew member earned (routine work, events): `levelsFor` turns it into levels through the stat resolver. Written by `grantXp`. */
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

const NONE: readonly Modifier[] = [];

/** Stat modifier source: levels earned from skill xp (docs/TRAITS.md section 3). */
export const xpSkillModifiers: ModifierSource = (sim, entity) => {
  const xp = sim.world.get(entity, SkillXpC)?.xp;
  if (!xp) return NONE;
  return Object.entries(xp).map(([stat, v]) => ({ stat: stat as Modifier['stat'], op: 'add' as const, value: levelsFor(v ?? 0) }));
};
