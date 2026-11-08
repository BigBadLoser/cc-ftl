import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../sim';
import { isGenerated, peekGenerated, warmContact } from '../sim/galaxy/arrivals';
import { warmCandidates, warmFleets } from '../sim/galaxy/fleetShips';
import { generateShip } from '../sim/shipgen/generate';
import type { GenResult } from '../sim/shipgen/types';
import { content as shared } from '../content';
import { createPrewarm, PREWARM_EVERY_MS, type ShipGenerator } from './prewarm';

/** A game on its own content copy, so the generated-ship memo (keyed by the content object) starts empty. */
const fresh = (seed: number): Sim => newGame(seed, { ...shared });

/** A generator that answers when the test says so, with the real `generateShip`. */
function manual(sim: Sim) {
  const jobs: { shipgen: string; seed: number; depth: number; ok: (g: GenResult | null) => void; fail: (e: unknown) => void }[] = [];
  const gen: ShipGenerator = { generate: (job) => new Promise((ok, fail) => void jobs.push({ ...job, ok, fail })) };
  const finish = (i: number): void => {
    const j = jobs[i]!;
    j.ok(generateShip(sim.content.factions![j.shipgen]!, j.shipgen, j.seed, j.depth, sim.content.modules));
  };
  return { gen, jobs, finish };
}

describe('ship prewarm', () => {
  it('claims every candidate, so the sim leaves them alone, and hands the ships in as generateShip makes them', async () => {
    const sim = fresh(2);
    const pool = warmCandidates(sim);
    expect(pool.length).toBeGreaterThan(2);
    const m = manual(sim);
    let t = 0;
    const pre = createPrewarm(sim, m.gen, () => t);
    pre.update();
    expect(m.jobs).toHaveLength(pool.length);
    warmFleets(sim); // the sim's own once-a-second warm finds everything claimed
    expect(pool.some((c) => isGenerated(sim, c))).toBe(false);
    expect(warmContact(sim, pool[0]!)).toBe(false);
    m.finish(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(isGenerated(sim, pool[0]!)).toBe(true);
    const cold = generateShip(sim.content.factions![pool[0]!.shipgen]!, pool[0]!.shipgen, pool[0]!.seed, pool[0]!.depth, sim.content.modules);
    expect(peekGenerated(sim, pool[0]!)).toEqual(cold);
    t += PREWARM_EVERY_MS;
    pre.update(); // nothing new to claim
    expect(m.jobs).toHaveLength(pool.length);
  });

  it('scans at most every PREWARM_EVERY_MS', () => {
    const sim = fresh(2);
    const m = manual(sim);
    let t = 0;
    const pre = createPrewarm(sim, m.gen, () => t);
    pre.update();
    const n = m.jobs.length;
    t = PREWARM_EVERY_MS - 1;
    pre.update();
    expect(m.jobs).toHaveLength(n);
  });

  it('gives the claim back when the generator fails, and the sim warms the ship itself', async () => {
    const sim = fresh(2);
    const m = manual(sim);
    const pre = createPrewarm(sim, m.gen, () => 0);
    pre.update();
    const pool = warmCandidates(sim);
    for (const j of m.jobs) j.fail(new Error('worker died'));
    await Promise.resolve();
    await Promise.resolve();
    warmFleets(sim);
    expect(pool.filter((c) => isGenerated(sim, c))).toHaveLength(1);
  });

  it('a ship needed before its result is in is generated on the spot, and the late result changes nothing', async () => {
    const sim = fresh(2);
    const m = manual(sim);
    createPrewarm(sim, m.gen, () => 0).update();
    const c = warmCandidates(sim)[0]!;
    // arrival code (spawnContact) asks the memo through `shipFor`, which generates on a miss; the late result must not replace it.
    const { spawnContact } = await import('../sim/galaxy/arrivals');
    const spawned = spawnContact(sim, sim.galaxy.current, c);
    expect(spawned).toBe(c.ship !== undefined);
    const before = peekGenerated(sim, c);
    m.finish(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(peekGenerated(sim, c)).toBe(before); // a placed ship's memo entry is gone; a late result does not bring it back
  });
});
