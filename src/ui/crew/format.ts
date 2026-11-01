import type { UiCrew } from '../api';

/** The word for a mood score (the crew card and the inspector). */
export const moodWord = (v: number): string => (v < 20 ? 'miserable' : v < 35 ? 'unhappy' : v < 65 ? 'content' : 'happy');

/** The icon of each skill (the Skills tab). */
export const SKILL_ICON: Record<string, string> = {
  gunnery: 'target', piloting: 'helm', shielding: 'shield', melee: 'sword', repair: 'wrench', hacking: 'code', medicine: 'medkit', science: 'research',
};

/** Pip colours by where a skill level comes from. */
export const SOURCE_COLOR = { rolled: '#8b939a', xp: 'var(--cyan)', trait: 'var(--green)' } as const;

/** The fields of a crew card that decide the state line. */
type StateOf = Pick<UiCrew, 'dead' | 'downed' | 'surrendered' | 'prisoner' | 'drafted' | 'job' | 'activity'> & { fight?: UiCrew['fight'] };

const COVER = { none: 'no cover', partial: 'partial cover', full: 'full cover' } as const;

/** The fight line: fleeing, or who they are attacking, whether the player ordered it, and their cover against that target. */
function fightText(f: NonNullable<UiCrew['fight']>): string | null {
  if (f.mode === 'flee') return 'Fleeing';
  if (f.mode !== 'engage' || !f.target) return null;
  const parts = [`${f.ordered ? 'Ordered to attack' : 'Attacking'} ${f.target}`];
  if (f.cover) parts.push(COVER[f.cover]);
  return parts.join(' · ');
}

/**
 * What the Overview says the crew member is doing, and the state chip shown before it (Prisoner, Surrendered) for any side:
 * a surrendered crew member reads as idle, so the chip is what explains them.
 */
export function crewState(c: StateOf): { chip: string | null; text: string; bad: boolean } {
  const chip = c.dead ? null : c.prisoner ? 'Prisoner' : c.surrendered ? 'Surrendered' : null;
  if (c.dead) return { chip, text: 'Dead', bad: true };
  if (c.downed) return { chip, text: c.downed.stabilized ? 'Downed, stabilized' : `Downed, bleeding out in ${c.downed.bleed} s`, bad: true };
  if (chip) return { chip, text: c.prisoner ? 'Held captive' : 'Out of the fight', bad: false };
  const fight = c.fight ? fightText(c.fight) : null;
  return { chip, text: fight ?? (c.drafted ? 'Drafted' : (c.job ?? c.activity)), bad: false };
}

/** Why a hostile can't be attacked (the disabled Attack button's tooltip), or null when it can. */
export function attackBlocked(c: StateOf): string | null {
  if (c.dead) return 'Dead';
  if (c.prisoner) return 'A prisoner: already captured';
  if (c.surrendered) return 'Surrendered: they have given up';
  if (c.downed) return 'Downed: no longer a threat';
  return null;
}
