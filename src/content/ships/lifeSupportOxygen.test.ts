import { describe, expect, it } from 'vitest';
import { ModuleC, StorageC, homeShip, newGame, shipGrid, storageCount, type Sim } from '../../sim';
import { storageTake } from '../../sim/items/storage';
import { content } from '../index';

const OX = 'item.oxygen';
const stores = (sim: Sim): number => sim.world.query(StorageC).reduce((n, id) => n + storageCount(sim, id, OX), 0);

/** The starter ship with its life support room's air drained, with or without bottled oxygen in the stores; returns the room's air after 4 s. */
function refill(oxygen: boolean): { air: number; used: number } {
  const sim = newGame(7, content);
  if (!oxygen) for (const id of sim.world.query(StorageC)) storageTake(sim, id, OX, 999);
  for (let i = 0; i < 20; i++) sim.step(); // rooms are found on the first ticks
  const g = shipGrid(sim, homeShip(sim))!;
  const ls = sim.world.query(ModuleC).find((id) => {
    const x = sim.world.get(id, ModuleC)!;
    return x.def === 'module.lifeSupport' && g.get('room', x.x, x.y) > 0;
  })!;
  const m = sim.world.get(ls, ModuleC)!;
  const room = g.get('room', m.x, m.y);
  const tiles: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (room && g.get('room', x, y) === room) tiles.push({ x, y });
  for (const t of tiles) g.set('o2', t.x, t.y, 0);
  const before = stores(sim);
  for (let i = 0; i < 4 * 20; i++) sim.step();
  const air = tiles.reduce((n, t) => n + g.get('o2', t.x, t.y), 0) / tiles.length;
  return { air, used: before - stores(sim) };
}

describe('life support with bottled oxygen (issue #222)', () => {
  it('refills a room faster with oxygen in the stores, burning it gently', () => {
    const withO = refill(true);
    const without = refill(false);
    expect(content.modules['module.lifeSupport'].o2Supply?.item).toBe(OX);
    expect(withO.air).toBeGreaterThan(without.air * 1.5);
    expect(withO.used).toBeGreaterThanOrEqual(1);
    expect(withO.used).toBeLessThanOrEqual(2); // one unit covers 20 s of boost
    expect(without.used).toBe(0);
  });

  it('burns none while the air is normal', () => {
    const sim = newGame(7, content);
    const before = stores(sim);
    for (let i = 0; i < 60 * 20; i++) sim.step();
    expect(stores(sim)).toBe(before);
  });
});
