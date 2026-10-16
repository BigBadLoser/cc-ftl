import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const BASE = '/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/pixel-test/';
export const OUT = BASE + 'lab-build/';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@sprites': BASE + 'sprites' } },
  plugins: [viteSingleFile()],
  server: { fs: { allow: ['/'] } },
  build: { outDir: OUT, emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 },
});
