/** The scenario builder's public face: one builder for tests, `?scenario=` and the profiler. See docs/ARCHITECTURE.md ("Scenario builder"). */
export { buildScenario, attachHooks, play, type Built, type BuildOpts, type PlayOpts } from './build';
export { mergeSpec, canonical } from './merge';
export { presets, hooks, parts, partKeys, checkSpec } from './registry';
export { parseScenarioUrl, type ScenarioUrl } from './url';
export * from './types';
