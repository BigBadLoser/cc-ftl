// Turns the single-file build into a body-less fragment for the sandbox: title + meta + style + script.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = '/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/crew-lab/';
let h = readFileSync(dir + 'index.html', 'utf8');
h = h.replace(/<!doctype[^>]*>/i, '').replace(/<\/?(html|head|body)\b[^>]*>/gi, '').replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>/i, '').replace(/ crossorigin/g, '');
h = '<title>Crew Lab</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + h.trim() + '\n';
writeFileSync(dir + 'lab.html', h);
console.log('lab.html', (h.length / 1024).toFixed(0) + ' KB', /(src|href)="https?:/.test(h) ? 'HAS EXTERNAL REFS' : 'no external refs');
