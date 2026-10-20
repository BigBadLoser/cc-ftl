import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** Build a no-restricted-imports rule from exact names and glob patterns. */
const noImports = (names, patterns) => ({
  'no-restricted-imports': ['error', { paths: names, patterns }],
});

const pat = (dirs) => dirs.map((d) => ({ group: [`**/${d}`, `**/${d}/**`], message: `Forbidden import of ${d} here.` }));
const pixiNames = [{ name: 'pixi.js', message: 'pixi.js is only allowed in src/render.' }];
const pixiPat = [{ group: ['pixi.js/*', '@pixi/*'], message: 'pixi.js is only allowed in src/render.' }];
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

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'spikes', 'docs'] },
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
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator=/^[-+]$/][left.type='MemberExpression'][left.object.name=/^(ship|s|sh)$/][left.property.name=/^[xy]$/][right.type='MemberExpression'][right.property.name=/^[xy]$/]",
          message: 'Positions are sector tiles: no ship-origin + local sums (step 6).',
        },
        { selector: "BinaryExpression[operator=/^[-+]$/] > MemberExpression[property.name=/^o[xy]$/]", message: 'Grids read sector tiles: no window-origin sums (step 6).' },
        ...noGridIds,
      ],
    },
  },
  {
    files: ['src/sim/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noGridIds] },
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
    files: ['src/ui/**/*.ts', 'src/ui/**/*.svelte'],
    rules: noImports(pixiNames, [...pixiPat, ...pat(['render'])]),
  },
);
