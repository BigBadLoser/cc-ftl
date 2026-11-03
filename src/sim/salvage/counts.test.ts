import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { partsOf } from './plan';
import { salvageCounts } from './counts';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const COST = [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }];
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {},
  modules: { console: mod({ scrap: 'tech', cost: COST }), console2: mod({ scrap: 'tech', cost: COST }), bed: mod({ scrap: 'comfort', cost: COST }), bay: mod({ cost: COST }) },
  crewNames: [],
  items: { 'item.metal': { name: 'Metal', tags: [], stackSize: 100 }, 'item.electronics': { name: 'Electronics', tags: [], stackSize: 100 }, 'item.parts': { name: 'Spare parts', tags: [], stackSize: 100 } },
  recipes: { 'recipe.scrap_tech': { name: 'r', station: 'module.scrapper', inputs: [{ item: 'item.scrap_tech', count: 10 }], outputs: [{ item: 'item.electronics', count: 6 }, { item: 'item.parts', count: 3 }], work: 1 } },
  structCosts: { floor: [{ item: 'item.metal', count: 1 }], wall: [{ item: 'item.metal', count: 2 }], door: [{ item: 'item.metal', count: 2 }] },
};
const rows = ['##########', '#________#', '#________#', '##########'];

describe('salvageCounts', () => {
  const sim = new Sim(1, content);
  const id = stampShip(sim, { name: 'W', rows, modules: [{ def: 'console', x: 1, y: 1, rot: 0 }, { def: 'console2', x: 3, y: 1, rot: 0 }, { def: 'bed', x: 5, y: 1, rot: 0 }, { def: 'bay', x: 7, y: 1, rot: 0 }] }, { faction: 'neutral', x: 0, y: 0, state: 'wreck' });

  it('counts the parts an order would strip, per type, without changing anything', () => {
    const c = salvageCounts(sim, id);
    expect(c.tech.parts).toBe(partsOf(sim, id, ['tech']).modules.length);
    expect(c.tech.parts).toBe(2);
    expect(c.comfort.parts).toBe(1);
    expect(c.energy.parts).toBe(0);
    expect(c.weapons.parts).toBe(0);
    const p = partsOf(sim, id, ['hull']);
    expect(c.hull.parts).toBe(p.walls.length + p.floors.length);
    expect(salvageCounts(sim, id)).toEqual(c); // read-only: same answer again
  });

  it('estimates the yield from the scrapper recipe', () => {
    const c = salvageCounts(sim, id).tech;
    expect(c.scrap).toBeCloseTo(2 * 10 * 0.4); // two 10-item parts at SALVAGE_FRAC
    expect(c.materials).toEqual([{ item: 'item.electronics', count: 5 }, { item: 'item.parts', count: 2 }]);
    expect(salvageCounts(sim, id).comfort.materials).toEqual([]); // no recipe in this content
  });
});
