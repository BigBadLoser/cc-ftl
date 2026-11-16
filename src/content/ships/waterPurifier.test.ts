import { describe, expect, it } from 'vitest';
import { ProductionC, StorageC, homeShip, newGame, placementError, shipGrid, spawnModule, storageAdd, totalStock } from '../../sim';
import { content } from '../index';

/** First spot (scanning from the bottom right) where the purifier fits on the player's ship. */
function spot(sim: ReturnType<typeof newGame>, ship: number): { x: number; y: number; rot: number } {
  const g = shipGrid(sim, ship)!;
  for (let y = g.y0 + g.height - 1; y >= g.y0; y--) for (let x = g.x0 + g.width - 1; x >= g.x0; x--) for (let rot = 0; rot < 4; rot++) if (!placementError(sim, ship, 'module.waterPurifier', x, y, rot)) return { x, y, rot };
  throw new Error('no room for a water purifier');
}

describe('water purifier', () => {
  it('is a 2x1 powered crafting workstation with an access tile', () => {
    const def = content.modules['module.waterPurifier'];
    expect(def.footprint).toEqual([2, 1]);
    expect(def.crafting && def.workstation).toBe(true);
    expect(def.access).toEqual([0, 1]);
    expect(def.power).toBeLessThan(0);
  });

  it('a crew member purifies ice into water', () => {
    const sim = newGame(4, content);
    const ship = homeShip(sim);
    const at = spot(sim, ship);
    const id = spawnModule(sim, 'module.waterPurifier', at.x, at.y, at.rot);
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    const r = content.recipes['recipe.purify_ice'];
    storageAdd(sim, crate, 'item.ice', r.inputs[0]!.count * 2);
    const ice = totalStock(sim, 'item.ice');
    const water = totalStock(sim, 'item.water');
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.purify_ice', mode: 'count', target: 2 });
    for (let i = 0; i < 6000 && (sim.world.get(id, ProductionC)?.orders[0]?.done ?? 0) < 2; i++) { sim.step(); sim.events.drain(); }
    expect(sim.world.get(id, ProductionC)?.orders[0]?.done).toBe(2);
    for (let i = 0; i < 1500; i++) sim.step();
    expect(totalStock(sim, 'item.ice')).toBe(ice - r.inputs[0]!.count * 2);
    expect(totalStock(sim, 'item.water')).toBe(water + r.outputs[0]!.count * 2);
  });
});
