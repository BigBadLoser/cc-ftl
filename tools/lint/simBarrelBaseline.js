// Test files that still import the sim barrel (src/sim/index.ts). The rule in eslint.config.js ignores exactly these; a file leaves
// the list when it imports the modules that own what it uses. Do not add to it.
export default [
  'src/app/ambushScene.test.ts',
  'src/app/scenarios/inspect.test.ts',
  'src/app/scenarios/inspectFight.test.ts',
  'src/app/scenarios/medpod.test.ts',
  'src/app/scenarios/patrol.test.ts',
  'src/app/scenarios/pirates.test.ts',
  'src/app/scenarios/stasis.test.ts',
  'src/content/freighter.slow.test.ts',
  'src/content/freighter.test.ts',
];
