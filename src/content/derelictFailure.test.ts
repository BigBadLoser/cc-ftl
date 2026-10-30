import { describe, expect, it, vi } from 'vitest';
import { ShipC, galaxyIndex, newGame, type Sim } from '../sim';
import { spawnDerelict } from '../sim/combat/derelict';
import { placementGapError } from '../sim/regions';
import { ensureAround, nodeState } from '../sim/galaxy/state';
import { content } from '.';

// A generator faction that cannot make a layout: generateShip throws its "no layout" error for every `faction.*` hull.
const broken = vi.hoisted(() => ({ on: false }));
vi.mock('../sim/shipgen/generate', async (orig) => {
  const real = await orig<typeof import('../sim/shipgen/generate')>();
  return {
    ...real,
    generateShip: (...args: Parameters<typeof real.generateShip>) => {
      if (broken.on && args[1].startsWith('faction.')) throw new Error(`generateShip: no layout for ${args[1]} seed ${args[2]} depth ${args[3]}: forced`);
      return real.generateShip(...args);
    },
  };
});

const step = (sim: Sim, n = 1): void => { for (let i = 0; i < n; i++) sim.step(); };
function visit(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  step(sim);
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
const defKind = (s: { def: string }) => (content.galaxy.structures as Record<string, { kind: string }>)[s.def]!.kind;

function derelictWorld(): { sim: Sim; node: string } {
  for (const seed of [3, 21, 5, 8, 12, 14, 30, 33, 40, 47]) {
    const sim = newGame(seed, content);
    step(sim, 2);
    ensureAround(sim, sim.galaxy.current);
    const n = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
      .find((q) => q.structures.some((s) => defKind(s) === 'derelict') && q.structures.length > 1);
    if (n) return { sim, node: n.id };
  }
  throw new Error('no node with a derelict and another structure');
}

describe('derelict generation failure', () => {
  it('spawnDerelict returns a failure code instead of throwing', () => {
    const sim = newGame(1, content);
    const faction = Object.keys(content.factions).find((f) => f.startsWith('faction.'))!;
    broken.on = true;
    try {
      expect(spawnDerelict(sim, { faction, depth: 2, seed: 5, at: { x: 100, y: 10 } })).toBe('noLayout');
    } finally { broken.on = false; }
    expect(sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)!.state === 'wreck')).toHaveLength(0);
  });

  it('a node whose derelict cannot be generated still populates, repeatably, with its other structures', () => {
    const run = () => {
      const { sim, node } = derelictWorld();
      broken.on = true;
      try {
        expect(() => visit(sim, node)).not.toThrow();
      } finally { broken.on = false; }
      expect(nodeState(sim, node).populated).toBe(true);
      step(sim, 5);
      return JSON.stringify(sim.world.query(ShipC).map((id) => { const s = sim.world.get(id, ShipC)!; return [s.name, s.state, s.x, s.y]; }));
    };
    const a = run();
    expect(run()).toBe(a);
  });
});
