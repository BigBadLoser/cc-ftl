// Writes the wiki's "What's new" page from the game's CHANGELOG.md, so the patch notes have one source.
// The page is generated (git-ignored); edit CHANGELOG.md instead.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../CHANGELOG.md'), 'utf8');

// Drop the file's own H1; the page title comes from the frontmatter. Escape what SveltePress would read as Svelte.
const body = source
  .replace(/^# .*\n+/, '')
  .replace(/[{}<]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;' })[c] ?? c);

const out = resolve(here, '../src/routes/whats-new/+page.md');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `---\ntitle: What's new\n---\n\n${body}`);
console.log('Generated What\'s new from CHANGELOG.md');
