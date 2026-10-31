import { describe, expect, it } from 'vitest';
import { JobC, ModuleC, Struct, footprintTiles, ProductionC, StorageC, homeShip, newGame, placementError, shipGrid, spawnModule, storageAdd, totalStock, type Sim } from '../../sim';
import { content } from '../index';

/** True if the refinery would stand against a door tile (it could seal the room, and its access tile with it). */
function blocksDoor(sim: Sim, ship: number, x: number, y: number, rot: number): boolean {
  const g = shipGrid(sim, ship)!;
  const def = content.modules['module.refinery']!;
  return footprintTiles(def, x, y, rot).some((t) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.inBounds(t.x + dx!, t.y + dy!) && g.get('struct', t.x + dx!, t.y + dy!) === Struct.Door));
}

/** First spot (scanning from the bottom right) where the refinery fits on the player's ship. */
function spot(sim: Sim, ship: number): { x: number; y: number; rot: number } {
  const g = shipGrid(sim, ship)!;
  for (let y = g.y0 + g.height - 1; y >= g.y0; y--) for (let x = g.x0 + g.width - 1; x >= g.x0; x--) for (let rot = 0; rot < 4; rot++) if (!placementError(sim, ship, 'module.refinery', x, y, rot) && !blocksDoor(sim, ship, x, y, rot)) return { x, y, rot };
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
    const r = content.recipes['recipe.refine_iron'];
    storageAdd(sim, crate, 'item.iron_ore', r.inputs[0]!.count * 2);
    const metal = totalStock(sim, 'item.metal');
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_iron', mode: 'count', target: 2 });
    for (let i = 0; i < 6000 && (sim.world.get(id, ProductionC)?.orders[0]?.done ?? 0) < 2; i++) { sim.step(); sim.events.drain(); }
    expect(sim.world.get(id, ProductionC)?.orders[0]?.done).toBe(2);
    for (let i = 0; i < 1500; i++) sim.step();
    expect(totalStock(sim, 'item.iron_ore')).toBe(0);
    expect(totalStock(sim, 'item.metal')).toBe(metal + r.outputs[0]!.count * 2);
  });

  it('queued for every ore, it refines the ore there is instead of waiting on the first order', { timeout: 30000 }, () => {
    const sim = newGame(4, content);
    const ship = homeShip(sim);
    const at = spot(sim, ship);
    const id = spawnModule(sim, 'module.refinery', at.x, at.y, at.rot);
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    const r = content.recipes['recipe.refine_iron'];
    storageAdd(sim, crate, 'item.iron_ore', r.inputs[0]!.count);
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_rare', mode: 'count', target: 5 }); // no rare ore aboard
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_iron', mode: 'count', target: 1 });
    const iron = () => sim.world.get(id, ProductionC)?.orders.find((o) => o.recipe === 'recipe.refine_iron')?.done ?? 0;
    for (let i = 0; i < 6000 && iron() < 1; i++) { sim.step(); sim.events.drain(); }
    expect(iron()).toBe(1);
  });

  it('the iron job survives its ore being picked up: one job, no cancel and recreate cycle (Codex on #229)', { timeout: 60000 }, () => {
    const sim = newGame(4, content);
    const ship = homeShip(sim);
    const at = spot(sim, ship);
    const id = spawnModule(sim, 'module.refinery', at.x, at.y, at.rot);
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    const r = content.recipes['recipe.refine_iron'];
    storageAdd(sim, crate, 'item.iron_ore', r.inputs[0]!.count); // exactly one batch: carrying it leaves none in stock
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_rare', mode: 'count', target: 5 }); // no rare ore aboard
    sim.enqueue({ type: 'production.add', moduleId: id, recipe: 'recipe.refine_iron', mode: 'count', target: 1 });
    const iron = () => sim.world.get(id, ProductionC)?.orders.find((o) => o.recipe === 'recipe.refine_iron')?.done ?? 0;
    const jobs = new Map<number, string>();
    for (let i = 0; i < 6000 && iron() < 1; i++) {
      sim.step();
      sim.events.drain();
      for (const j of sim.world.query(JobC)) {
        const c = sim.world.get(j, JobC)!;
        if (c.kind === 'craft' && c.target === id && !jobs.has(j)) jobs.set(j, c.craft!.recipe);
      }
    }
    expect(iron()).toBe(1);
    expect([...jobs.values()]).toEqual(['recipe.refine_iron']);
  });
});
