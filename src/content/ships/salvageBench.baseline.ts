import type { BenchOpts } from './salvageBench';

/**
 * The throughput baseline of the salvage bench (docs/ARCHITECTURE.md "Throughput check", #286): scrap units brought home in 2 game hours, per variant
 * and seed (1, 2, 3), and stripping jobs done. Re-based on slice 3's staging (an away site's staging zone, gathered hauls, crate loading) with the
 * bench's own ration locker (`stockRations`): the old salvage-team numbers (main 6108953: 6 crew 720/702/805, 4 crew 841/926/766, airlock 0) no longer
 * apply. Re-based again for the rest retune (#278): crew stay awake about 10 times longer, so fewer sleep trips and more throughput (the slice 3
 * numbers were 6 crew 779/699/822, 4 crew 600/624/552, 6lock 779/698/716, 4lock 673/645/611). Refresh only when the bench itself changes or a change is meant to move salvage throughput, never to make a slice pass.
 */
export const BASELINE_COMMIT = 'rest retune (#278)';

export type BenchVariant = BenchOpts;
export type BenchKey = '6' | '6lock' | '4' | '4lock';
export const variantKey = (v: BenchVariant): BenchKey => `${v.crew}${v.airlock ? 'lock' : ''}` as BenchKey;

/** Per seed: scrap units home after 2 game hours, and stripping jobs done on the wreck. */
export const BASELINE: Record<BenchKey, readonly { scrap: number; stripped: number }[]> = {
  '6': [{ scrap: 946, stripped: 632 }, { scrap: 1002, stripped: 635 }, { scrap: 1009, stripped: 628 }],
  '4': [{ scrap: 818, stripped: 514 }, { scrap: 755, stripped: 473 }, { scrap: 754, stripped: 486 }],
  '6lock': [{ scrap: 954, stripped: 625 }, { scrap: 965, stripped: 627 }, { scrap: 1022, stripped: 639 }],
  '4lock': [{ scrap: 775, stripped: 483 }, { scrap: 730, stripped: 463 }, { scrap: 732, stripped: 460 }],
};
