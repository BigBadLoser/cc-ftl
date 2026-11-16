import { describe, expect, it } from 'vitest';
import {
  Rng, SECURITY_ROLE, buildStation, crewPosts, crewSize, docksOf, STATION_SIZES, stationCrew, stationProgram, structureParts,
  rotatedSize, type ItemDef, type ModuleDef, type StationDef, type StationResult, type StationSize,
} from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;
type Id = keyof typeof stations;
const ids = Object.keys(stations) as Id[];
const cache = new Map<string, StationResult>();
const gen = (id: Id, size: StationSize, seed: number): StationResult => {
  const k = `${id} ${size} ${seed}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const g = buildStation(stations[id] as StationDef, id, size, seed, defs);
  cache.set(k, g);
  return g;
};
const count = (g: StationResult, id: string): number => (g.template.modules ?? []).filter((m) => m.def === id).length;
const countBy = (g: StationResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** Planned defence of a kind at a size: guns, shields and point defence, plus security crew. */
function defence(id: Id, size: StationSize): number {
  const def = stations[id] as StationDef;
  const mods = stationProgram(new Rng(1), def, size, defs).flatMap((r) => r.mods);
  return mods.filter((m) => defs[m]?.weapon || defs[m]?.shieldGen || defs[m]?.pointDefense).length + crewPosts(def, size).security;
}

describe('mining stations', () => {
  it('put an ore bin flush against every refinery, stocked with ore', () => {
    for (const [size, seed] of [['station', 3], ['station', 8], ['hub', 5], ['hub', 7]] as const) {
      const g = gen('station.mining', size, seed);
      const mods = g.template.modules ?? [];
      const box = (m: (typeof mods)[number]): { x0: number; y0: number; x1: number; y1: number } => {
        const [w, h] = rotatedSize(defs[m.def] as ModuleDef, m.rot ?? 0);
        return { x0: m.x, y0: m.y, x1: m.x + w, y1: m.y + h };
      };
      const flush = (a: ReturnType<typeof box>, b: ReturnType<typeof box>): boolean =>
        ((a.x1 === b.x0 || b.x1 === a.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0))
        || ((a.y1 === b.y0 || b.y1 === a.y0) && Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0));
      const bins = mods.filter((m) => m.def.startsWith('module.storage_ore'));
      const refineries = mods.filter((m) => m.def === 'module.refinery');
      expect(refineries.length, `${size} ${seed}`).toBeGreaterThan(0);
      for (const r of refineries) expect(bins.some((b) => flush(box(r), box(b))), `${size} ${seed} refinery ${r.x},${r.y}`).toBe(true);
      expect(bins.some((b) => (b.stock ?? []).length > 0), `${size} ${seed} stocked`).toBe(true);
    }
  }, 60000);
});

describe('research stations', () => {
  it('build valid layouts across seeds and sizes, with labs and the workshop bench and no engines', () => {
    for (const size of STATION_SIZES) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const g = gen('station.research', size, seed);
        const label = `${size} ${seed}`;
        expect(g.problems, label).toEqual([]);
        expect(g.station.kind, label).toBe('research');
        expect(count(g, 'module.research'), label).toBeGreaterThan(0);
        expect(count(g, 'module.fabricator'), label).toBeGreaterThan(0);
        expect(countBy(g, (d) => !!d.engine), label).toBe(0);
        expect(g.station.docks, label).toBeGreaterThanOrEqual(docksOf(stations['station.research'], size));
      }
    }
  }, 120000);
});

describe('buildStation', () => {
  it('every kind builds a valid outpost, station and hub: one structure, docks, no engines', () => {
    for (const id of ids) {
      for (const size of STATION_SIZES) {
        const g = gen(id, size, 1);
        const label = `${id} ${size}`;
        expect(g.problems, label).toEqual([]);
        expect(g.topology, label).toMatch(/^assembly /);
        const w = Math.max(...g.template.rows.map((r) => r.length));
        const cells = g.template.rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
        expect(structureParts(cells, w, g.template.rows.length), label).toBe(1);
        expect(countBy(g, (d) => !!d.engine), label).toBe(0);
        expect(g.station.docks, label).toBeGreaterThanOrEqual(docksOf(stations[id], size));
      }
    }
  }, 120000);

  it('is deterministic', () => {
    for (const id of ['station.trading', 'station.pirate'] as Id[]) {
      const a = buildStation(stations[id] as StationDef, id, 'station', 7, defs);
      const b = buildStation(stations[id] as StationDef, id, 'station', 7, defs);
      expect(b.template).toEqual(a.template);
    }
  }, 60000);

  it('throws, naming the kind, when no recipe of the kind stands', () => {
    const def = { ...(stations['station.pirate'] as StationDef), assembly: [] };
    expect(() => buildStation(def, 'station.pirate', 'outpost', 1, defs)).toThrow(/station\.pirate outpost/);
  });

  it('hubs are much bigger than any ship and outposts are the smallest', () => {
    for (const id of ids) {
      const small = gen(id, 'outpost', 2);
      const hub = gen(id, 'hub', 2);
      // Built tiles, not the bounding box: spines have long thin outlines.
      const filled = (g: StationResult): number => g.template.rows.join('').replace(/\./g, '').length;
      expect(filled(hub), id).toBeGreaterThan(1.5 * filled(small));
      expect(filled(gen(id, 'station', 2)), id).toBeGreaterThan(filled(small));
      expect(Math.max(hub.width, hub.height), id).toBeGreaterThan(70);
    }
  }, 120000);

  it('kind doctrines are recognisable from their key modules', () => {
    const t = gen('station.trading', 'station', 3);
    const m = gen('station.mining', 'station', 3);
    const f = gen('station.farming', 'station', 3);
    const d = gen('station.military', 'station', 3);
    const p = gen('station.pirate', 'station', 3);
    // Trading: a harbour of docks and a market of stalls.
    expect(t.station.docks).toBeGreaterThanOrEqual(3);
    expect(t.rooms.filter((r) => r.role === 'cargo').length).toBeGreaterThan(f.rooms.filter((r) => r.role === 'cargo').length);
    // Mining: refineries, the pod deck, several docks.
    expect(count(m, 'module.refinery')).toBeGreaterThanOrEqual(4);
    expect(count(m, 'module.pod_bay')).toBeGreaterThan(0);
    expect(m.station.docks).toBeGreaterThanOrEqual(4);
    // Farming: greenhouses of hydroponics; no other kind grows anything.
    expect(f.rooms.filter((r) => r.role === 'farm').length).toBeGreaterThanOrEqual(4);
    expect(count(f, 'module.hydroponics')).toBeGreaterThan(0);
    for (const g of [t, m, d, p]) expect(count(g, 'module.hydroponics')).toBe(0);
    // Military depot: the most guns and shields, few docks, armouries and drone bays.
    for (const g of [t, m, f, p]) {
      expect(d.station.guns).toBeGreaterThan(g.station.guns);
      expect(d.station.shields).toBeGreaterThanOrEqual(g.station.shields);
    }
    expect(d.station.docks).toBeLessThanOrEqual(3);
    expect(d.rooms.filter((r) => r.role === 'armoury').length).toBeGreaterThanOrEqual(2);
    expect(count(d, 'module.droneBay')).toBeGreaterThan(0);
    // Pirate den: a breaker shop, the fewest guns (farms come close).
    expect(count(p, 'module.scrapper')).toBeGreaterThan(0);
    for (const g of [t, m]) expect(p.station.guns).toBeLessThan(g.station.guns);
    expect(p.station.guns).toBeLessThanOrEqual(f.station.guns);
  }, 120000);

  it('armouries are stocked with enough hand weapons for the security crew', () => {
    for (const id of ids) {
      const g = gen(id, 'station', 4);
      const guns = (g.template.modules ?? []).flatMap((x) => x.stock ?? []).filter((s) => (content.items as Record<string, ItemDef>)[s.item]?.hand)
        .reduce((n, s) => n + s.count, 0);
      expect(guns, id).toBeGreaterThanOrEqual(g.station.security);
    }
  }, 120000);
});

describe('station crew and defence', () => {
  it('crew grow with size; the security share is highest at depots and lowest at pirate dens', () => {
    const share = (id: Id, size: StationSize): number => {
      const crew = stationCrew(new Rng(5), stations[id] as StationDef, size);
      return crew.filter((r) => r === SECURITY_ROLE).length / crew.length;
    };
    for (const id of ids) {
      const n = STATION_SIZES.map((s) => stationCrew(new Rng(5), stations[id] as StationDef, s).length);
      expect(n[0], id).toBeLessThan(n[1] as number);
      expect(n[1], id).toBeLessThan(n[2] as number);
      // As many as the posts the station's rooms make (no fixed floor: the user found the old numbers inflated).
      expect(n, id).toEqual(STATION_SIZES.map((s) => crewSize(stations[id] as StationDef, s)));
    }
    for (const size of ['station', 'hub'] as StationSize[]) {
      for (const id of ids.filter((x) => x !== 'station.military')) expect(share('station.military', size), `${id} ${size}`).toBeGreaterThan(share(id, size));
      for (const id of ids.filter((x) => x !== 'station.pirate')) expect(share('station.pirate', size), `${id} ${size}`).toBeLessThan(share(id, size));
    }
  });

  it('defence (guns, shields, point defence, security) is strongest at depots and weakest at pirate dens, and grows with size', () => {
    for (const size of STATION_SIZES) {
      for (const id of ids) {
        if (id !== 'station.military') expect(defence('station.military', size), `${id} ${size}`).toBeGreaterThan(defence(id, size));
        if (id !== 'station.pirate') expect(defence('station.pirate', size), `${id} ${size}`).toBeLessThan(defence(id, size));
      }
    }
    for (const id of ids) expect(defence(id, 'outpost'), id).toBeLessThan(defence(id, 'hub'));
  });
});

describe('station walls and open rooms', () => {
  it('walls are one tile thick, and the kinds have open rooms (market courts, gardens)', () => {
    let courts = 0;
    for (const id of ids) {
      for (const size of STATION_SIZES) {
        const g = gen(id, size, 5);
        expect(g.metrics?.thickWall ?? 1, `${id} ${size}`).toBeLessThanOrEqual(0.05);
        courts += g.rooms.filter((r) => r.role === 'plaza' || r.role === 'garden' || r.role === 'drill').length;
      }
    }
    expect(courts).toBeGreaterThan(3);
  }, 120000);

  it('big open rooms are lit to scale: no floor tile of one is more than 6 tiles from a lamp', () => {
    let courts = 0;
    for (const [id, size] of [['station.trading', 'station'], ['station.farming', 'hub'], ['station.research', 'station']] as [Id, StationSize][]) {
      const g = gen(id, size, 1);
      const lamps = (g.template.modules ?? []).filter((m) => m.def === 'module.light');
      // Open rooms of 120 tiles and more get a lamp grid scaled to their area (fit.ts `BIG_ROOM`); smaller ones are lit as any room.
      for (const r of g.rooms.filter((q) => (q.role === 'plaza' || q.role === 'garden' || q.role === 'drill') && q.tiles.length >= 120)) {
        courts++;
        const mine = lamps.filter((m) => g.roomOf[m.y * g.width + m.x] === r.id);
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
