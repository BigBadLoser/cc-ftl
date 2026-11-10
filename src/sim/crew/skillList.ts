import type { SkillName } from '../registry';

/** The one list of skills, in display order (docs/TRAITS.md 10.2). Every table keyed by skill is a `Record<SkillName, ...>`. */
export const SKILLS: readonly SkillName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'construction', 'hacking', 'medicine', 'science', 'cooking', 'botany', 'industry'];

/** Display names of the skills. */
export const SKILL_NAMES: Readonly<Record<SkillName, string>> = {
  gunnery: 'Gunnery', piloting: 'Piloting', shielding: 'Shielding', melee: 'Melee', construction: 'Construction', hacking: 'Hacking',
  medicine: 'Medicine', science: 'Science', cooking: 'Cooking', botany: 'Botany', industry: 'Industry',
};

/** Skills run 0-10 (docs/TRAITS.md 10.3). Traits may push a stat past this; bars clamp here. */
export const SKILL_MAX = 10;
