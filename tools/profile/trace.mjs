import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({ root: '/home/user/cc-ftl-perf', server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const sim_ = await server.ssrLoadModule('/src/sim/index.ts');
const { content } = await server.ssrLoadModule('/src/content/index.ts');
const c = await server.ssrLoadModule('/src/sim/crew/components.ts');
const sim = sim_.deserialize(readFileSync(process.argv[2], 'utf8'), content);
for (let t = 0; t < 12; t++) {
  sim.step(sim_.NOOP_PROBE);
  for (const id of [1496, 1497, 1498, 1499, 56]) {
    const a = sim.world.get(id, c.AssignmentC), cr = sim.world.get(id, c.CrewC), p = sim.world.get(id, c.PositionC), tk = sim.world.get(id, 'task' in c ? c.TaskC : c.CrewC);
    console.log(sim.tick, id, cr?.activity, a ? a.jobId : '-', p && `${p.x.toFixed(1)},${p.y.toFixed(1)}`, JSON.stringify(sim.world.get(id, c.PathC))?.slice(0, 60));
  }
  const ev = sim.events.drain().filter((e) => /crew|job|task|abort/.test(e.type)).slice(0, 5); if (ev.length) console.log(JSON.stringify(ev));
}
await server.close();
