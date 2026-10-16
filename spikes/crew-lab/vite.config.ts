import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

export const OUT = '/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/crew-lab/';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [viteSingleFile()],
  build: { outDir: OUT, emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000 },
});
