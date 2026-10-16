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
