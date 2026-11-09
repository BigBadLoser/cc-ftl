import { afterEach, describe, expect, it } from 'vitest';
import { content as shared } from '../content';
import { chunkOfId, galaxyGen, newGame, type ContentRegistry } from '../sim';
import { prefetchGalaxy, setChunkBuilder, type ChunkBuilder } from './galaxyPrefetch';
import { warmOutlines } from './starmapClusters';

/** Content with its own galaxy object, so the shared generator (cached per galaxy content and seed) starts empty. */
const own = (): ContentRegistry => ({ ...shared, galaxy: { ...shared.galaxy! } });

/** A builder that answers when the test says so, from a generator of its own (as the worker runs one). */
function manual() {
  const jobs: { seed: number; cx: number; cy: number; ok: (r: Awaited<ReturnType<ChunkBuilder['request']>>) => void; fail: (e: unknown) => void }[] = [];
  const b: ChunkBuilder = { request: (job) => new Promise((ok, fail) => void jobs.push({ ...job, ok, fail })) };
  const elsewhere = own().galaxy;
  const finish = (i: number): void => {
    const j = jobs[i]!;
    const chunk = galaxyGen(j.seed, elsewhere).chunk(j.cx, j.cy);
    j.ok({ chunk: structuredClone(chunk), outlines: warmOutlines(chunk) });
  };
  return { b, jobs, finish };
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await Promise.resolve();
};

afterEach(() => setChunkBuilder(null));

describe('galaxy prefetch on a worker', () => {
  it('asks for each missing chunk once, nearest first, and takes in exactly the chunks the generator builds itself', async () => {
    const sim = newGame(11, own());
    const m = manual();
    setChunkBuilder(m.b);
    while (prefetchGalaxy(sim, true));
    expect(m.jobs.length).toBeGreaterThan(0);
    expect(new Set(m.jobs.map((j) => `${j.cx},${j.cy}`)).size).toBe(m.jobs.length);
    const [cx, cy] = chunkOfId(sim.galaxy.current)!.split(',').map(Number) as [number, number];
    const ring = (j: { cx: number; cy: number }) => Math.max(Math.abs(j.cx - cx), Math.abs(j.cy - cy));
    expect(m.jobs.map(ring)).toEqual([...m.jobs.map(ring)].sort((a, b) => a - b));
    expect(prefetchGalaxy(sim, true)).toBe(false); // all asked for: nothing new while they are out
    const gen = galaxyGen(sim.seed, sim.content.galaxy);
    for (let i = 0; i < m.jobs.length; i++) m.finish(i);
    await settle();
    const fresh = galaxyGen(sim.seed, own().galaxy);
    for (const j of m.jobs) {
      expect(gen.hasChunk(j.cx, j.cy)).toBe(true);
      expect(gen.chunk(j.cx, j.cy)).toEqual(fresh.chunk(j.cx, j.cy));
    }
    expect(prefetchGalaxy(sim, true)).toBe(false);
  });

  it('builds on the main thread again once the worker fails', async () => {
    const sim = newGame(12, own());
    const m = manual();
    setChunkBuilder(m.b);
    expect(prefetchGalaxy(sim, false)).toBe(true);
    const job = m.jobs[0]!;
    job.fail(new Error('worker died'));
    await settle();
    const gen = galaxyGen(sim.seed, sim.content.galaxy);
    expect(gen.hasChunk(job.cx, job.cy)).toBe(false);
    expect(prefetchGalaxy(sim, false)).toBe(true);
    expect(gen.hasChunk(job.cx, job.cy)).toBe(true); // built right here
    expect(m.jobs).toHaveLength(1);
  });
});
