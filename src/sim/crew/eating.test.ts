import { describe, expect, it } from 'vitest';
import { ammoCount } from '../combat/ammo';
import { stampShip } from '../combat/ships';
import { content, ring } from '../eva/airFixture';
import { StorageC } from '../items/components';
import { spawnModule } from '../modules/spawn';
import { Sim } from '../sim';
import { foodOn } from './eating';

const store = { name: 'Box', asset: 'b', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 10, buildWork: 10, storage: { capacity: 50 } };
const food = (nutrition: number) => ({ name: 'F', tags: ['food'], stackSize: 20, price: 1, flammability: 0, food: { nutrition } });
// Content order differs from nutrition order, and two foods tie (the first in content order wins the tie).
const items = { 'item.rock': { name: 'R', tags: [], stackSize: 20, price: 1, flammability: 0 }, 'item.b': food(60), 'item.a': food(80), 'item.c': food(60), 'item.d': food(50), 'item.z': food(0) };

/** The scan `foodOn` replaced: each food, most nutritious first, asked whether any storage of the grid holds it. */
function scan(sim: Sim, ship: number): string | null {
  for (const id of ['item.a', 'item.b', 'item.c', 'item.d']) if (ammoCount(sim, ship, id) > 0) return id;
  return null;
}

describe('food on a grid', () => {
  it('names the most nutritious food held, as a scan of each food in turn did, as stock comes and goes', () => {
    const sim = new Sim(3, { ...content, items: items as never, modules: { ...content.modules, box: store as never } });
    stampShip(sim, { name: 's1', rows: ring() }, { faction: 'player', x: 0, y: 0 });
    const two = stampShip(sim, { name: 's2', rows: ring() }, { faction: 'neutral', x: 30, y: 0 });
    const a = spawnModule(sim, 'box', 3, 3, 0), b = spawnModule(sim, 'box', 4, 3, 0), c = spawnModule(sim, 'box', 33, 3, 0);
    const stacks = (id: number) => sim.world.get(id, StorageC)!.stacks;
    const check = (): void => { for (const ship of [1, two, 0]) expect(foodOn(sim, ship)).toBe(scan(sim, ship)); };
    check(); // nothing anywhere
    stacks(a).push({ item: 'item.rock', count: 5 }, { item: 'item.z', count: 3 });
    check(); // no food with any nutrition
    stacks(b).push({ item: 'item.d', count: 2 });
    check();
    stacks(a).push({ item: 'item.c', count: 1 });
    check();
    stacks(b).push({ item: 'item.b', count: 1 });
    check(); // the tie goes to content order
    stacks(c).push({ item: 'item.a', count: 4 });
    check(); // the best food on the other ship is not ours
    stacks(b).push({ item: 'item.a', count: 0 });
    check(); // an empty stack holds nothing
    stacks(a).unshift({ item: 'item.a', count: 1 });
    expect(foodOn(sim, 1)).toBe('item.a');
    check();
  });
});
