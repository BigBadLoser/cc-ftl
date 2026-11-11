import { defineComponent } from '../ecs';
import type { SkillName } from '../registry';
import type { WorkCategory } from './components';

/**
 * Backgrounds, interests and won't-do (docs/TRAITS.md 10.5-10.10). Content: `src/content/backgrounds.ts`. Only crew with moods
 * (people) roll them; robots, aliens and NPC crew keep their crew kind's package.
 */

/** Things a crew member will not do (10.10). `violence` covers weapons, fighting, weapon consoles and attack orders; the rest are work categories. */
export type WontDoId = 'violence' | 'medical' | 'hauling' | 'cooking';

/** The work category a won't-do blocks through `WorkBlockC` (violence is honoured by the fight owner and `jobFits` instead). */
export const WONT_DO_CATEGORY: Readonly<Record<WontDoId, WorkCategory | null>> = { violence: null, medical: 'medical', hauling: 'hauling', cooking: 'cooking' };

/** The skills a won't-do rules out as a career's main skill (a Data broker can be squeamish about violence, a Navy gunner can't). */
export const WONT_DO_SKILLS: Readonly<Record<WontDoId, readonly SkillName[]>> = { violence: ['gunnery', 'melee'], medical: ['medicine'], hauling: [], cooking: ['cooking'] };

/** Display line of a won't-do. */
export const WONT_DO_NAMES: Readonly<Record<WontDoId, string>> = { violence: 'Won’t fight', medical: 'Won’t do medical work', hauling: 'Won’t haul', cooking: 'Won’t cook' };

export interface BackgroundDef {
  name: string;
  /** The dossier line: "Station brat grew up in a dockside hab". */
  line: string;
  /** Roll weight (10 common, 5 uncommon, 2 rare). */
  weight: number;
  /** Levels added before the noise. */
  skills: Partial<Record<SkillName, number>>;
  /** Extra interest weight for these skills (any value > 0 names the skill). */
  interests?: Partial<Record<SkillName, number>>;
  /** A rare refusal. */
  wontDo?: { id: WontDoId; chance: number };
  /** Multiplies a trait's roll weight (Belt-born: Void-born x3). */
  traitWeights?: Record<string, number>;
  /** Species who can have it (default: humans). */
  species?: readonly string[];
}
/** Where a crew member grew up: adds about 3 points. */
export type UpbringingDef = BackgroundDef;
/** What they did before signing on: adds about 7 points. */
export interface CareerDef extends BackgroundDef {
  /** Roll weight multiplier for a matching upbringing id. */
  upbringings?: Record<string, number>;
  /** The surprise career: `skills` is empty; 7 points land on random skills (+3, +2, +2) and the interest is random. */
  drifter?: true;
}

/** A crew member's background, as rolled. `knack`: the skill a surprise put points in (10.6 step 5). */
export interface Background {
  upbringing: string;
  career: string;
  knack?: SkillName;
}
export const BackgroundC = defineComponent<Background>('background');

/** Skills a crew member likes doing: faster XP and a small mood lift doing that work (10.7). */
export interface Interests {
  keen: SkillName[];
  passionate: SkillName[];
}
export const InterestsC = defineComponent<Interests>('interests');

/** What a crew member will not do, from a background or a trait (10.10). Permanent. */
export interface WontDo {
  ids: WontDoId[];
}
export const WontDoC = defineComponent<WontDo>('wontDo');

export type InterestLevel = 0 | 1 | 2;

/** 0 none, 1 keen, 2 passionate. */
export function interestIn(interests: Interests | undefined, skill: SkillName): InterestLevel {
  if (!interests) return 0;
  return interests.passionate.includes(skill) ? 2 : interests.keen.includes(skill) ? 1 : 0;
}

/** XP multiplier of an interest (10.4): x1.5 keen, x2 passionate. */
export const INTEREST_XP: Readonly<Record<InterestLevel, number>> = { 0: 1, 1: 1.5, 2: 2 };
/** Mood points of "enjoying the work" (10.7). */
export const INTEREST_MOOD: Readonly<Record<InterestLevel, number>> = { 0: 0, 1: 2, 2: 4 };
