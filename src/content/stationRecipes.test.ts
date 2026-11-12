import { describe, expect, it } from 'vitest';
import { commonRooms, deptOf, warehoused, type Recipe } from '../sim';
import { assembled, programOf } from './stationRecipeFixture';
import { stationRecipes } from './stationRecipes';

describe('station program', () => {
  it('merges crate rooms into warehouses that hold every crate', () => {
    const { rooms } = programOf('station.trading', 'hub', 1);
    const cargo = rooms.filter((r) => r.role === 'cargo');
    expect(cargo.length).toBeGreaterThan(0);
    expect(cargo.every((r) => r.warehouse && r.mods.length <= 24)).toBe(true);
    const crates = [{ role: 'cargo' as const, mods: Array<string>(6).fill('module.storage'), w: 4, h: 3 }, { role: 'cargo' as const, mods: Array<string>(5).fill('module.storage'), w: 4, h: 3 }];
    expect(warehoused(crates).flatMap((r) => r.mods)).toHaveLength(11);
  });

  it('adds a mess to every station, a second at hub size, and a rec room from station size up', () => {
    const has = (size: number, mod: string): number => commonRooms(size).filter((r) => r.mods.includes(mod)).length;
    expect([1, 2, 3].map((s) => has(s, 'module.galley'))).toEqual([1, 1, 2]);
    expect([1, 2, 3].map((s) => has(s, 'module.arcade'))).toEqual([0, 1, 1]);
    expect(commonRooms(3).every((r) => deptOf(r) === 'commons')).toBe(true);
  });
});

describe('station recipes', () => {
  it('assembles the first tree and the first compound', () => {
    expect(assembled(stationRecipes.tree[0], 'station.pirate', 'hub', 1)).toEqual([]);
    expect(assembled(stationRecipes.compound[0], 'station.mining', 'station', 1)).toEqual([]);
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
