import { describe, expect, it } from 'vitest';
import { ModuleC, footprintTiles, newGame, type Sim } from '../../sim';
import { content } from '../index';

function spawned(shipId: string): Sim {
  const sim = newGame(1, content);
  if (shipId !== 'ship.starter') sim.enqueue({ type: 'debug.spawnEnemy', template: shipId, x: 100, y: 50 });
  sim.step();
  return sim;
}

describe('combat content', () => {
  for (const shipId of ['ship.starter', 'ship.raider']) {
    it(`${shipId}: access tiles are open, power balances`, () => {
      const sim = spawned(shipId);
      const gridId = shipId === 'ship.starter' ? 1 : 2;
      const grid = sim.grids.get(gridId)!;
      let supply = 0;
      let demand = 0;
      for (const id of sim.world.query(ModuleC)) {
        const m = sim.world.get(id, ModuleC)!;
        if (m.gridId !== gridId) continue;
        const def = content.modules[m.def as keyof typeof content.modules] as { power: number; footprint: readonly [number, number] };
        const tiles = footprintTiles(def as never, m.x, m.y, m.rot);
        for (const t of tiles) expect(grid.get('struct', t.x, t.y), `${m.def} on floor`).toBe(1);
        if (def.power > 0) supply += def.power;
        else demand -= def.power;
      }
      expect(demand).toBeLessThanOrEqual(supply);
    });
  }
});
