import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import simBarrelBaseline from './tools/lint/simBarrelBaseline.js';

/** Build a no-restricted-imports rule from exact names and glob patterns. */
const noImports = (names, patterns) => ({
  'no-restricted-imports': ['error', { paths: names, patterns }],
});

const pat = (dirs) => dirs.map((d) => ({ group: [`**/${d}`, `**/${d}/**`], message: `Forbidden import of ${d} here.` }));
const pixiNames = [{ name: 'pixi.js', message: 'pixi.js is only allowed in src/render.' }];
const pixiPat = [{ group: ['pixi.js/*', '@pixi/*'], message: 'pixi.js is only allowed in src/render.' }];
const bitsNames = [{ name: 'bits-ui', message: 'Import from ui/kit; only src/ui/kit may use bits-ui.' }];
const bitsPat = [{ group: ['bits-ui/*'], message: 'Import from ui/kit; only src/ui/kit may use bits-ui.' }];
const sveltePat = [{ group: ['svelte', 'svelte/*'], message: 'svelte is not allowed here.' }];

const simBannedGlobals = ['window', 'document', 'performance', 'Date'].map((name) => ({
  name,
  message: `${name} is banned in src/sim (determinism / purity).`,
}));

/** Step 7d: there are no grid ids and no `sim.grids`: a ship is its ShipC entity id and its bounds are the ShipC rectangle. */
const noGridIds = [
  { selector: "MemberExpression[property.name='gridId']", message: 'No grid ids (step 7d): a ship is its ShipC entity id; use shipIdOf / shipIdAt.' },
  { selector: "MemberExpression[property.name='grids']", message: 'No sim.grids (step 7d): use shipGrid(sim, ship) or regions(sim); bounds are the ShipC rectangle.' },
];

/**
 * Crew AI (docs/CREW_AI.md Phase 1): `AssignmentC` is written only through the task API in src/sim/ai (`reserveJob`, `attachJob`,
 * `detachJob`, `abortTask`), which keeps the `Task` mirror in step. Reading it is fine everywhere.
 */
const assignmentMsg = 'AssignmentC is written only by the task API in src/sim/ai (reserveJob, attachJob, detachJob, abortTask).';
const noAssignmentWrites = [
  { selector: "CallExpression[callee.property.name=/^(add|remove)$/][arguments.1.name='AssignmentC']", message: assignmentMsg },
  { selector: "ArrayExpression > Identifier[name='AssignmentC']", message: assignmentMsg },
  { selector: "AssignmentExpression > MemberExpression.left Identifier[name='AssignmentC']", message: assignmentMsg },
];

const simSyntax = [
  {
    selector: "BinaryExpression[operator=/^[-+]$/][left.type='MemberExpression'][left.object.name=/^(ship|s|sh)$/][left.property.name=/^[xy]$/][right.type='MemberExpression'][right.property.name=/^[xy]$/]",
    message: 'Positions are sector tiles: no ship-origin + local sums (step 6).',
  },
  { selector: "BinaryExpression[operator=/^[-+]$/] > MemberExpression[property.name=/^o[xy]$/]", message: 'Grids read sector tiles: no window-origin sums (step 6).' },
  ...noGridIds,
];

export default tseslint.config(
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  { ignores: ['dist', 'coverage', 'node_modules', 'docs', 'wiki/**', 'tools/layout/lib/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.svelte', '**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // Rune modules (the layout lab's shared state).
    files: ['**/*.svelte.ts'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      ...noImports(pixiNames, [...pixiPat, ...sveltePat, ...pat(['content', 'render', 'ui', 'app'])]),
      'no-restricted-globals': ['error', ...simBannedGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng.' },
        { object: 'Date', property: 'now', message: 'Date is banned in src/sim.' },
        { object: 'performance', property: 'now', message: 'performance is banned in src/sim.' },
        { object: 'globalThis', property: 'window', message: 'DOM is banned in src/sim.' },
        { object: 'globalThis', property: 'document', message: 'DOM is banned in src/sim.' },
      ],
    },
  },
  {
    files: ['src/sim/**/*.test.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Step 6 (coordinate flip): positions are sector tiles everywhere, so no ship-origin or window-origin sums in the sim.
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/shipgen/**', 'src/sim/**/*.test.ts'], // shipgen is template-local
    rules: { 'no-restricted-syntax': ['error', ...simSyntax, ...noAssignmentWrites] },
  },
  {
    // The task API itself (crew AI) is the one writer of AssignmentC.
    files: ['src/sim/ai/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...simSyntax] },
  },
  {
    files: ['src/app/**/*.ts', 'src/render/**/*.ts', 'src/ui/**/*.ts', 'src/ui/**/*.svelte'],
    ignores: ['src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noAssignmentWrites] },
  },
  {
    files: ['src/sim/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noGridIds] },
  },
  {
    // Test support (test/support) is for tests only. A separate rule (not no-restricted-imports) so it cannot be overridden by the per-folder import rules above.
    files: ['**/*.ts', '**/*.svelte', '**/*.js'],
    ignores: ['**/*.test.ts', '**/*.slow.test.ts', '**/*.soak.test.ts', 'test/support/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ group: ['**/test/support', '**/test/support/**'], message: 'test/support is for test files only.' }] }],
    },
  },
  {
    // No test code in src: non-test source files never import vitest or anything under the repo's test/ directory. Same rule name as the
    // block above (a later block replaces it for these files), so it repeats that block's pattern.
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [{ name: 'vitest', message: 'No test code in src: vitest is for *.test.ts files only.' }],
        patterns: [
          { group: ['vitest/*', '@vitest/*'], message: 'No test code in src: vitest is for *.test.ts files only.' },
          { group: ['**/test', '**/test/**'], message: 'No test code in src: the repo test/ directory is for test files only.' },
        ],
      }],
    },
  },
  {
    // The sim-only test helpers serve src/sim tests, so they follow the sim's import boundary; only content.ts and the scenario fixtures in
    // test/support/fixtures (used by content tests) may reach content.
    files: ['test/support/**/*.ts'],
    ignores: ['test/support/content.ts', 'test/support/scenario.ts', 'test/support/content.test.ts', 'test/support/fixtures/**'],
    rules: noImports(pixiNames, [...pixiPat, ...sveltePat, ...pat(['content', 'render', 'ui', 'app'])]),
  },
  {
    files: ['src/content/**/*.ts'],
    rules: noImports(pixiNames, [...pixiPat, ...sveltePat, ...pat(['render', 'ui', 'app'])]),
  },
  {
    files: ['src/render/**/*.ts'],
    rules: noImports([], [...sveltePat, ...pat(['ui', 'app'])]),
  },
  {
    // The starmap's Pixi view draws the UI's snapshot types (starmapApi.ts) and implements the UI's view interface (starmapGpu.ts): types only.
    files: ['src/render/starmap/**/*.ts'],
    rules: noImports([], [...sveltePat, ...pat(['app']), { group: ['**/ui/**', '!**/ui/starmapApi', '!**/ui/starmapGpu'], message: 'Forbidden import of ui here.' }]),
  },
  {
    // Panels use the UI kit, never the headless library underneath it (see "UI kit" in docs/ARCHITECTURE.md).
    files: ['src/ui/**/*.ts', 'src/ui/**/*.svelte'],
    rules: noImports([...pixiNames, ...bitsNames], [...pixiPat, ...bitsPat, ...pat(['render'])]),
  },
  {
    files: ['src/ui/kit/**/*.ts', 'src/ui/kit/**/*.svelte'],
    rules: noImports(pixiNames, [...pixiPat, ...pat(['render'])]),
  },
  {
    // A test imports the module that owns what it uses, never the sim barrel (src/sim/index.ts): through the barrel every test depends on
    // the whole sim, so any sim edit selects it. The baseline lists the test files not yet migrated.
    files: ['**/*.test.ts'],
    ignores: ['src/sim/**', ...simBarrelBaseline],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ regex: '^(\\.\\./)+(src/)?sim(/index)?$', message: 'Import the module that owns it, not the sim barrel.' }] }] },
  },
  ...[['src/sim/*.test.ts', '^\\.(/index)?$'], ['src/sim/*/*.test.ts', '^\\.\\.(/index)?$'], ['src/sim/*/*/*.test.ts', '^\\.\\./\\.\\.(/index)?$']].map(([glob, regex]) => ({
    files: [glob],
    ignores: simBarrelBaseline,
    rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ regex, message: 'Import the module that owns it, not the sim barrel.' }] }] },
  })),
);
