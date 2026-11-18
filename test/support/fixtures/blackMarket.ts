/** The pirate-den sweep of the black-market tests: visits dens of the given seeds' generated galaxies (up to 14 in all) and checks market and plain den. */
import { expect } from 'vitest';
import { truceHolds } from '../../../src/sim/blackmarket/truce';
import { ShipC } from '../../../src/sim/combat/components';
import { portsAt } from '../../../src/sim/galaxy/portIndex';
import { ensureChunk, galaxyIndex } from '../../../src/sim/galaxy/state';
import { newGame } from '../../../src/sim/newGame';
import { placementGapError } from '../../../src/sim/regions';
import type { Sim } from '../../../src/sim/sim';
import { TraderC } from '../../../src/sim/trade/types';
import { content } from '../content';

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};

function deployAt(sim: Sim): void {
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return step(sim);
    }
  }
  throw new Error('no room to deploy');
}
function visit(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  step(sim);
  deployAt(sim);
}

export function expectDenMarkets(seeds: number[]): void {
  let markets = 0;
  let plain = 0;
  for (const seed of seeds) {
    const sim = newGame(seed, content);
    step(sim, 2);
    for (let cy = -4; cy <= 4; cy++) for (let cx = -4; cx <= 4; cx++) ensureChunk(sim, cx, cy);
    const nodes = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const n of nodes) {
      const den = portsAt(sim, n.id).find((p) => p.kind === 'den');
      if (!den || markets + plain >= 14) continue;
      visit(sim, n.id);
      const t = sim.world.query(TraderC).map((id) => ({ id, t: sim.world.get(id, TraderC)! })).find((x) => x.t.port === den.id);
      if (!t) continue;
      if (t.t.services) {
        markets++;
        expect(t.t.services).toEqual(['bm.lesser']);
        expect(t.t.fence).toBeUndefined();
        expect(sim.galaxy.nodes[n.id]?.truce).toBeDefined();
        expect(truceHolds(sim)).toBe(true);
      } else {
        plain++;
        expect(sim.galaxy.nodes[n.id]?.truce).toBeUndefined();
        expect(sim.world.get(t.id, ShipC)!.faction).toBe('hostile');
      }
    }
  }
  expect(markets).toBeGreaterThan(0);
  expect(plain).toBeGreaterThan(markets);
  expect(markets / (markets + plain)).toBeLessThan(0.5);
}
