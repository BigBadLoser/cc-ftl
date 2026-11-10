import type { ContentRegistry, ShipTemplate, SkillName } from '../registry';
import { WONT_DO_CATEGORY, interestIn, type Interests, type WontDoId } from './background';
import type { WorkCategory } from './components';
import { SKILLS } from './skillList';

/**
 * What a role used to answer for the player's crew, from skills instead (docs/TRAITS.md 10.8): a cosmetic title, the default
 * job priorities and the jobs a hull needs. Pure.
 */

type Skills = Readonly<Partial<Record<SkillName, number>>>;

/** The title a crew member's best skill gives them (cosmetic). */
export const SKILL_TITLES: Readonly<Record<SkillName, string>> = {
  gunnery: 'Gunner', piloting: 'Pilot', shielding: 'Engineer', melee: 'Security', construction: 'Engineer', hacking: 'Hacker',
  medicine: 'Medic', science: 'Scientist', cooking: 'Cook', botany: 'Botanist', industry: 'Machinist',
};
/** Below this best skill a crew member is a "Hand". */
const TITLE_MIN = 3;

/** The best skill: highest level; ties go to a passionate one, then a keen one, then `SKILLS` order. */
export function bestSkill(skills: Skills, interests?: Interests): SkillName {
  let best: SkillName = SKILLS[0] as SkillName;
  let score = -1;
  for (const k of SKILLS) {
    const s = (skills[k] ?? 0) * 10 + interestIn(interests, k);
    if (s > score) {
      best = k;
      score = s;
    }
  }
  return best;
}

/** A crew member's title ("Engineer", "Gunner", "Hand"). No effect on play. */
export function crewTitle(skills: Skills, interests?: Interests): string {
  const k = bestSkill(skills, interests);
  return (skills[k] ?? 0) < TITLE_MIN ? 'Hand' : SKILL_TITLES[k];
}

/** The skill behind each work category's default priority (operating: the best console skill; null: a fixed level). */
const CATEGORY_SKILL: Readonly<Record<WorkCategory, readonly SkillName[] | number>> = {
  operating: ['piloting', 'gunnery', 'shielding'], repair: ['construction'], construction: ['construction'], refining: ['industry'],
  crafting: ['industry'], farming: ['botany'], medical: ['medicine'], research: ['science'], cooking: ['cooking'],
  firefighting: 1, hauling: 3, patrol: 0,
};

/** Priority level from a skill and its interest: >= 6 or passionate >= 3 -> 1; 4-5 or keen >= 2 -> 2; 2-3 -> 3; else 4 (Q3, tune after a playtest). */
function levelFor(skill: number, interest: number): number {
  if (skill >= 6 || (interest === 2 && skill >= 3)) return 1;
  if (skill >= 4 || (interest >= 1 && skill >= 2)) return 2;
  return skill >= 2 ? 3 : 4;
}

/**
 * A crew member's default priorities (spawn and `crew.resetPriorities`): from their skills and interests, with a won't-do category off.
 * Operating follows the best console skill; a console is still only taken at OPERATE_MAX_LEVEL or better outside relief (ai/jobRank.ts).
 */
export function defaultPriorities(skills: Skills, interests?: Interests, wontDo: readonly WontDoId[] = []): Record<WorkCategory, number> {
  const out = {} as Record<WorkCategory, number>;
  for (const [cat, rule] of Object.entries(CATEGORY_SKILL) as [WorkCategory, readonly SkillName[] | number][]) {
    if (typeof rule === 'number') out[cat] = rule;
    else {
      const k = rule.reduce((a, b) => ((skills[b] ?? 0) * 10 + interestIn(interests, b) > (skills[a] ?? 0) * 10 + interestIn(interests, a) ? b : a));
      out[cat] = levelFor(skills[k] ?? 0, interestIn(interests, k));
    }
  }
  for (const w of wontDo) {
    const cat = WONT_DO_CATEGORY[w];
    if (cat) out[cat] = 0;
  }
  return out;
}

/** A job the ship needs someone for (the new-game "Ship's jobs" list), and the skills that cover it (the best of them counts). */
export interface ShipJob {
  id: 'helm' | 'weapons' | 'shields' | 'repair' | 'medic' | 'cook' | 'boarders' | 'science' | 'farming' | 'industry';
  name: string;
  skills: readonly SkillName[];
}

/** Below this level a ship's job reads as weakly covered. */
export const SHIP_JOB_WEAK_BELOW = 3;

/** The jobs a hull needs (docs/TRAITS.md 10.8): Helm, Weapons, Shields, Medic, Cook, Science, Farming, Industry by its modules; Repair and Boarders always. */
export function shipJobs(ship: ShipTemplate, content: ContentRegistry): ShipJob[] {
  const defs = (ship.modules ?? []).map((m) => content.modules[m.def]).filter((d) => !!d);
  const has = (test: (d: (typeof defs)[number]) => boolean): boolean => defs.some(test);
  const out: ShipJob[] = [];
  const add = (id: ShipJob['id'], name: string, skills: readonly SkillName[], on: boolean): void => void (on && out.push({ id, name, skills }));
  add('helm', 'Helm', ['piloting'], has((d) => d.console === 'helm'));
  add('weapons', 'Weapons', ['gunnery'], has((d) => d.console === 'weapons' || !!d.weapon));
  add('shields', 'Shields', ['shielding'], has((d) => !!d.shieldGen || d.console === 'shields'));
  add('repair', 'Repair', ['construction'], true);
  add('medic', 'Medic', ['medicine'], has((d) => !!d.medical || !!d.bed));
  add('cook', 'Cook', ['cooking'], has((d) => !!d.galley));
  add('boarders', 'Boarders', ['melee', 'gunnery'], true);
  add('science', 'Science', ['science'], has((d) => !!d.research));
  add('farming', 'Farming', ['botany'], has((d) => !!d.plot));
  add('industry', 'Industry', ['industry'], has((d) => !!d.crafting && !d.galley));
  return out;
}

/** The level a crew member brings to a ship's job: their best skill of its list. */
export const jobLevel = (job: ShipJob, skills: Skills): number => Math.max(0, ...job.skills.map((k) => skills[k] ?? 0));
