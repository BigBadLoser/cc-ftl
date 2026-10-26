import { describe, expect, it } from 'vitest';
import { galaxyIndex, newGame, nodeOf, type Sim } from '../sim';
import { content } from '.';

/** Jumps from the start node to the nearest node holding a structure of `def` (null when none is revealed). */
function hopsTo(sim: Sim, def: string): number | null {
  const gi = galaxyIndex(sim.galaxy);
  const start = sim.galaxy.current;
  const dist = new Map([[start, 0]]);
  const queue = [start];
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    const d = dist.get(n)!;
    if (nodeOf(sim, n)?.structures.some((s) => s.def === def)) return d;
    for (const e of gi.adjacent.get(n) ?? []) {
      const o = e.a === n ? e.b : e.a;
      if (dist.has(o)) continue;
      dist.set(o, d + 1);
      queue.push(o);
    }
  }
  return null;
}

function revealed(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.step();
  sim.step();
  sim.enqueue({ type: 'debug.galaxyReveal', radius: 14 });
  sim.step();
  return sim;
}

describe('research station reach', () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  const hops = seeds.map((s) => hopsTo(revealed(s), 'structure.station_research') ?? 99).sort((a, b) => a - b);

  it('the nearest research station is usually a few jumps from the start: median 3 or less, most within 5', () => {
    expect(hops[Math.floor(hops.length / 2)]!).toBeLessThanOrEqual(3);
    expect(hops.filter((h) => h <= 5).length).toBeGreaterThanOrEqual(Math.ceil(seeds.length * 0.8));
  });

  it('they are rarer than trading posts and favour calm nodes', () => {
    const sim = revealed(3);
    const nodes = [...galaxyIndex(sim.galaxy).nodes.values()];
    const count = (def: string) => nodes.filter((n) => n.structures.some((s) => s.def === def));
    const research = count('structure.station_research');
    expect(research.length).toBeGreaterThan(0);
    expect(research.length).toBeLessThan(count('structure.station_trade').length);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(research.map((n) => n.danger))).toBeLessThan(mean(nodes.map((n) => n.danger)));
  });
});
