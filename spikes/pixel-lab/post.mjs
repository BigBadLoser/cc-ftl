// Turns the single-file build into a body-less fragment: title + meta + style + script.
import { readFileSync, writeFileSync } from 'node:fs';
const base = '/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/pixel-test/';
let h = readFileSync(base + 'lab-build/index.html', 'utf8');
h = h.replace(/<!doctype[^>]*>/i, '').replace(/<\/?(html|head|body)\b[^>]*>/gi, '').replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<meta name="(claude:viewport-fit-sides|viewport)"[^>]*>/gi, '').replace(/ crossorigin/g, '');
h = '<title>Pixel Lab</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + h.trim() + '\n';
writeFileSync(base + 'pixel-lab.html', h);
console.log('pixel-lab.html', (h.length / 1024).toFixed(0) + ' KB', /(src|href)="https?:/.test(h) ? 'HAS EXTERNAL REFS' : 'no external refs');
