import { defineComponent } from '../ecs';

/**
 * Mental breaks (docs/TRAITS.md section 5). A *context* is what tipped the crew member over, a *kind* is what they do,
 * a *tier* is how hard it overrides the crew AI: severe breaks are interrupts that beat a draft, moderate ones are interrupts
 * a draft ends, mild ones are not interrupts (the work drive scores 0 while one lasts).
 */
export type BreakContext = 'lowMood' | 'fire' | 'combat' | 'decompression' | 'blackout' | 'exhaustion' | 'grief';
export type BreakKind = 'panic' | 'freeze' | 'hide' | 'tantrum' | 'despair' | 'refusal' | 'isolation';
export type BreakTier = 'severe' | 'moderate' | 'mild';

export interface Tile2 {
  x: number;
  y: number;
}

/** The running break, removed when it ends. Optional component: crew without one are not breaking. */
export interface Breakdown {
  kind: BreakKind;
  tier: BreakTier;
  context: BreakContext;
  /** The latest tick it ends. */
  until: number;
  since: number;
  /** The tick its context was first found absent after being present (0 while present); it ends BREAK_GONE_SEC later. */
  goneSince: number;
  /** The stressor's focus (the nearest burning tile or hostile when it began): what panic flees from. Absent: their own tile. */
  src?: Tile2;
}
export const BreakdownC = defineComponent<Breakdown>('breakdown');

/** Ticks of the last break's end and of the last end per context: outlives `Breakdown`, saved, so cooldowns survive recovery and loads. */
export interface BreakMemory {
  last?: number;
  byContext: Partial<Record<BreakContext, number>>;
  /** The tick of the last urgent break alert for this crew member (alerts are throttled per crew member). */
  alertAt?: number;
}
export const BreakMemoryC = defineComponent<BreakMemory>('breakMemory');
