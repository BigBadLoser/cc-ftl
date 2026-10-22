import { describe, expect, it } from 'vitest';
import { ModuleC, ProductionC, StorageC, homeShip, newGame, placementError, shipGrid, spawnModule, storageAdd, totalStock, type Sim } from '../../sim';
import { content } from '../index';

/** First spot (scanning from the bottom right) where the refinery fits on the player's ship. */
function spot(sim: Sim, ship: number): { x: number; y: number; rot: number } {
  const g = shipGrid(sim, ship)!;
  for (let y = g.y0 + g.height - 1; y >= g.y0; y--) for (let x = g.x0 + g.width - 1; x >= g.x0; x--) for (let rot = 0; rot < 4; rot++) if (!placementError(sim, ship, 'module.refinery', x, y, rot)) return { x, y, rot };
  throw new Error('no room for a refinery');
}

const refineryId = (sim: Sim): number => [...sim.world.query(ModuleC)].find((id) => sim.world.get(id, ModuleC)?.def === 'module.refinery') ?? 0;

describe('ore refinery', () => {
  it('is a 3x4 crafting workstation that can be placed and built on the player ship', { timeout: 30000 }, () => {
    const def = content.modules['module.refinery'];
    expect(def.footprint).toEqual([3, 4]);
    expect(def.crafting && def.workstation).toBe(true);
    const sim = newGame(4, content);
    const ship = homeShip(sim);
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    for (const q of def.cost) storageAdd(sim, crate, q.item, q.count);
    const at = spot(sim, ship);
    sim.enqueue({ type: 'job.buildModule', ship, def: 'module.refinery', x: at.x, y: at.y, rot: at.rot });
    for (let i = 0; i < 8 * 60 * 20 && !refineryId(sim); i++) { sim.step(); sim.events.drain(); }
    expect(refineryId(sim)).not.toBe(0);
  });

  it('a crew member refines iron ore into metal', { timeout: 30000 }, () => {
    const sim = newGame(4, content);
    const ship = homeShip(sim);
    const at = spot(sim, ship);
    const id = spawnModule(sim, 'module.refinery', at.x, at.y, at.rot);
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    storageAdd(sim, crate, 'item.iron_ore', 6);
    const metal = totalStock(sim, 'item.metal');
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_iron', mode: 'count', target: 2 });
    for (let i = 0; i < 6000 && (sim.world.get(id, ProductionC)?.orders[0]?.done ?? 0) < 2; i++) { sim.step(); sim.events.drain(); }
    expect(sim.world.get(id, ProductionC)?.orders[0]?.done).toBe(2);
    for (let i = 0; i < 1500; i++) sim.step();
    expect(totalStock(sim, 'item.iron_ore')).toBe(0);
    expect(totalStock(sim, 'item.metal')).toBe(metal + 4);
  });
});
