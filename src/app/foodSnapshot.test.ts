import { describe, expect, it } from 'vitest';
import { ModuleC, StorageC, newGame, type Sim } from '../sim';
import { content } from '../content';
import { buildFood } from './foodSnapshot';
import { buildFabs, buildStock } from './logisticsSnapshot';

const food = (sim: Sim) => buildFood(sim, buildStock(sim));

describe('buildFood', () => {
  it('counts the starting rations and the crew eating them, with the time they last', () => {
    const sim = newGame(1, content);
    const f = food(sim);
    expect(f.units).toBe(12);
    expect(f.eaters).toBe(5);
    // 12 rations x 50 nutrition at 5 crew x 0.12 per second.
    expect(f.hours).toBeCloseTo((12 * 50) / (5 * 0.12 * 3600), 1);
    expect(f.perHour).toBeCloseTo((5 * 0.12 * 3600) / 50, 1);
  });

  it('reports zero hours with no food, and no time without crew', () => {
    const sim = newGame(1, content);
    const none = buildFood(sim, buildStock(sim).filter((s) => s.item !== 'item.ration'));
    expect(none.units).toBe(0);
    expect(none.hours).toBe(0);
    expect(none.perHour).toBeGreaterThan(0);
  });
});

describe('order inputs', () => {
  it('lists the inputs of an order that are not in stock', () => {
    const sim = newGame(1, content);
    sim.step();
    const fab = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.fabricator') ?? 0;
    for (const id of sim.world.query(StorageC)) {
      const st = sim.world.get(id, StorageC);
      if (st) st.stacks = st.stacks.filter((x) => x.item !== 'item.metal');
    }
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'recipe.shuttle', mode: 'count', target: 1 });
    sim.step();
    const o = buildFabs(sim).find((f) => f.id === fab)?.orders[0];
    expect(o?.missing).toEqual(['Metal']);
  });
});
