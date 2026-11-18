import { afterAll } from 'vitest';
import { clearFileCaches } from './cache';

// Vitest setup file (vite.config.ts), run for every test file: the harness's caches last one file, so a shared worker's heap does not grow
// with every file it runs.
afterAll(() => clearFileCaches());
