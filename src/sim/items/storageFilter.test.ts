import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { storageAdd, storageCount, storageSpace } from './storage';
import { nearestStorageFor, reservations } from './stock';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: true, access: [0, 1], power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const item = (stackSize: number) => ({ name: 'i', tags: [], stackSize });
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {},
  modules: {
    crate: mod({ storage: { capacity: 4 } }),
    bin: mod({ storage: { capacity: 4 }, storageAccepts: ['ore', 'ice'] }),
  },
  crewNames: [],
  items: { ore: item(100), ice: item(50), metal: item(100) },
  recipes: {}, structCosts: {},
};
const rows = ['##########', '#________#', '#________#', '#________#', '##########'];

describe('storage that accepts only some items', () => {
  const make = (): { sim: Sim; bin: number; crate: number } => {
    const sim = new Sim(5, content);
    stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
    // The bin is nearer to the point asked from, so only its filter can send metal to the crate.
    return { sim, bin: spawnModule(sim, 'bin', 2, 1, 0), crate: spawnModule(sim, 'crate', 7, 1, 0) };
  };

  it('a bin refuses metal and takes ore and ice', () => {
    const { sim, bin } = make();
    expect(storageSpace(sim, bin, 'metal')).toBe(0);
    expect(storageAdd(sim, bin, 'metal', 10)).toBe(0);
    expect(storageAdd(sim, bin, 'ore', 250)).toBe(250);
    expect(storageAdd(sim, bin, 'ice', 5)).toBe(5);
    expect(storageCount(sim, bin, 'metal')).toBe(0);
  });
  it('the hauling planner sends metal to the crate and ore to the nearer bin', () => {
    const { sim, bin, crate } = make();
    const res = reservations(sim);
    expect(nearestStorageFor(sim, 1, 'metal', { x: 2, y: 2 }, res)?.ref.id).toBe(crate);
    expect(nearestStorageFor(sim, 1, 'ore', { x: 2, y: 2 }, res)?.ref.id).toBe(bin);
  });
  it('ordinary storage stays unrestricted', () => {
    const { sim, crate } = make();
    expect(storageAdd(sim, crate, 'metal', 10)).toBe(10);
    expect(storageAdd(sim, crate, 'ore', 10)).toBe(10);
  });
});
