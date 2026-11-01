import { describe, expect, it } from 'vitest';
import {
  Rng, SECURITY_ROLE, STATION_MAX, STATION_SIZES, generateStation, planStation, stationCrew, structureParts,
  rotatedSize, type ItemDef, type ModuleDef, type StationDef, type StationGrammar, type StationResult, type StationSize,
} from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;
type Id = keyof typeof stations;
const ids = Object.keys(stations) as Id[];
const gen = (id: Id, size: StationSize, seed: number): StationResult => generateStation(stations[id] as StationDef, id, size, seed, defs);
const count = (g: StationResult, id: string): number => (g.template.modules ?? []).filter((m) => m.def === id).length;
const countBy = (g: StationResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** Planned defence of a kind at a size: guns, shields and point defence, plus security crew. */
function defence(id: Id, size: StationSize): number {
  const def = stations[id] as StationDef;
  const plan = planStation(new Rng(1), def, size, { id: size, weight: { base: 1, perDepth: 0, max: 1 }, archetypes: [] }, defs);
  const mods = [...plan.weapons, ...plan.shields, ...(plan.core ? [plan.core] : [])].flatMap((r) => r.mods);
  return mods.filter((m) => defs[m]?.weapon || defs[m]?.shieldGen || defs[m]?.pointDefense).length + plan.crew.filter((r) => r === SECURITY_ROLE).length;
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
  it('generate valid layouts across seeds and sizes, with consoles and benches and no engines', () => {
    for (const size of STATION_SIZES) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const g = gen('station.research', size, seed);
        const label = `${size} ${seed}`;
        expect(g.problems, label).toEqual([]);
        expect(g.station.kind, label).toBe('research');
        expect(count(g, 'module.console'), label).toBeGreaterThan(0);
        expect(count(g, 'module.fabricator'), label).toBeGreaterThan(0);
        expect(countBy(g, (d) => !!d.engine), label).toBe(0);
        expect(g.station.docks, label).toBeGreaterThanOrEqual(stations['station.research'].tiers[size].docks);
      }
    }
  }, 120000);
});

describe('court floors', () => {
  it('trading courts pave walkways and market zones, research gardens soil, on floor tiles only', () => {
    const seen = new Map<string, Set<string>>();
    for (const id of ['station.trading', 'station.research'] as const) {
      const got = new Set<string>();
      for (const seed of [1, 2, 3, 4]) {
        const g = gen(id, 'station', seed);
        (g.template.floors ?? []).forEach((r, y) => {
          for (let x = 0; x < r.length; x++) {
            if (r[x] === '.') continue;
            got.add(r[x] as string);
            expect(g.template.rows[y]?.[x], `${id} ${seed} ${x},${y}`).toBe('_');
          }
        });
      }
      seen.set(id, got);
    }
    expect([...(seen.get('station.trading') ?? [])].sort()).toEqual(expect.arrayContaining(['m', 'w']));
    expect([...(seen.get('station.research') ?? [])].sort()).toEqual(expect.arrayContaining(['s', 'w']));
  }, 120000);
});

describe('court landmarks', () => {
  it('trading plazas raise a holo column and research gardens a great tree, most of the time', () => {
    let holo = 0, tree = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      holo += count(gen('station.trading', 'station', seed), 'module.holo_sign');
      tree += count(gen('station.research', 'station', seed), 'module.tree_large');
    }
    expect(holo).toBeGreaterThanOrEqual(4);
    expect(tree).toBeGreaterThanOrEqual(4);
  }, 120000);
});

describe('station generator', () => {
  it('every kind builds a valid outpost, station and hub: one structure, docks, no engines, inside the limit', () => {
    for (const id of ids) {
      for (const size of STATION_SIZES) {
        const g = gen(id, size, 1);
        const label = `${id} ${size}`;
        expect(g.problems, label).toEqual([]);
        const w = Math.max(...g.template.rows.map((r) => r.length));
        const cells = g.template.rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
        expect(structureParts(cells, w, g.template.rows.length), label).toBe(1);
        expect(countBy(g, (d) => !!d.engine), label).toBe(0);
        expect(g.station.docks, label).toBeGreaterThanOrEqual(stations[id].tiers[size].docks);
        expect(Math.max(g.width, g.height), label).toBeLessThanOrEqual(STATION_MAX);
      }
    }
  }, 120000);

  it('is deterministic', () => {
    for (const id of ['station.trading', 'station.pirate'] as Id[]) {
      const a = gen(id, 'station', 7);
      const b = gen(id, 'station', 7);
      expect(b.template).toEqual(a.template);
    }
  }, 60000);

  it('hubs are much bigger than any ship and outposts are the smallest', () => {
    for (const id of ids) {
      const small = gen(id, 'outpost', 2);
      const hub = gen(id, 'hub', 2);
      // Built tiles, not the bounding box: spines and crosses have long thin outlines.
      const filled = (g: StationResult): number => g.template.rows.join('').replace(/\./g, '').length;
      expect(filled(hub), id).toBeGreaterThan(2 * filled(small));
      expect(Math.max(hub.width, hub.height), id).toBeGreaterThan(70);
    }
  }, 120000);

  it('kind doctrines are recognisable from their key modules', () => {
    const t = gen('station.trading', 'station', 3);
    const m = gen('station.mining', 'station', 3);
    const f = gen('station.farming', 'station', 3);
    const d = gen('station.military', 'station', 3);
    const p = gen('station.pirate', 'station', 3);
    const storage = (g: StationResult): number => count(g, 'module.storage');
    // Trading: several docks and the most storage of the civil kinds.
    expect(t.station.docks).toBeGreaterThanOrEqual(5);
    // Storage over a few seeds: one station's layout draw (a farm on a big concentric ring) can outstore a trader's.
    const stored = (id: Id): number => [3, 4, 5].reduce((n, seed) => n + storage(gen(id, 'station', seed)), 0);
    expect(stored('station.trading')).toBeGreaterThan(stored('station.farming'));
    // Mining: refineries, several docks.
    expect(count(m, 'module.refinery')).toBeGreaterThanOrEqual(4);
    expect(m.station.docks).toBeGreaterThanOrEqual(4);
    // Farming: hydroponics bays, all in its farm rooms (no other station, and no other room, grows them).
    for (const g of [t, m, d, p]) expect(count(g, 'module.hydroponics')).toBe(0);
    expect(count(f, 'module.hydroponics')).toBeGreaterThanOrEqual(20);
    const farmTile = new Set(f.rooms.filter((r) => r.role === 'farm').flatMap((r) => r.tiles));
    expect((f.template.modules ?? []).filter((x) => x.def === 'module.hydroponics').every((x) => farmTile.has(x.y * f.width + x.x))).toBe(true);
    expect(f.rooms.filter((r) => r.role === 'support').length).toBeGreaterThanOrEqual(2);
    // Military depot: the most guns and shields, few docks, an armoury.
    for (const g of [t, m, f, p]) {
      expect(d.station.guns).toBeGreaterThan(g.station.guns);
      expect(d.station.shields).toBeGreaterThanOrEqual(g.station.shields);
    }
    expect(d.station.docks).toBeLessThanOrEqual(3);
    expect(d.rooms.filter((r) => r.role === 'armoury').length).toBeGreaterThanOrEqual(2);
    // Pirate den: welded from several modules, loot stores, the fewest guns (farms come close).
    expect(p.topology).toMatch(/stationWelded|stationTree/);
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

describe('station layouts', () => {
  const LAYOUTS: StationGrammar[] = [
    'stationRing', 'stationLattice', 'stationHub', 'stationWelded', 'stationWheel', 'stationConcentric', 'stationArc', 'stationSpine', 'stationCross', 'stationTree',
  ];
  const forced = (id: Id, size: StationSize, layout: StationGrammar, seed: number): StationResult => {
    const def = stations[id] as StationDef;
    return generateStation({ ...def, tiers: { ...def.tiers, [size]: { ...def.tiers[size], grammars: [{ value: layout, weight: 1 }] } } }, id, size, seed, defs);
  };
  it('every layout builds valid stations (round rings, spines, crosses, trees and the rest)', () => {
    for (const layout of LAYOUTS) {
      for (const [id, size] of [['station.trading', 'outpost'], ['station.military', 'station']] as [Id, StationSize][]) {
        const g = forced(id, size, layout, 11);
        expect(g.problems, `${layout} ${id} ${size}`).toEqual([]);
        expect(g.topology.startsWith(layout), `${layout} ${g.topology}`).toBe(true);
      }
    }
  }, 120000);

  it('kinds lean on different layouts: round rings for trade and farms, spines and crosses for mining, trees for pirates', () => {
    const used = (id: Id): string[] => [1, 2, 3, 4, 5, 6].map((s) => gen(id, 'station', s).topology.split(' ')[0] as string);
    const round = (xs: string[]): number => xs.filter((x) => x === 'stationWheel' || x === 'stationConcentric').length;
    expect(round(used('station.trading'))).toBeGreaterThanOrEqual(1);
    expect(round(used('station.farming'))).toBeGreaterThanOrEqual(3);
    expect(used('station.mining').filter((x) => x === 'stationSpine' || x === 'stationCross').length).toBeGreaterThanOrEqual(3);
    expect(used('station.pirate').every((x) => x === 'stationTree' || x === 'stationWelded')).toBe(true);
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
      expect(n[2], id).toBeGreaterThanOrEqual(30);
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

describe('station walls and courtyards', () => {
  it('walls are one tile thick and enclosed centres become open rooms', () => {
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
});
