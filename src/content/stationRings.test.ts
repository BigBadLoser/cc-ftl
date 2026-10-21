import { describe, expect, it } from 'vitest';
import { generateStation, type ModuleDef, type StationDef, type StationGrammar, type StationResult, type StationSize } from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;
type Id = keyof typeof stations;
const forced = (id: Id, size: StationSize, layout: StationGrammar, seed: number): StationResult => {
  const def = stations[id] as StationDef;
  return generateStation({ ...def, tiers: { ...def.tiers, [size]: { ...def.tiers[size], grammars: [{ value: layout, weight: 1 }] } } }, id, size, seed, defs);
};
const SOFT = ['quarters', 'cargo', 'support', 'farm', 'industry', 'armoury'];
const COURTS = ['plaza', 'garden', 'drill'];
/** Share of a room's bounding box its floor fills (1 = a rectangle). */
const fill = (g: StationResult, tiles: number[]): number => {
  const xs = tiles.map((t) => t % g.width);
  const ys = tiles.map((t) => Math.floor(t / g.width));
  return tiles.length / ((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1));
};

describe('round station rings', () => {
  it('concentric rings cut their soft rooms as ring segments; system rooms stay rectangles', () => {
    let soft = 0;
    let segs = 0;
    for (const [id, size, seed] of [['station.trading', 'station', 1], ['station.farming', 'hub', 2], ['station.military', 'hub', 3]] as [Id, StationSize, number][]) {
      const g = forced(id, size, 'stationConcentric', seed);
      expect(g.problems, `${id} ${size}`).toEqual([]);
      expect(g.topology.startsWith('stationConcentric')).toBe(true);
      for (const r of g.rooms) {
        if (SOFT.includes(r.role)) { soft++; if (fill(g, r.tiles) < 1) segs++; }
        // Rectangles as placed; wall thinning may fold a corner wall into them.
        if (r.role === 'weapons' || r.role === 'shields') expect(fill(g, r.tiles), `${id} ${r.role} ${r.id}`).toBeGreaterThan(0.75);
      }
    }
    expect(segs / soft).toBeGreaterThan(0.6);
  }, 120000);

  it('wheels and concentric rings reserve dock banks: every dock gets its airlock on the first attempt, facing north or south', () => {
    for (const layout of ['stationWheel', 'stationConcentric'] as StationGrammar[]) {
      for (const seed of [1, 2, 3, 4]) {
        const g = forced('station.trading', 'station', layout, seed);
        const label = `${layout} seed ${seed}`;
        expect(g.problems, label).toEqual([]);
        expect(g.failures.filter((f) => f.includes('docks') || f.includes('airlock')), label).toEqual([]);
        const locks = (g.template.modules ?? []).filter((m) => defs[m.def]?.airlock);
        expect(locks.length, label).toBeGreaterThanOrEqual(stations['station.trading'].tiers.station.docks);
        expect(locks.every((m) => m.rot === 0 || m.rot === 2), label).toBe(true);
      }
    }
  }, 120000);

  it('courtyards are lit to scale: no court floor tile is more than 6 tiles from a lamp', () => {
    let courts = 0;
    for (const [id, size, layout] of [['station.trading', 'station', 'stationWheel'], ['station.farming', 'hub', 'stationConcentric'], ['station.military', 'station', 'stationRing']] as [Id, StationSize, StationGrammar][]) {
      const g = forced(id, size, layout, 1);
      const lamps = (g.template.modules ?? []).filter((m) => m.def === 'module.light');
      for (const r of g.rooms.filter((q) => COURTS.includes(q.role))) {
        courts++;
        const mine = lamps.filter((m) => g.roomOf[m.y * g.width + m.x] === r.id);
        // More lamps than the old cap of 12 a room once a court is big.
        if (r.tiles.length > 800) expect(mine.length, `${id} court ${r.id}`).toBeGreaterThan(12);
        for (const t of r.tiles) {
          const x = t % g.width;
          const y = Math.floor(t / g.width);
          const d = Math.min(...mine.map((m) => Math.hypot(m.x - x, m.y - y)));
          expect(d, `${id} ${r.role} tile ${x},${y}`).toBeLessThanOrEqual(6);
        }
      }
    }
    expect(courts).toBeGreaterThan(0);
  }, 120000);
});
