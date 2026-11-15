// Station room sizing report: planned vs built floor of every assembled room, by role, and a fingerprint of every
// layout, so a change to the assembly shows what it moved and nothing else.
// node tools/shipgen/sizing.js OUT.json        writes the report (SEEDS=n seeds each, default 4)
// node tools/shipgen/sizing.js A.json B.json   compares two reports
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.length === 2) {
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const changed = Object.keys(a.prints).filter((k) => a.prints[k] !== b.prints[k]);
  console.log(`layouts changed: ${changed.length}/${Object.keys(a.prints).length}`);
  const fams = {}; for (const k of changed) { const f = k.split(' ').slice(0, 2).join(' '); fams[f] = (fams[f] ?? 0) + 1; }
  for (const [f, n] of Object.entries(fams)) console.log('  ', f.padEnd(22), n);
  console.log('role'.padEnd(22), 'n', 'ratio before -> after', 'max before -> after');
  for (const role of new Set([...Object.keys(a.roles), ...Object.keys(b.roles)])) {
    const x = a.roles[role], y = b.roles[role];
    const f = (r) => r ? `${(r.sum / r.n).toFixed(2)}` : '-', m = (r) => r ? r.max.toFixed(2) : '-';
    if (!x || !y || f(x) !== f(y) || m(x) !== m(y) || x.n !== y.n) console.log(role.padEnd(22), `${x?.n ?? 0}->${y?.n ?? 0}`, `${f(x)} -> ${f(y)}`, `${m(x)} -> ${m(y)}`);
  }
  process.exit(0);
}
const s = await createServer({ root: fileURLToPath(new URL('../..', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const { assemble } = await s.ssrLoadModule('/src/sim/shipgen/assembly/assemble.ts');
const { recipeAt } = await s.ssrLoadModule('/src/sim/shipgen/assembly/recipe.ts');
const { stationProgram } = await s.ssrLoadModule('/src/sim/shipgen/assembly/program.ts');
const { Rng } = await s.ssrLoadModule('/src/sim/rng.ts');
const { seedOf } = await s.ssrLoadModule('/src/sim/shipgen/generate.ts');
const { content } = await s.ssrLoadModule('/src/content/index.ts');
const { stationRecipes } = await s.ssrLoadModule('/src/content/stationRecipes.ts');
const kinds = { tree: 'pirate', spine: 'mining', agri: 'farming', compound: 'mining', fort: 'military', crescent: 'trading', bazaar: 'trading', tradepost: 'trading', prefab: 'trading' };
const SEEDS = Number(process.env.SEEDS ?? 4);
const roles = {}, prints = {}, rows = [];
for (const [fam, kind] of Object.entries(kinds)) for (const [ri, recipe] of stationRecipes[fam].entries()) for (const size of ['outpost', 'station', 'hub']) for (let seed = 1; seed <= SEEDS; seed++) {
  const def = content.stations[`station.${kind}`];
  const rng = new Rng(seedOf(seed, 0));
  const k = `${fam}#${ri} ${size} ${seed}`;
  let ok; try { ({ ok } = assemble(rng, recipeAt(recipe, size), stationProgram(rng, def, size, content.modules))); } catch (e) { prints[k] = `throw ${e.message.slice(0, 60)}`; continue; }
  if (!ok) { prints[k] = 'fail'; continue; }
  const g = ok.ctx.g, cell = g.compile();
  prints[k] = createHash('md5').update(cell.join('')).digest('hex').slice(0, 10);
  const rooms = {};
  for (let y = -g.half; y < g.half; y++) for (let x = -g.half; x < g.half; x++) {
    const o = g.at(x, y); if (o < 0 || g.regions[o].hall || cell[(y + g.half) * g.size + x + g.half] !== '_') continue;
    const r = (rooms[o] ??= [1e9, 1e9, -1e9, -1e9, 0]); r[0] = Math.min(r[0], x); r[1] = Math.min(r[1], y); r[2] = Math.max(r[2], x); r[3] = Math.max(r[3], y); r[4]++;
  }
  for (const [o, r] of Object.entries(rooms)) {
    const reg = g.regions[o], sp = reg.spec; if (!sp) continue;
    // Shaped by the hull, kept apart from the rest: a star fort's bastions, the bazaar centre's rooms round its court,
    // and a ring's corners (corners.ts, fort.ts and battery.ts rank them from 1e5).
    const court = (reg.access ?? []).some((a) => g.regions[a]?.hall && g.regions[a]?.role === 'plaza' && g.regions[a]?.dept === 'market');
    const shaped = sp.bastion ? ' (bastion)' : court ? ' (court rim)' : reg.rank >= 1e5 && reg.rank < 2e5 ? ' (corner)' : '';
    const label = `${reg.role}${reg.dept ? '/' + reg.dept : ''}${sp.warehouse ? '/wh' : ''}${shaped}`;
    // Planned floor: the spec's w x h (its interior).
    const ratio = r[4] / (sp.w * sp.h);
    const t = (roles[label] ??= { n: 0, sum: 0, max: 0, over: 0 }); t.n++; t.sum += ratio; t.max = Math.max(t.max, ratio); if (ratio > 1.25) t.over++;
    rows.push({ k, label, plan: [sp.w, sp.h], box: [r[2] - r[0] + 1, r[3] - r[1] + 1], floor: r[4], ratio: +ratio.toFixed(2) });
  }
}
writeFileSync(args[0] ?? 'sizing.json', JSON.stringify({ roles, prints, rows }));
console.log('role'.padEnd(22), 'n'.padStart(4), 'mean'.padStart(6), 'max'.padStart(6), '>1.25');
for (const [r, t] of Object.entries(roles).sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)) console.log(r.padEnd(22), String(t.n).padStart(4), (t.sum / t.n).toFixed(2).padStart(6), t.max.toFixed(2).padStart(6), String(t.over).padStart(5));
const bad = Object.values(prints).filter((p) => p === 'fail' || p.startsWith('throw')).length;
console.log('layouts', Object.keys(prints).length, 'failed', bad);
await s.close();
