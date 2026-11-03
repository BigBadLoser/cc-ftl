import type { BenchOpts } from './salvageBench';

/**
 * The throughput baseline of the salvage bench (docs/ARCHITECTURE.md "Throughput check", #286): scrap units brought home in 2 game hours, per variant
 * and seed (1, 2, 3), and stripping jobs done. Re-based on slice 3's staging (an away site's staging zone, gathered hauls, crate loading) with the
 * bench's own ration locker (`stockRations`): the old salvage-team numbers (main 6108953: 6 crew 720/702/805, 4 crew 841/926/766, airlock 0) no longer
 * apply. Refresh only when the bench itself changes or a change is meant to move salvage throughput, never to make a slice pass.
 */
export const BASELINE_COMMIT = 'slice 3 staging (#286)';

export type BenchVariant = BenchOpts;
export type BenchKey = '6' | '6lock' | '4' | '4lock';
export const variantKey = (v: BenchVariant): BenchKey => `${v.crew}${v.airlock ? 'lock' : ''}` as BenchKey;

/** Per seed: scrap units home after 2 game hours, and stripping jobs done on the wreck. */
export const BASELINE: Record<BenchKey, readonly { scrap: number; stripped: number }[]> = {
  '6': [{ scrap: 779, stripped: 471 }, { scrap: 699, stripped: 428 }, { scrap: 822, stripped: 479 }],
  '4': [{ scrap: 600, stripped: 370 }, { scrap: 624, stripped: 378 }, { scrap: 552, stripped: 331 }],
  '6lock': [{ scrap: 779, stripped: 465 }, { scrap: 698, stripped: 416 }, { scrap: 716, stripped: 434 }],
  '4lock': [{ scrap: 673, stripped: 393 }, { scrap: 645, stripped: 384 }, { scrap: 611, stripped: 364 }],
};
