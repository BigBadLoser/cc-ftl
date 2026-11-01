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

/** How many fleets are about a den's node, at the den with the most (0 when the map has no den). */
function crowdOf(sim: Sim): number {
  const dens = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => portsAt(sim, n.id).some((p) => p.kind === 'den'));
  const crowd = (id: string): number => { const area = nodesWithin(sim, id, FLEET_AREA_HOPS); return sim.galaxy.fleets.filter((f) => area.has(f.node)).length; };
  return Math.max(0, ...dens.map((n) => crowd(n.id)));
}

/** A world with the chunks around the start generated, ready to be parked at its most crowded den. */
function generated(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.sector.state = 'deploying';
  for (let cy = -5; cy <= 5; cy++) for (let cx = -5; cx <= 5; cx++) ensureChunk(sim, cx, cy);
  return sim;
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
  // Pirate country with crowded lane networks (a lone corner of the map has nobody to fight). The seeds are not hand-picked for their clash
  // rate: they are the first CROWDED_SEEDS of seeds 1.. whose busiest den has at least CROWDED fleets about it, whatever the rate turns out to be.
  const CROWDED = 15;
  const CROWDED_SEEDS = 6;
  const SEEDS: number[] = [];
  for (let seed = 1; SEEDS.length < CROWDED_SEEDS && seed <= 200; seed++) if (crowdOf(generated(seed)) >= CROWDED) SEEDS.push(seed);

  it('a player in contested space reads a clash every 4 to 20 turns (the median world, at least half of them, and the mean), and the fleet economy absorbs the losses', () => {
    expect(SEEDS).toHaveLength(CROWDED_SEEDS);
    const clashes: number[] = [];
    for (const seed of SEEDS) {
      const sim = world(seed, true);
      const start = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
      const r = run(sim, TURNS);
      const end = sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
      clashes.push(r.clashes);
      // Losses are rebuilt at the home ports: the population stays within a tenth of where it began, and rebuilds keep pace with the destroyed.
      expect(Math.abs(end - start) / start, `seed ${seed}`).toBeLessThan(0.1);
      expect(r.rebuilt, `seed ${seed}`).toBeGreaterThanOrEqual((r.kinds['destroyed'] ?? 0) * 0.6);
    }
    const inRange = (c: number): boolean => c >= TURNS / 20 && c <= TURNS / 4;
    const sorted = [...clashes].sort((a, b) => a - b);
    expect(inRange(sorted[Math.floor(sorted.length / 2)]!), `median of ${clashes.join(', ')}`).toBe(true);
    expect(clashes.filter(inRange).length, `in range: ${clashes.join(', ')}`).toBeGreaterThanOrEqual(Math.ceil(clashes.length * (1 / 2)));
    const mean = clashes.reduce((a, b) => a + b, 0) / (clashes.length * TURNS);
    expect(mean).toBeGreaterThan(1 / 20);
    expect(mean).toBeLessThan(1 / 4);
  }, 600000);

  it('is deterministic: the same world plays the same clashes', () => {
    const a = run(world(3, true), 200);
    const b = run(world(3, true), 200);
    expect(b).toEqual(a);
  }, 60000);

  it('a long run keeps the population: 1500 turns near a den lose no more than a fifth of the ships, and clashes stay above 100 a world', () => {
    // Judged as an aggregate over the fixed seeds 1 to 8 (a single world's den can sit in a quiet corner), by the old single-world bar: more than 100 clashes
    // a world on average, and at most a fifth of the ships lost overall.
    let clashes = 0;
    let start = 0;
    let end = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sim = world(seed, true);
      start += sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
      clashes += run(sim, 1500).clashes;
      end += sim.galaxy.fleets.reduce((n, f) => n + f.ships.length, 0);
    }
    expect(clashes / 8).toBeGreaterThan(100);
    expect(end).toBeGreaterThan(start * 0.8);
  }, 120000);
});
