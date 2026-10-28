import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // The GitHub Pages build serves from /cc-ftl/ (set by .github/workflows/pages.yml); everything else from /.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 }, // full-size ships make the combat scenarios slow under parallel load
});
