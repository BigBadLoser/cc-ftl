import { describe, expect, it } from 'vitest';
import { deptOf, warehoused, type Recipe, type StationSize } from '../sim';
import { assembled, programOf } from './stationRecipeFixture';
import { stationRecipes } from './stationRecipes';
import { stations } from './stations';

describe('station program', () => {
  it('merges crate rooms into warehouses that hold every crate', () => {
    const { rooms } = programOf('station.trading', 'hub', 1);
    const cargo = rooms.filter((r) => r.role === 'cargo');
    expect(cargo.length).toBeGreaterThan(0);
    expect(cargo.every((r) => r.warehouse && r.mods.length <= 24)).toBe(true);
    const crates = [{ role: 'cargo' as const, mods: Array<string>(6).fill('module.storage'), w: 4, h: 3 }, { role: 'cargo' as const, mods: Array<string>(5).fill('module.storage'), w: 4, h: 3 }];
    expect(warehoused(crates).flatMap((r) => r.mods)).toHaveLength(11);
  });

  it('has one mess (two at hub size) and a rec room from station size up, as the commons department', () => {
    const count = (size: StationSize, mod: string): number => programOf('station.mining', size, 1).rooms.filter((r) => r.mods.includes(mod) && deptOf(r) === 'commons').length;
    expect((['outpost', 'station', 'hub'] as const).map((s) => count(s, 'module.galley'))).toEqual([1, 1, 2]);
    expect((['outpost', 'station', 'hub'] as const).map((s) => count(s, 'module.arcade'))).toEqual([0, 1, 1]);
  });

  it('houses the whole crew, with a medbay and plant rooms', () => {
    for (const kind of ['station.pirate', 'station.military', 'station.farming'] as const) {
      const { rooms } = programOf(kind, 'station', 2);
      const beds = rooms.flatMap((r) => r.mods).filter((m) => m === 'module.bed').length;
      expect(beds).toBe(stations[kind].tiers.station.crew);
      expect(rooms.some((r) => r.role === 'medbay')).toBe(true);
      expect(rooms.filter((r) => r.role === 'plant').length).toBeGreaterThanOrEqual(2);
    }
    expect(programOf('station.farming', 'station', 1).rooms.some((r) => r.role === 'farm')).toBe(true);
    expect(programOf('station.military', 'hub', 1).rooms.filter((r) => r.role === 'hangar')).toHaveLength(2);
  });
});

describe('station recipes', () => {
  it('assembles the first tree and the first compound', () => {
    expect(assembled(stationRecipes.tree[0], 'station.pirate', 'hub', 1)).toEqual([]);
    expect(assembled(stationRecipes.compound[0], 'station.mining', 'station', 1)).toEqual([]);
  });

  it('hangs every ore hold in a cage on the spine', () => {
    const { rooms } = programOf('station.mining', 'station', 3);
    expect(rooms.filter((r) => r.cage !== undefined).length).toBeGreaterThanOrEqual(2);
    expect(assembled(stationRecipes.spine[0], 'station.mining', 'station', 3)).toEqual([]);
  });

  it('assembles departments off a trunk', () => {
    const trunk: Recipe = {
      name: 'trunk', root: { kind: 'trunk', pairs: 0.6, step: [8, 12] }, spacing: 2,
      branches: [
        { takes: ['harbour'], per: 'together', host: { on: 'trunk' }, neck: 0, docks: true, section: { rooms: [2, 6] }, link: 0 },
        { takes: ['commons', 'freight', 'works', 'habitation', 'defence'], per: 'department', host: { on: 'trunk' }, neck: 0, section: { rooms: [4, 6], cap: true }, link: [2, 4], most: 2 },
        { takes: ['secure'], per: 'together', host: { on: 'trunk' }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
      ],
    };
    expect(assembled(trunk, 'station.mining', 'station', 1)).toEqual([]);
  });

  it('rejects a recipe that leaves a department out, and says which', () => {
    const short: Recipe = { ...stationRecipes.tree[0], branches: stationRecipes.tree[0].branches.filter((b) => !b.takes.includes('secure')) };
    expect(assembled(short, 'station.mining', 'station', 1)[0]).toMatch(/no part of the recipe takes secure/);
  });
});
