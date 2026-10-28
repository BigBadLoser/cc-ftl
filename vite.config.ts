import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** The short commit hash baked into the build for bug reports; "dev" when git is not available. */
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: { __COMMIT__: JSON.stringify(commit()) },
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 }, // full-size ships make the combat scenarios slow under parallel load
});
