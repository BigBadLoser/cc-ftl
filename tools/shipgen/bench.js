#!/usr/bin/env node
/**
 * Station generator bench: time, attempts and layout share per kind and size.
 *   node tools/shipgen/bench.js [--kinds trading,farming] [--sizes hub] [--seeds 12]
 */
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const kinds = opt('kinds', 'trading,mining,farming,military,pirate').split(',');
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
      const g = sim.generateStation(stations[id], id, size, seed, content.modules);
      const dt = performance.now() - t0;
      total += dt; att += g.attempts;
      if (dt > worst) { worst = dt; worstAt = `seed ${seed} x${g.attempts}`; }
      const shape = g.topology.split(' ')[0];
      shapes[shape] = (shapes[shape] ?? 0) + 1;
      if (g.problems.length) console.log(`  PROBLEM ${id} ${size} ${seed}: ${g.problems[0]}`);
    }
    console.log(`${k.padEnd(9)} ${size.padEnd(8)} mean ${(total / seeds).toFixed(0).padStart(5)} ms  worst ${worst.toFixed(0).padStart(5)} ms (${worstAt})  attempts ${(att / seeds).toFixed(2)}  ${Object.entries(shapes).map(([s, n]) => `${s} ${n}`).join(', ')}`);
  }
} finally { await server.close(); }
