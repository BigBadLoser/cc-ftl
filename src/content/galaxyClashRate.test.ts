import { describe, expect, it } from 'vitest';
import { galaxyIndex, newGame, portsAt, type Sim } from '../sim';
import { ensureChunk } from '../sim/galaxy/state';
import { arrive } from '../sim/galaxy/travel';
import { FLEET_AREA_HOPS } from '../sim/galaxy/tuning';
import { nodesWithin } from '../sim/galaxy/fleets';
import { onTurn } from '../sim/galaxy/turn';
import { content } from '.';

const CLASH_KINDS = new Set(['destroyed', 'driven', 'clash', 'raid']);

/** Run `turns` galaxy turns with the player parked, and tally the clash stories and the fleet census as they happen. */
function run(sim: Sim, turns: number): { clashes: number; kinds: Record<string, number>; fleets: number[]; rebuilt: number } {
  const g = sim.galaxy;
  let seen = g.nextNews;
  const kinds: Record<string, number> = {};
  const fleets: number[] = [];
  let clashes = 0;
  for (let i = 0; i < turns; i++) {
    onTurn(sim, ++g.turn);
    for (const n of g.news) if (n.id >= seen) { kinds[n.kind] = (kinds[n.kind] ?? 0) + 1; if (CLASH_KINDS.has(n.kind)) clashes++; }
    seen = g.nextNews;
    if (i % 100 === 99) fleets.push(g.fleets.reduce((n, f) => n + f.ships.length, 0));
  }
  return { clashes, kinds, fleets, rebuilt: kinds['rebuilt'] ?? 0 };
}

/** A world with the player parked at a den's node's neighbourhood (pirate country), or at the start node. */
function world(seed: number, den: boolean): Sim {
  const sim = newGame(seed, content);
  if (!den) return sim;
  sim.sector.state = 'deploying';
  for (let cy = -5; cy <= 5; cy++) for (let cx = -5; cx <= 5; cx++) ensureChunk(sim, cx, cy);
  const dens = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => portsAt(sim, n.id).some((p) => p.kind === 'den'));
  if (!dens.length) throw new Error('no den');
  // The den with the most fleets about it (a crowded lane network), so the test measures contested space and not a lone corner of the map.
  const crowd = (id: string): number => { const area = nodesWithin(sim, id, FLEET_AREA_HOPS); return sim.galaxy.fleets.filter((f) => area.has(f.node)).length; };
  const node = dens.map((n) => ({ n, c: crowd(n.id) })).sort((a, b) => b.c - a.c || (a.n.id < b.n.id ? -1 : 1))[0]!.n;
  sim.galaxy.current = node.id;
  arrive(sim);
  return sim;
}

describe('off-screen clash rate', () => {
  const TURNS = 400;
  // Pirate country with the most fleets about it (seeds picked for crowded lane networks: a lone corner of the map has nobody to fight).
  const SEEDS = [3, 8, 34];

  it('a player in contested space reads a clash every 4 to 20 turns, and the fleet economy absorbs the losses', () => {
    let total = 0;
    for (const seed of SEEDS) {
      const sim = world(seed, true);
      const start = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
      const r = run(sim, TURNS);
      const end = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
      total += r.clashes;
      expect(r.clashes, `seed ${seed}`).toBeGreaterThanOrEqual(TURNS / 20);
      expect(r.clashes, `seed ${seed}`).toBeLessThanOrEqual(TURNS / 4);
      // Losses are rebuilt at the home ports: the population stays within a tenth of where it began, and rebuilds keep pace with the destroyed.
      expect(Math.abs(end - start) / start, `seed ${seed}`).toBeLessThan(0.1);
      expect(r.rebuilt, `seed ${seed}`).toBeGreaterThanOrEqual((r.kinds['destroyed'] ?? 0) * 0.6);
    }
    expect(total / (SEEDS.length * TURNS)).toBeGreaterThan(1 / 20);
  }, 120000);

  it('is deterministic: the same world plays the same clashes', () => {
    const a = run(world(3, true), 200);
    const b = run(world(3, true), 200);
    expect(b).toEqual(a);
  }, 60000);

  it('a long run keeps the population: 1500 turns near a den lose no more than a fifth of the ships', () => {
    const sim = world(34, true);
    const start = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
    const r = run(sim, 1500);
    const end = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
    expect(r.clashes).toBeGreaterThan(100);
    expect(end).toBeGreaterThan(start * 0.8);
  }, 120000);
});
