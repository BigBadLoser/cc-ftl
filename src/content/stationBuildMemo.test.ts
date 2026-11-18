import { describe, expect, it, vi } from 'vitest';
import { content as shared } from '.';
import { newGame } from '../sim/newGame';
import type { Sim } from '../sim/sim';
import { teleport } from '../sim/galaxy/hyperspace';
import { nodeBuildJobs } from '../sim/galaxy/populatePlan';
import { galaxyIndex } from '../sim/galaxy/state';
import { regions } from '../sim/regions';
import { ShipC } from '../sim/combat/components';
import { OUTPOST, OUTPOST_STATION } from '../sim/outposts/gen';
import { buildContent, claimBuild, isBuilt, provideBuild, releaseBuild, runBuild, type BuildJob } from '../sim/stations/buildMemo';

/** Every `buildStation` call is recorded; in 'stub' mode it throws at once (no recipe stood), so a node populates in milliseconds. */
const calls: { id: string; size: string; seed: number }[] = [];
let mode: 'real' | 'stub' = 'real';
vi.mock('../sim/shipgen/stationBuild', async (orig) => {
  const real = await orig<typeof import('../sim/shipgen/stationBuild')>();
  return {
    ...real,
    buildStation: (...a: Parameters<typeof real.buildStation>) => {
      calls.push({ id: a[1], size: a[2], seed: a[3] });
      if (mode === 'stub') throw new Error('stub');
      return real.buildStation(...a);
    },
  };
});

/** A game on its own content copy, so the build memo (keyed by the content object) starts empty. */
const fresh = (seed: number): Sim => newGame(seed, { ...shared });

/** Generated nodes with station or outpost builds, the start node excepted. */
function nodesWithBuilds(sim: Sim): string[] {
  return [...galaxyIndex(sim.galaxy).nodes.keys()].filter((id) => id !== sim.galaxy.current && nodeBuildJobs(sim, id).length > 0);
}

/** The `buildStation` calls a job makes when every one throws: one for a station, every station attempt of an outpost. */
function stubCalls(j: BuildJob): { id: string; size: string; seed: number }[] {
  if (j.type === 'station') return [{ id: j.kind, size: j.size, seed: j.seed >>> 0 }];
  const id = OUTPOST_STATION[j.kind!];
  return Array.from({ length: OUTPOST.stations }, (_, s) => ({ id, size: 'outpost', seed: (j.seed + s * 104729) >>> 0 }));
}

/** What the node's structures came out as: every region's place and size and every ship's generator identity. */
function sectorSummary(sim: Sim): string {
  const ships = [...sim.world.query(ShipC)].map((id) => sim.world.get(id, ShipC)!).map((s) => `${s.name}@${s.x},${s.y} ${s.width}x${s.height} ${JSON.stringify(s.gen)}`);
  return JSON.stringify({ regions: regions(sim).map((r) => r.bbox), ships, w: sim.sector.width, h: sim.sector.height });
}

describe('station build memo (#538)', () => {
  it('lists exactly the station and outpost builds populating a node makes, for several galaxies', () => {
    mode = 'stub';
    try {
      let checked = 0;
      for (const seed of [1, 2, 3]) {
        for (const node of nodesWithBuilds(fresh(seed)).slice(0, 3)) {
          const sim = fresh(seed); // a teleport leaves the ship deploying: one game per node
          const jobs = nodeBuildJobs(sim, node);
          calls.length = 0;
          teleport(sim, node);
          expect(calls, `seed ${seed} ${node}`).toEqual(jobs.flatMap(stubCalls));
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(3);
    } finally {
      mode = 'real';
    }
  });

  it('a provided build is used by the drop with no rebuild, and the node comes out as built in place', () => {
    const cold = fresh(2);
    const node = nodesWithBuilds(cold)[0]!;
    teleport(cold, node);

    const warm = fresh(2);
    const jobs = nodeBuildJobs(warm, node);
    for (const j of jobs) {
      expect(claimBuild(warm, j)).toBe(true);
      // what the worker sends back: built on its own content copy, through a structured clone
      provideBuild(warm, j, structuredClone(runBuild(j, buildContent(shared))));
      expect(isBuilt(warm, j)).toBe(true);
    }
    calls.length = 0;
    teleport(warm, node);
    expect(calls).toEqual([]);
    expect(jobs.some((j) => isBuilt(warm, j))).toBe(false); // each taken out as used
    expect(sectorSummary(warm)).toBe(sectorSummary(cold));
  });

  it('a released or never-provided claim is built in place, and a late result is dropped', () => {
    mode = 'stub';
    try {
      let sim = fresh(3);
      const [a, b] = nodesWithBuilds(sim);
      const ja = nodeBuildJobs(sim, a!);
      for (const j of ja) claimBuild(sim, j);
      for (const j of ja) releaseBuild(sim, j);
      calls.length = 0;
      teleport(sim, a!);
      expect(calls).toEqual(ja.flatMap(stubCalls));

      sim = fresh(3);
      const jb = nodeBuildJobs(sim, b!);
      for (const j of jb) expect(claimBuild(sim, j)).toBe(true);
      calls.length = 0;
      teleport(sim, b!); // the worker is not done: built on the spot
      expect(calls).toEqual(jb.flatMap(stubCalls));
      for (const j of jb) provideBuild(sim, j, null);
      expect(jb.some((j) => isBuilt(sim, j))).toBe(false);
    } finally {
      mode = 'real';
    }
  });

  it('station and outpost results come through a structured clone unchanged', () => {
    const c = buildContent(shared);
    const station = runBuild({ type: 'station', kind: 'station.trading', size: 'outpost', seed: 7 }, c);
    expect(structuredClone(station)).toStrictEqual(station);
    const outpost = runBuild({ type: 'outpost', style: 'dug', kind: 'pirate', seed: 7 }, c);
    expect(outpost).not.toBeNull();
    expect(structuredClone(outpost)).toStrictEqual(outpost);
  });
});
