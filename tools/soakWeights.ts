// Seconds per soak file (`*.soak.test.ts`), from the CI timings they had in the slow tier before moving (Nov 2026). vitest.sequencer.ts
// merges these with testWeights.ts so `npm run test:soak` shards balance. testWeights.ts is rewritten from the PR/nightly shards, which
// do not run the soak tier, so these are kept by hand; update them from a soak run when the numbers drift.
export default {
 "src/content/galaxyGrace.soak.test.ts": 186.7,
 "src/content/ships/pace.soak.test.ts": 164.7,
 "src/content/crewBonds.soak.test.ts": 147.6,
 "src/content/galaxyTraffic.soak.test.ts": 83.3,
 "src/content/ships/balance.soak.test.ts": 78.9,
 "src/content/stationLife.soak.test.ts": 61.8,
 "src/content/ships/salvageBench.soak.test.ts": 55.1,
 "src/content/fuelEconomy.soak.test.ts": 52.8,
 "src/content/ships/crewBreakdown.soak.test.ts": 41.4,
};
