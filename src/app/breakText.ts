import { MoodC, type BreakContext, type BreakKind, type Sim } from '../sim';
import { stressors } from '../sim/crew/stress';

/** What set a break off, for the log and the inspector ("the fire"). */
const BECAUSE: Record<BreakContext, string> = {
  lowMood: 'low spirits', fire: 'the fire', combat: 'the fighting', decompression: 'the decompression', blackout: 'the dark', exhaustion: 'exhaustion', grief: 'grief',
};

/** The log and alert line of a break that began: "panicked and fled the fire". */
export function breakWhat(kind: BreakKind, context: BreakContext): string {
  const why = BECAUSE[context];
  switch (kind) {
    case 'panic': return context === 'lowMood' ? 'panicked' : `panicked and fled ${why}`;
    case 'freeze': return context === 'lowMood' ? 'froze' : `froze at ${why}`;
    case 'hide': return `hid from ${why}`;
    case 'tantrum': return context === 'lowMood' ? 'threw a tantrum' : `threw a tantrum over ${why}`;
    case 'despair': return context === 'lowMood' ? 'gave in to despair' : `gave in to despair over ${why}`;
    case 'refusal': return context === 'lowMood' ? 'is refusing to work' : `is refusing to work: ${why}`;
    default: return context === 'lowMood' ? 'wants to be alone' : `wants to be alone: ${why}`;
  }
}

/** One or two words for the crew bar and the Overview line. */
export function breakWord(kind: BreakKind): string {
  const word: Record<BreakKind, string> = {
    panic: 'Panicking', freeze: 'Frozen', hide: 'Hiding', tantrum: 'Throwing a tantrum', despair: 'In despair', refusal: 'Refusing work', isolation: 'Wants to be alone',
  };
  return word[kind];
}

/** The inspector's Conditions line while a break lasts: "panicking, 24 s left". */
export function breakNow(kind: BreakKind, secLeft: number): string {
  return `${breakWord(kind)}, ${Math.max(0, Math.ceil(secLeft))} s left`;
}

/**
 * The stressors acting on a crew member now that can set off a break whatever their mood ("the dark"), joined; '' for none. Shown beside
 * the mood (#404: a break in the dark while the mood read "content" looked like a bug).
 */
export function strainOf(sim: Sim, id: number): string {
  const m = sim.world.get(id, MoodC);
  return m ? stressors(sim, id, m).map((s) => BECAUSE[s.context]).join(', ') : '';
}
