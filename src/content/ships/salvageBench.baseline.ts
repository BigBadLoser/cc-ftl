import type { BenchOpts } from './salvageBench';

/**
 * The throughput baseline of the salvage bench (docs/ARCHITECTURE.md "Throughput check", #286): scrap units brought home in 2 game hours, per variant
 * and seed (1, 2, 3), measured on the salvage trip code of `BASELINE_COMMIT` (main before slice 0), on the bench of this slice. Refresh only when the
 * bench itself changes, never to make a slice pass.
 */
export const BASELINE_COMMIT = '6108953';

export type BenchVariant = BenchOpts;
export type BenchKey = '6' | '6lock' | '4' | '4lock';
export const variantKey = (v: BenchVariant): BenchKey => `${v.crew}${v.airlock ? 'lock' : ''}` as BenchKey;

/** Per seed: scrap units home after 2 game hours, and stripping jobs done on the wreck. */
export const BASELINE: Record<BenchKey, readonly { scrap: number; stripped: number }[]> = {
  '6': [],
  '6lock': [],
  '4': [],
  '4lock': [],
};
