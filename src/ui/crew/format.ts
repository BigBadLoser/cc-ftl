/** The word for a mood score (the crew card and the inspector). */
export const moodWord = (v: number): string => (v < 20 ? 'miserable' : v < 35 ? 'unhappy' : v < 65 ? 'content' : 'happy');

/** The icon of each skill (the Skills tab). */
export const SKILL_ICON: Record<string, string> = {
  gunnery: 'target', piloting: 'helm', shielding: 'shield', melee: 'sword', repair: 'wrench', hacking: 'code', medicine: 'medkit', science: 'research',
};

/** Pip colours by where a skill level comes from. */
export const SOURCE_COLOR = { rolled: '#8b939a', xp: 'var(--cyan)', trait: 'var(--green)' } as const;
