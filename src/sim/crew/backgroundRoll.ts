import type { ContentRegistry, SkillName } from '../registry';
import type { Rng } from '../rng';
import type { Background, CareerDef, Interests, UpbringingDef, WontDoId } from './background';
import { WONT_DO_SKILLS } from './background';
import { SKILLS } from './skillList';

/** The background roll (docs/TRAITS.md 10.6): skills, interests and won't-do from an upbringing and a career. Pure, one RNG. */

/** No rolled skill goes above this (XP takes it to 10). */
export const SKILL_ROLL_CAP = 8;
/** A starting berth's soft career hint: careers that fit the berth weigh this much more. */
const HINT_WEIGHT = 10;
/** Chance of a knack: one skill at 0 gets +3 to +5. */
const KNACK_CHANCE = 0.12;

type Skills = Partial<Record<SkillName, number>>;

export interface BackgroundRoll {
  background: Background;
  skills: Skills;
  interests: Interests;
  wontDo: WontDoId[];
  /** The career's main skill (a trait whose won't-do rules it out is not rolled). */
  main?: SkillName;
  /** The roll weight multipliers the backgrounds put on traits (multiplied together). */
  traitWeights: Record<string, number>;
}

/** Weighted pick of an index; -1 when every weight is 0. Always one draw. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const sum = weights.reduce((n, w) => n + Math.max(0, w), 0);
  const r = rng.next() * sum;
  if (sum <= 0) return -1;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += Math.max(0, weights[i] ?? 0);
    if (r < acc) return i;
  }
  return weights.length - 1;
}

const allows = (def: { species?: readonly string[] }, species: string): boolean => (def.species ?? ['species.human']).includes(species);

/** A career's main skill: its highest skill (first in `SKILLS` order on a tie), or none for the Drifter. */
export function mainSkill(def: CareerDef): SkillName | undefined {
  let best: SkillName | undefined;
  for (const k of SKILLS) if ((def.skills[k] ?? 0) > (best ? def.skills[best] ?? 0 : 0)) best = k;
  return best;
}

/**
 * Roll a background for a person of `species`. `hint`: skills a career's main skill should be among. `strict` (content that names an
 * old role for a recruit or a rescued crew member, 10.11) keeps only those careers; otherwise (a starting berth) they weigh HINT_WEIGHT
 * times more. Ignored when no career matches.
 */
export function rollBackground(rng: Rng, content: ContentRegistry, species: string, hint?: readonly SkillName[], strict = true): BackgroundRoll | null {
  const ups = Object.entries(content.upbringings ?? {}).filter(([, d]) => allows(d, species));
  let careers = Object.entries(content.careers ?? {}).filter(([, d]) => allows(d, species));
  if (!ups.length || !careers.length) return null;
  const hinted = (d: CareerDef): boolean => !!hint?.includes(mainSkill(d) as SkillName);
  if (strict && careers.some(([, d]) => hinted(d))) careers = careers.filter(([, d]) => hinted(d));
  const [upId, up] = ups[Math.max(0, weightedIndex(rng, ups.map(([, d]) => d.weight)))] as [string, UpbringingDef];
  const [careerId, career] = careers[Math.max(0, weightedIndex(rng, careers.map(([, d]) => d.weight * (d.upbringings?.[upId] ?? 1) * (!strict && hinted(d) ? HINT_WEIGHT : 1))))] as [string, CareerDef];

  // Base: upbringing + career; the Drifter's 7 points land on random skills (+3, then +2 twice).
  const s = Object.fromEntries(SKILLS.map((k) => [k, (up.skills[k] ?? 0) + (career.skills[k] ?? 0)])) as Record<SkillName, number>;
  const drift: SkillName[] = [];
  if (career.drifter) {
    for (const add of [3, 2, 2]) {
      const pool = SKILLS.filter((k) => !drift.includes(k));
      const k = pool[rng.int(0, pool.length - 1)] as SkillName;
      drift.push(k);
      s[k] += add;
    }
  }
  // Noise: one draw per skill, -1 (20%), 0 (45%), +1 (25%), +2 (10%).
  for (const k of SKILLS) {
    const r = rng.next();
    s[k] = Math.max(0, s[k] + (r < 0.2 ? -1 : r < 0.65 ? 0 : r < 0.9 ? 1 : 2));
  }
  // Surprise: a knack in a skill they had nothing in.
  let knack: SkillName | undefined;
  const surprise = rng.next() < KNACK_CHANCE;
  const blanks = SKILLS.filter((k) => s[k] === 0);
  const pick = rng.int(0, Math.max(0, blanks.length - 1));
  const size = rng.int(3, 5);
  if (surprise && blanks.length) {
    knack = blanks[pick] as SkillName;
    s[knack] += size;
  }
  for (const k of SKILLS) s[k] = Math.min(SKILL_ROLL_CAP, s[k]);

  // Interests: 0-3 picks without replacement, weighted by level and by the backgrounds naming the skill; at most one passionate.
  const named = (k: SkillName): boolean => !!(up.interests?.[k] || career.interests?.[k] || (career.drifter && k === drift[0]));
  const r = rng.next();
  const count = r < 0.15 ? 0 : r < 0.55 ? 1 : r < 0.9 ? 2 : 3;
  const interests: Interests = { keen: [], passionate: [] };
  let pool = [...SKILLS];
  for (let i = 0; i < count; i++) {
    const idx = weightedIndex(rng, pool.map((k) => 1 + s[k] / 2 + (named(k) ? 3 : 0)));
    const passion = rng.next() < 0.25;
    const k = pool[idx] as SkillName;
    if (passion && interests.passionate.length === 0) interests.passionate.push(k);
    else interests.keen.push(k);
    pool = pool.filter((o) => o !== k);
  }

  // Won't do: each background rolls its own; at most one, never one that rules out the career's main skill.
  const wontDo: WontDoId[] = [];
  const main = mainSkill(career);
  for (const b of [up, career]) {
    const hit = !!b.wontDo && rng.next() < b.wontDo.chance;
    if (hit && b.wontDo && !wontDo.length && !(main && WONT_DO_SKILLS[b.wontDo.id].includes(main))) wontDo.push(b.wontDo.id);
  }

  const traitWeights: Record<string, number> = {};
  for (const b of [up, career]) for (const [t, w] of Object.entries(b.traitWeights ?? {})) traitWeights[t] = (traitWeights[t] ?? 1) * w;
  const skills: Skills = {};
  for (const k of SKILLS) if (s[k] > 0) skills[k] = s[k];
  return { background: { upbringing: upId, career: careerId, ...(knack ? { knack } : {}) }, skills, interests, wontDo, traitWeights, ...(main ? { main } : {}) };
}
