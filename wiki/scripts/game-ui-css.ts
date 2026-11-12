// Scopes the game's UI theme (src/ui/theme.css) to `.game-ui`, so the wiki can show real game components (<GamePanel>)
// without the game's page-wide rules (a viewport-pinned body, global buttons) touching the wiki's own pages.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../', import.meta.url));
const game = join(root, '..');
const css = postcss.parse(await readFile(join(game, 'src/ui/theme.css'), 'utf8'));
const base = '/cc-ftl/wiki/generated/fonts/';

css.walkAtRules('font-face', (rule) => rule.walkDecls('src', (d) => { d.value = d.value.replace(/url\('\/fonts\//g, `url('${base}`); }));
css.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes/.test((rule.parent as postcss.AtRule).name)) return;
  const kept = rule.selectors.flatMap((sel) => {
    if (/^(html|#app)\b/.test(sel) || /^html\[/.test(sel)) return [];
    if (sel.startsWith(':root')) return [sel.replace(':root', '.game-ui')];
    if (sel === 'body') return ['.game-ui'];
    return ['.game-ui ' + sel];
  });
  if (kept.length) rule.selectors = kept; else rule.remove();
});
// The game's body is pinned to the viewport and ignores touch; a panel in the wiki is an ordinary block.
css.append(postcss.parse('.game-ui { height: auto; overflow: visible; touch-action: auto; -webkit-user-select: text; user-select: text; }'));

await mkdir(join(root, 'src/data/generated'), { recursive: true });
await writeFile(join(root, 'src/data/generated/game-ui.css'), css.toString());
await mkdir(join(root, 'static/generated/fonts'), { recursive: true });
for (const f of ['Silkscreen-Regular.ttf', 'Silkscreen-Bold.ttf']) await copyFile(join(game, 'public/fonts', f), join(root, 'static/generated/fonts', f));
console.log('Scoped the game UI theme to .game-ui');
