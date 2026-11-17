import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../sim';
import { isGenerated, isWarmedElsewhere, nextArrival, peekGenerated, warmContact } from '../sim/galaxy/arrivals';
import { warmCandidates, warmFleets } from '../sim/galaxy/fleetShips';
import { generateShip } from '../sim/shipgen/generate';
import type { GenResult } from '../sim/shipgen/types';
import { content as shared } from '../content';
import { createPrewarm, PREWARM_EVERY_MS, BUILDS_IN_FLIGHT, buildJobsAhead, type ShipGenerator } from './prewarm';
import { nodeBuildJobs } from '../sim/galaxy/populatePlan';
import { galaxyIndex, nodeState } from '../sim/galaxy/state';
import { buildKey, claimBuild, isBuilt, type BuildJob, type BuildResult } from '../sim/stations/buildMemo';

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
    const next = nextArrival(sim);
    expect(m.jobs).toHaveLength(pool.length + (next ? 1 : 0)); // and the ship the next jump-in would bring
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
    expect(m.jobs).toHaveLength(pool.length + (next ? 1 : 0));
  });

  it('generates the ship the next jump-in would bring, and keeps the sim from warming fleet ships itself meanwhile', async () => {
    const sim = fresh(2);
    const m = manual(sim);
    const pre = createPrewarm(sim, m.gen, () => 0);
    expect(isWarmedElsewhere(sim)).toBe(true);
    const next = nextArrival(sim);
    if (!next) throw new Error('no arrival can come at the start node');
    pre.update();
    const job = m.jobs.findIndex((j) => j.shipgen === next.shipgen && j.seed === next.seed && j.depth === next.depth);
    expect(job).toBeGreaterThanOrEqual(0);
    m.finish(job);
    await Promise.resolve();
    await Promise.resolve();
    expect(isGenerated(sim, next)).toBe(true);
    // A candidate the scan has not claimed yet is left to it: the sim does not generate it between frames.
    const other = fresh(2);
    createPrewarm(other, manual(other).gen, () => 0);
    warmFleets(other);
    expect(warmCandidates(other).some((c) => isGenerated(other, c))).toBe(false);
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

describe('station build prewarm (#538)', () => {
  /** A game in hyperspace on a route through generated nodes with builds (the trip set by hand: only the prewarm's reading of it is tested). */
  function travelling(): { sim: Sim; route: string[] } {
    const sim = fresh(2);
    const route = [sim.galaxy.current, ...[...galaxyIndex(sim.galaxy).nodes.keys()].filter((id) => id !== sim.galaxy.current && nodeBuildJobs(sim, id).length > 0).slice(0, 2)];
    sim.sector.state = 'hyperspace';
    sim.galaxy.travel = { route, charge: 0, at: 0, elapsed: 0, hopTicks: 16, phase: 'hop' };
    return { sim, route };
  }
  function builder(sim: Sim) {
    const jobs: { job: BuildJob; ok: (r: BuildResult) => void; fail: (e: unknown) => void }[] = [];
    const gen: ShipGenerator = { generate: () => new Promise(() => {}), build: (job) => new Promise((ok, fail) => void jobs.push({ job, ok, fail })) };
    return { gen, jobs, sim };
  }
  const settle = async (): Promise<void> => {
    for (let k = 0; k < 4; k++) await Promise.resolve();
  };

  it('lists the builds of the route nodes not yet populated, nearest first, and nothing outside hyperspace', () => {
    const { sim, route } = travelling();
    expect(buildJobsAhead(sim).map(buildKey)).toEqual(route.flatMap((id) => nodeBuildJobs(sim, id)).map(buildKey)); // the start node too: a fresh test game leaves it unpopulated
    sim.galaxy.travel!.at = 2;
    expect(buildJobsAhead(sim).map(buildKey)).toEqual(nodeBuildJobs(sim, route[2]!).map(buildKey));
    nodeState(sim, route[2]!).populated = true;
    expect(buildJobsAhead(sim)).toEqual([]);
  });

  it('while the ship waits in a node, lists the plotted route first, then the nodes one lane away', () => {
    const sim = fresh(2);
    const g = sim.galaxy;
    const idx = galaxyIndex(g);
    const lanes = (idx.adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a));
    expect(sim.sector.state).not.toBe('hyperspace');
    expect(buildJobsAhead(sim).map(buildKey)).toEqual(lanes.flatMap((id) => nodeBuildJobs(sim, id)).map(buildKey));
    const far = [...idx.nodes.keys()].find((id) => !lanes.includes(id) && id !== g.current && nodeBuildJobs(sim, id).length > 0)!;
    const keys = buildJobsAhead(sim, [g.current, far]).map(buildKey);
    expect(keys.slice(0, nodeBuildJobs(sim, far).length)).toEqual(nodeBuildJobs(sim, far).map(buildKey));
    for (const id of lanes) nodeState(sim, id).populated = true;
    expect(buildJobsAhead(sim)).toEqual([]);
  });

  it('claims the neighbours\' builds while idle, a few at a time, and hands them in', async () => {
    // A game whose start node has neighbours with builds.
    let sim = fresh(1);
    for (let seed = 1; seed < 40 && buildJobsAhead(sim).length === 0; seed++) sim = fresh(seed);
    const all = buildJobsAhead(sim);
    expect(all.length).toBeGreaterThan(0);
    const b = builder(sim);
    let t = 0;
    const pre = createPrewarm(sim, b.gen, () => t);
    pre.update();
    expect(b.jobs.map((j) => buildKey(j.job))).toEqual(all.slice(0, BUILDS_IN_FLIGHT).map(buildKey));
    for (const j of b.jobs) j.ok(null);
    await settle();
    for (const j of all.slice(0, BUILDS_IN_FLIGHT)) expect(isBuilt(sim, j)).toBe(true);
    t += PREWARM_EVERY_MS;
    pre.update();
    expect(b.jobs.slice(b.jobs.length - Math.min(BUILDS_IN_FLIGHT, Math.max(0, all.length - BUILDS_IN_FLIGHT))).map((j) => buildKey(j.job)))
      .toEqual(all.slice(BUILDS_IN_FLIGHT, 2 * BUILDS_IN_FLIGHT).map(buildKey));
  });

  it('sends a few builds at a time and hands the results in; a failed build gives its claim back', async () => {
    const { sim } = travelling();
    const all = buildJobsAhead(sim);
    expect(all.length).toBeGreaterThan(BUILDS_IN_FLIGHT);
    const b = builder(sim);
    let t = 0;
    const pre = createPrewarm(sim, b.gen, () => t);
    pre.update();
    expect(b.jobs.map((j) => buildKey(j.job))).toEqual(all.slice(0, BUILDS_IN_FLIGHT).map(buildKey));
    b.jobs[0]!.ok(null);
    b.jobs[1]!.fail(new Error('worker died'));
    await settle();
    expect(isBuilt(sim, all[0]!)).toBe(true);
    expect(isBuilt(sim, all[1]!)).toBe(false);
    expect(claimBuild(sim, all[1]!)).toBe(true); // released: free to claim again (and the sim builds it if needed)
    t += PREWARM_EVERY_MS;
    pre.update();
    expect(b.jobs.slice(2).map((j) => buildKey(j.job))).toEqual(all.slice(2, 2 + BUILDS_IN_FLIGHT).map(buildKey));
  });
});
