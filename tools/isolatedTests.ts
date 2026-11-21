/**
 * Test files that change global state: module mocks, spies on globals, fake timers, environment variables. Each runs in a
 * fresh module graph. Every other file shares its worker's loaded modules (`isolate: false`), which saves re-importing the
 * whole sim and content for each of the ~280 files. A new test that mocks or stubs something, or changes data the sim
 * caches per seed (generated galaxy nodes), goes in this list.
 */
export const ISOLATED = [
  'src/app/saves.test.ts',
  'src/app/playHook.test.ts', // stubs `window`
  'src/app/stockHints.test.ts', // these two set `danger` on generated nodes, which are cached per seed
  'src/content/standing.test.ts',
  'src/content/derelictFailure.test.ts',
  'src/content/researchReach.test.ts', // ~1.4 GB of heap by itself (20 galaxies revealed to radius 14): in a shared worker it ran out of heap on whatever the earlier files left
  'src/content/jobs.test.ts',
  'src/content/ships/envSkip.test.ts',
  'src/content/ships/envSkip.slow.test.ts',
  'src/render/moduleMemo.test.ts', // switches the module-level memo off and back
  'tools/layout/lab.test.ts', // stubs `window` for the lab's state
  'tools/layout/move.test.ts', // the same
  'src/render/animClock.test.ts',
  'src/render/assets/compose.test.ts',
  'src/render/assets/gpuKeep.test.ts',
  'src/render/moduleStrips.test.ts',
  'src/render/partPick.test.ts',
  'src/render/pixiFixes.test.ts', // patches two pixi BindGroup methods
  'src/render/regionTiles.test.ts',
  'src/sim/sector/translate.test.ts', // reads the global component registry that ecs.test.ts adds to
  'src/sim/systems/envSolvers.test.ts',
  'src/content/stationBuildMemo.test.ts', // mocks buildStation to count and stub the builds
];
