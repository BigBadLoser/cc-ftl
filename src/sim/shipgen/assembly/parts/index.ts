import type { BaysLayout, ProgramRules } from '../../outlineRecipe';
import { DECKS } from './decks';
import { DRUM } from './drum';
import { LANE } from './lane';
import type { BayPart } from './part';

/** The battery: gun rooms along a maintenance corridor (its frame and bays from the mask's `battery`, battery.ts). */
const BATTERY: BayPart = {};

const PARTS: Record<'battery' | 'lane' | 'decks' | 'drum', BayPart> = { battery: BATTERY, lane: LANE, decks: DECKS, drum: DRUM };

/** The room program's rules where no part or recipe sets them. */
const PROGRAM: Required<ProgramRules> = { pods: false, mirror: false, beside: false, holds: false, grow: 2.5, least: 0, pd: true, blocks: true };

/** A bay layout's parts as one: each hook its first part's that has it, the program rules merged, the layout's own last. */
export function partOf(l: BaysLayout): BayPart & { program: Required<ProgramRules> } {
  const ps = (Object.keys(PARTS) as (keyof typeof PARTS)[]).filter((k) => l[k]).map((k) => PARTS[k]);
  const first = <K extends keyof BayPart>(k: K): Partial<Pick<BayPart, K>> => { const p = ps.find((q) => q[k]); return p ? { [k]: p[k] } as Pick<BayPart, K> : {}; };
  return {
    ...first('dock'), ...first('skip'), ...first('cabins'), ...first('paint'), ...first('zones'), ...first('strip'), ...first('mounts'),
    program: Object.assign({}, PROGRAM, ...ps.map((p) => p.program ?? {}), l.program ?? {}) as Required<ProgramRules>,
  };
}

export { cutStrip, stripRoom, type BayGeo, type BayPart } from './part';
