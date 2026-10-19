import { describe, expect, it } from 'vitest';
import {
  CarryingC, ModuleC, ProductionC, StorageC, deserialize, newGame, serialize, storageCount, totalStock, type Sim,
} from '../../sim';
import { content } from '../index';

const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const find = (sim: Sim, def: string): number => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def) as number;

/** A starter ship with a metal order and a few build jobs, so crew haul, supply and craft. */
function busy(): Sim {
  const sim = newGame(11, content);
  sim.enqueue({ type: 'production.add', moduleId: find(sim, 'module.fabricator'), recipe: 'recipe.metal', mode: 'count', target: 3 });
  sim.enqueue({ type: 'debug.spawnItems', gridId: 1, x: 9, y: 10, item: 'item.scrap', count: 30 });
  sim.enqueue({ type: 'job.build', gridId: 1, x: 12, y: 6, struct: 2 });
  return sim;
}

describe('starter economy', () => {
  it('starts with stocked storage and a powered fabricator', () => {
    const sim = newGame(1, content);
    run(sim, 40);
    expect(totalStock(sim, 'item.metal')).toBe(60);
    expect(totalStock(sim, 'item.electronics')).toBe(20);
    expect(totalStock(sim, 'item.polymer')).toBe(20);
    expect(totalStock(sim, 'item.scrap')).toBe(80);
    expect(totalStock(sim, 'item.ice')).toBe(10);
    expect(sim.world.get(find(sim, 'module.fabricator'), ModuleC)?.powered).toBe(true);
    expect(sim.world.query(StorageC)).toHaveLength(3);
  });

  it('crafts metal from scrap and hauls it away on the real ship', { timeout: 30000 }, () => {
    const sim = busy();
    run(sim, 3000);
    expect(sim.world.get(find(sim, 'module.fabricator'), ProductionC)?.orders[0]?.done).toBe(3);
    expect(totalStock(sim, 'item.scrap')).toBe(80 + 30 - 6);
    expect(sim.grids.get(1)?.get('struct', 12, 6)).toBe(2);
  });

  it('is deterministic over 1500 ticks', () => {
    const a = busy();
    const b = busy();
    run(a, 1500);
    run(b, 1500);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('survives a save round trip in the middle of a haul', () => {
    const a = busy();
    let carrying = false;
    for (let i = 0; i < 3000 && !carrying; i++) {
      a.step();
      carrying = a.world.query(CarryingC).length > 0;
    }
    expect(carrying).toBe(true);
    const b = deserialize(serialize(a), content);
    run(a, 600);
    run(b, 600);
    expect(serialize(b)).toBe(serialize(a));
    expect(storageCount(b, b.world.query(StorageC)[0] as number, 'item.metal')).toBeGreaterThan(0);
  });

  it('runs 1000 busy ticks in under 4 seconds', () => {
    const sim = busy();
    const t0 = performance.now();
    run(sim, 1000);
    expect(performance.now() - t0).toBeLessThan(4000);
  });
});
