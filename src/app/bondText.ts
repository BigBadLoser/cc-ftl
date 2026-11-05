/** The words for bond reasons (the ids in `content/interactions.ts` and `crew/bondSources.ts`), as "<what happened>" after "Friend: ". */
const WHY: Record<string, string> = {
  chat: 'good talks', badChat: 'awkward talks', row: 'shouting matches', together: 'time spent together', worked: 'worked side by side', grated: 'getting on each other\'s nerves',
  fought: 'fought together', downedBeside: 'went down beside each other', rescued: 'was carried to safety', rescuer: 'carried them to safety', witness: 'saw a crewmate die together',
  tantrum: 'made a scene',
};

export const bondWhy = (id: string): string => WHY[id] ?? id;

/** One reason in a sentence, with where it happened: "fought together at Ithra". */
export const bondReasonText = (id: string, at?: string): string => `${bondWhy(id)}${at ? ` at ${at}` : ''}`;

/** The label of a score: a friend, a rival, or how warm or cold it runs. */
export function bondWord(score: number, kind?: 'friend' | 'rival'): string {
  if (kind === 'friend') return 'Friend';
  if (kind === 'rival') return 'Rival';
  return score >= 20 ? 'Friendly' : score <= -20 ? 'Cool' : 'Acquaintance';
}
