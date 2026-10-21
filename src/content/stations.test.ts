import { describe, expect, it } from 'vitest';
import {
  Rng, SECURITY_ROLE, STATION_MAX, STATION_SIZES, generateStation, planStation, stationCrew, structureParts,
  type ItemDef, type ModuleDef, type StationDef, type StationResult, type StationSize,
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
      expect(hub.width * hub.height, id).toBeGreaterThan(2 * small.width * small.height);
      expect(Math.max(hub.width, hub.height), id).toBeGreaterThan(70);
    }
  }, 120000);

  it('kind doctrines are recognisable from their key modules', () => {
    const t = gen('station.trading', 'station', 3);
    const m = gen('station.mining', 'station', 3);
    const f = gen('station.farming', 'station', 3);
    const d = gen('station.military', 'station', 3);
    const p = gen('station.pirate', 'station', 3);
    const storage = (g: StationResult): number => countBy(g, (x) => !!x.storage && !x.container);
    // Trading: several docks and the most storage of the civil kinds.
    expect(t.station.docks).toBeGreaterThanOrEqual(5);
    expect(storage(t)).toBeGreaterThan(storage(f));
    // Mining: refineries, several docks.
    expect(count(m, 'module.refinery')).toBeGreaterThanOrEqual(4);
    expect(m.station.docks).toBeGreaterThanOrEqual(4);
    // Farming: hydroponics bays.
    expect(count(f, 'module.hydroponics')).toBeGreaterThanOrEqual(16);
    expect(count(f, 'module.hydroponics')).toBeGreaterThan(2 * count(t, 'module.hydroponics'));
    // Military depot: the most guns and shields, few docks, an armoury.
    for (const g of [t, m, f, p]) {
      expect(d.station.guns).toBeGreaterThan(g.station.guns);
      expect(d.station.shields).toBeGreaterThanOrEqual(g.station.shields);
    }
    expect(d.station.docks).toBeLessThanOrEqual(3);
    expect(d.rooms.filter((r) => r.role === 'armoury').length).toBeGreaterThanOrEqual(2);
    // Pirate den: welded from several modules, loot stores, the fewest guns (farms come close).
    expect(p.topology).toContain('stationWelded');
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
