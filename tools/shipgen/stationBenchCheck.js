#!/usr/bin/env node
/** Dev check for the bench's protrusion metric: a round hull passes, a rectangle glued to its rim is caught. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { protrusionShare } = await server.ssrLoadModule('/tools/shipgen/stationBenchHull.ts');
  const W = 60, H = 60;
  const build = (glue) => {
    const rows = [];
    for (let y = 0; y < H; y++) {
      let r = '';
      for (let x = 0; x < W; x++) r += Math.hypot(x - 29.5, y - 29.5) < 15 || (glue && x >= 40 && x < 51 && y >= 23 && y < 37) ? '_' : '.';
      rows.push(r);
    }
    const room = [];
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '_') room.push(y * W + x); }));
    return { rows, room };
  };
  const plain = build(false), glued = build(true);
  const a = protrusionShare(W, H, plain.rows, new Set(), plain.room);
  const b = protrusionShare(W, H, glued.rows, new Set(), glued.room);
  console.log(`round ${a.toFixed(3)}, with glued rectangle ${b.toFixed(3)}`);
  assert.equal(a, 0);
  assert.ok(b > 0.05);
} finally {
  await server.close();
}
