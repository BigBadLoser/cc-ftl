import { describe, expect, it } from 'vitest';
import { homeShip, newGame, placementError, shipGrid } from '../sim';
import { accepts } from '../sim/items/storage';
import { content } from './index';
import manifest from '../../public/assets/1x/manifest.json';

/** The storage set's special stores (armory, cold store, tank): buildable, each taking only its own goods. */
const STORES = ['module.storage_armory', 'module.storage_cold', 'module.storage_tank'] as const;

describe('special stores', () => {
  const sim = newGame(1, content, 'ship.starter', false);

  it.each(STORES)('%s can be placed on the starter ship and has a cost', (id) => {
    const def = content.modules[id];
    expect(def.cost?.length).toBeGreaterThan(0);
    expect(def.storage?.capacity).toBeGreaterThan(0);
    const ship = homeShip(sim), grid = shipGrid(sim, ship)!;
    let ok = false;
    for (let y = grid.y0; y < grid.y0 + grid.height && !ok; y++) for (let x = grid.x0; x < grid.x0 + grid.width && !ok; x++) ok = placementError(sim, ship, id, x, y, 0) === null;
    expect(ok).toBe(true);
  });

  it('takes only its own goods', () => {
    const filter = (id: (typeof STORES)[number]) => [...(content.modules[id].storageAccepts ?? [])];
    const armory = filter('module.storage_armory'), cold = filter('module.storage_cold'), tank = filter('module.storage_tank');
    for (const i of ['item.rifle', 'item.sidearm', 'item.blade', 'item.missile']) expect(accepts(armory, i)).toBe(true);
    for (const i of ['item.ration', 'item.meal_good', 'item.greens', 'item.herbs']) expect(accepts(cold, i)).toBe(true);
    for (const i of ['item.water', 'item.oxygen']) expect(accepts(tank, i)).toBe(true);
    for (const i of ['item.metal', 'item.iron_ore', 'item.scrap_hull']) for (const f of [armory, cold, tank]) expect(accepts(f, i)).toBe(false);
    expect(accepts(armory, 'item.ration')).toBe(false);
    expect(accepts(cold, 'item.fuel')).toBe(false);
    expect(accepts(tank, 'item.rifle')).toBe(false);
    expect(accepts(tank, 'item.fuel')).toBe(false); // fuel is solid (fuel cells): a rack or crate holds it
  });

  it.each(STORES)('%s has its fill sprites at every rotation', (id) => {
    const assets = manifest.assets as Record<string, unknown>;
    for (const fill of ['empty', 'partial', 'full']) {
      expect(assets[`${id}.${fill}`]).toBeDefined();
      for (const r of [1, 2, 3]) expect(assets[`${id}.r${r}.${fill}`]).toBeDefined();
    }
  });
});
