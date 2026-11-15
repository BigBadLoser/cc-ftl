import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { JobC } from '../crew/components';
import { atJob } from '../crew/helpers';
import { spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { makeHaul } from './plan';
import { storageAdd } from './storage';
import { canCarry, nearestSource, nearestStorageFor, reservations, sourcesOf } from './stock';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: true, access: [0, 1], power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {},
  modules: { pallet: mod({ footprint: [2, 2], access: [0, 2], storage: { capacity: 24 } }), crate: mod({ storage: { capacity: 24 } }) },
  crewNames: [],
  items: { metal: { name: 'i', tags: [], stackSize: 100 } },
  recipes: {}, structCosts: {},
};
// The pallet fills the top-left corner: every tile round its anchor corner is hull or the pallet itself, its east and south sides are open.
const rows = ['#####', '#___#', '#___#', '#___#', '#####'];

describe('a haul stops beside any side of a storage module (#488)', () => {
  const make = (): { sim: Sim; pallet: number } => {
    const sim = new Sim(5, content);
    stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
    return { sim, pallet: spawnModule(sim, 'pallet', 1, 1, 0) };
  };

  it('a pallet with its anchor corner walled in is still put into and taken from', () => {
    const { sim, pallet } = make();
    const ship = sim.sector.grid.get('ship', 2, 2);
    const from = { x: 3, y: 3 };
    expect(canCarry(sim, ship, from, { x: 1, y: 1 })).toBe(false); // the anchor alone: nowhere to stand
    const dest = nearestStorageFor(sim, ship, 'metal', from, reservations(sim));
    expect(dest?.ref.id).toBe(pallet);
    expect(dest?.size).toEqual([2, 2]);

    storageAdd(sim, pallet, 'metal', 10);
    const src = sourcesOf(sim, ship, 'metal', reservations(sim)).find((s) => s.ref.id === pallet)!;
    expect(src.size).toEqual([2, 2]);
    const job = sim.world.get(makeHaul(sim, reservations(sim), 'hauling', ship, src, { kind: 'zone', id: ship }, 'metal', 4), JobC)!;
    expect(atJob({ x: 3, y: 2 }, job)).toBe(true); // beside its east side
    expect(atJob({ x: 2, y: 3 }, job)).toBe(true); // beside its south side
    expect(atJob({ x: 1, y: 1 }, job)).toBe(false); // never on it
  });

  it('a planner hauling to a stop takes the nearest source a load can be carried from, not one nobody can reach', () => {
    const sim = new Sim(5, content);
    // A crate sealed in its own cell (west) and one in the open room (east), the stop between them, nearer the sealed one.
    stampShip(sim, { name: 't', rows: ['#########', '#_#_____#', '###_____#', '#########'] }, { faction: 'player', state: 'prize', x: 0, y: 0 });
    const sealed = spawnModule(sim, 'crate', 1, 1, 0);
    const open = spawnModule(sim, 'crate', 7, 1, 0);
    for (const c of [sealed, open]) storageAdd(sim, c, 'metal', 5);
    const ship = sim.sector.grid.get('ship', 3, 1);
    const stop = { x: 3, y: 1 };
    expect(nearestSource(sim, ship, 'metal', stop, reservations(sim))?.ref.id).toBe(sealed); // the nearest, reachable or not (a store drawn on directly)
    expect(nearestSource(sim, ship, 'metal', stop, reservations(sim), true)?.ref.id).toBe(open);
  });
});
