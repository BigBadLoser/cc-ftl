import { describe, expect, it } from 'vitest';
import { constructProgramBayFootprint } from './stationNeighborhoods';
import { generateStation } from './stationGen';
import { architectureOfGenerated } from './stationArchitecturePlan';
import { sourceModuleDeficits } from './stationStructuralIntegration';
import { content } from '../../content';

/** Contract tests: occupied bay geometry is driven by content, not by filling the whole search window. */
describe('program-led structural bay integration', () => {
  it('constructs a contiguous ring frontage plus rectangular industrial cores without absorbing the search window', () => {
    const search = new Set<string>();
    for (let y = -12; y <= 12; y++) for (let x = 11; x <= 30; x++)
      if (Math.hypot(x, y) >= 11 && Math.hypot(x, y) <= 32) search.add(`${x},${y}`);
    const cores = [{ x: 18, y: -4, w: 8, h: 7 }, { x: 16, y: 5, w: 7, h: 5 }];
    const floor = constructProgramBayFootprint(search, cores, 10);
    expect(floor !== null).toBe(true);
    for (const core of cores) for (let y = core.y; y < core.y + core.h; y++)
      for (let x = core.x; x < core.x + core.w; x++) expect(floor?.has(`${x},${y}`)).toBe(true);
    // Existing search canvas contains 400+ candidate cells; it is not a license to fill them all.
    expect((floor?.size ?? 0) < search.size * 0.78).toBe(true);
    // Every produced floor tile connects cardinally to the continuous frontage.
    const seen = new Set<string>();
    const start = [...(floor ?? [])].find((k) => { const [x, y] = k.split(',').map(Number); return Math.hypot(x ?? 0, y ?? 0) < 14; });
    expect(!!start).toBe(true);
    const todo = [start as string];seen.add(start as string);
    for (let i = 0; i < todo.length; i++) {
      const [x, y] = (todo[i] as string).split(',').map(Number) as [number, number];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const k = `${x+dx},${y+dy}`;
        if (floor?.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); }
      }
    }
    expect(seen.size).toBe(floor?.size);
  });

  it('builds a native furnished forced wheel with zero source-module deficits and a smaller footprint than sector mode', () => {
    const kind = 'station.trading', size = 'station' as const, seed = 1;
    const original = content.stations[kind];
    const def = { ...original, tiers: { ...original.tiers, [size]: {
      ...original.tiers[size], grammars: [{ value: 'stationWheel' as const, weight: 1 }],
    } } };
    const earlier = generateStation(def, kind, size, seed, content.modules, true, 'neighborhood');
    const revised = generateStation(def, kind, size, seed, content.modules, true, 'programBay');
    expect(revised.topology.includes('stationWheel')).toBe(true);
    expect(revised.topology.includes('programBays')).toBe(true);
    expect(revised.problems).toHaveLength(0);
    expect(sourceModuleDeficits(revised.architecture?.sourceRequirements ?? [], revised.template.modules ?? [])).toHaveLength(0);
    expect(architectureOfGenerated(revised).audit().floorTiles < architectureOfGenerated(earlier).audit().floorTiles).toBe(true);
  });
});
