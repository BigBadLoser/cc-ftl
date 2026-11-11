import type { UiRollSkill } from './titleApi';

/** The interest mark after a skill: ✦ keen, ✦✦ passionate (docs/TRAITS.md 10.7). */
export const interestMark = (i: number): string => (i >= 2 ? '✦✦' : i === 1 ? '✦' : '');

/** What an interest means, on hover. */
export const interestTip = (i: number): string =>
  i >= 2 ? 'Passionate: learns twice as fast, mood +4 doing this work' : i === 1 ? 'Keen: learns 1.5× as fast, mood +2 doing this work' : '';

/** A crew member's top skills for the roster line: the three best above 0, ties by interest then list order. */
export const topSkills = (skills: readonly UiRollSkill[], n = 3): UiRollSkill[] =>
  skills.filter((s) => s.value > 0).map((s, i) => ({ s, i })).sort((a, b) => b.s.value - a.s.value || b.s.interest - a.s.interest || a.i - b.i).slice(0, n).map((x) => x.s);

/** The colour block of a trait kind (the inspector's trait lines). */
export const traitColor = (kind: string): string =>
  kind === 'behaviour' ? 'var(--cyan)' : kind === 'tradeoff' ? 'var(--green)' : kind === 'phobia' || kind === 'habit' ? 'var(--amber)' : '#8b939a';
