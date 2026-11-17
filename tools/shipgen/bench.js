#!/usr/bin/env node
/**
 * Station bench and sweep: time, tries and recipe share per kind and size, built as the game builds them
 * (`buildStation`), and any seed on which none stood.
 *   node tools/shipgen/bench.js [--kinds trading,farming] [--sizes hub] [--seeds 12]
 */
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const kinds = opt('kinds', 'trading,research,mining,farming,military,pirate').split(',');
const sizes = opt('sizes', 'outpost,station,hub').split(',');
const seeds = Number(opt('seeds', 12));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const sim = await server.ssrLoadModule('/src/sim/index.ts');
  const { content } = await server.ssrLoadModule('/src/content/index.ts');
  const { stations } = await server.ssrLoadModule('/src/content/stations.ts');
  for (const k of kinds) for (const size of sizes) {
    const id = `station.${k}`;
    let total = 0, worst = 0, worstAt = '', att = 0;
    const shapes = {};
    for (let seed = 1; seed <= seeds; seed++) {
      const t0 = performance.now();
      let g;
      try {
        g = sim.buildStation(stations[id], id, size, seed, content.modules);
      } catch (e) {
        console.log(`  FAILED ${id} ${size} ${seed}: ${e.message}`);
        continue;
      }
      const dt = performance.now() - t0;
      total += dt; att += g.attempts;
      if (dt > worst) { worst = dt; worstAt = `seed ${seed} x${g.attempts}`; }
      const shape = g.topology.replace(/^assembly /, '');
      shapes[shape] = (shapes[shape] ?? 0) + 1;
    }
    console.log(`${k.padEnd(9)} ${size.padEnd(8)} mean ${(total / seeds).toFixed(0).padStart(5)} ms  worst ${worst.toFixed(0).padStart(5)} ms (${worstAt})  tries ${(att / seeds).toFixed(2)}  ${Object.entries(shapes).map(([s, n]) => `${s} ${n}`).join(', ')}`);
  }
} finally { await server.close(); }
