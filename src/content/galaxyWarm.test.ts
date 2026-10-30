import { describe, expect, it } from 'vitest';
import { deserialize, newGame, serialize, type Sim } from '../sim';
import { GENERATED_CAP, isGenerated, peekGenerated, warmContact } from '../sim/galaxy/arrivals';
import { warmFleets, tendFleets } from '../sim/galaxy/fleetShips';
import { nodesWithin } from '../sim/galaxy/graph';
import { WARM_HOPS } from '../sim/galaxy/tuning';
import type { Contact } from '../sim/galaxy/types';
import { generateShip } from '../sim/shipgen/generate';
import { content as shared } from '.';

/** A game on its own content copy, so the generated-ship memo (keyed by the content object) starts empty. */
const fresh = (seed: number): Sim => newGame(seed, { ...shared });
const candidates = (sim: Sim): Contact[] => {
  const near = nodesWithin(sim, sim.galaxy.current, WARM_HOPS);
  return sim.galaxy.fleets.filter((f) => f.node !== sim.galaxy.current && (near.has(f.node) || f.dest === sim.galaxy.current || f.route.includes(sim.galaxy.current))).flatMap((f) => f.ships);
};
const cold = (sim: Sim, c: Contact) => generateShip(sim.content.factions![c.shipgen]!, c.shipgen, c.seed, c.depth, sim.content.modules);

describe('galaxy ship warming', () => {
  it('a warmed ship deep-equals a cold-generated one', () => {
    const sim = fresh(2);
    const c = candidates(sim)[0]!;
    expect(c).toBeDefined();
    expect(peekGenerated(sim, c)).toBeUndefined();
    expect(warmContact(sim, c)).toBe(true);
    expect(peekGenerated(sim, c)).toEqual(cold(sim, c));
    expect(warmContact(sim, c)).toBe(false); // already there
  });

  it('generates at most one ship per second (per tendFleets call)', () => {
    const sim = fresh(2);
    const pool = candidates(sim);
    expect(pool.length).toBeGreaterThan(2);
    let have = 0;
    for (let s = 0; s < 3; s++) {
      warmFleets(sim);
      const now = pool.filter((c) => isGenerated(sim, c)).length;
      expect(now - have).toBeLessThanOrEqual(1);
      have = now;
    }
    expect(have).toBe(3);
    // tendFleets (the once-a-second call) warms exactly one more.
    tendFleets(sim);
    expect(pool.filter((c) => isGenerated(sim, c)).length).toBe(4);
  });

  it('keeps the memo bounded and evicts the least recently used first', () => {
    const sim = fresh(2);
    const base = candidates(sim)[0]!;
    const mk = (i: number): Contact => ({ ...base, seed: 1000 + i });
    const first = mk(0);
    warmContact(sim, first);
    for (let i = 1; i < GENERATED_CAP; i++) warmContact(sim, mk(i));
    expect(isGenerated(sim, first)).toBe(true);
    warmContact(sim, mk(GENERATED_CAP)); // over the cap: the oldest goes
    expect(isGenerated(sim, first)).toBe(false);
    expect(isGenerated(sim, mk(1))).toBe(true);
    expect(isGenerated(sim, mk(GENERATED_CAP))).toBe(true);
  });

  it('a game loaded from a save mid-run (empty memo) ends the same as one that ran straight through', () => {
    const straight = fresh(2);
    const loaded = fresh(2);
    while (loaded.tick < 3400) loaded.step();
    const resumed = deserialize(serialize(loaded), { ...shared });
    while (straight.tick < 3700) straight.step();
    while (resumed.tick < 3700) resumed.step();
    expect(serialize(resumed)).toEqual(serialize(straight));
  }, 120000);
});
