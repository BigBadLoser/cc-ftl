import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, Struct, newGame, shipGrid } from '../sim';
import { airlockTiles } from '../sim/modules/airlock';
import { shipIdOf } from '../sim/regions';
import { content } from '../content';
import { airlockDoorTiles } from './airlockArt';

describe('airlock door tiles', () => {
  it("cover the outer door and the pod (inner door) of every airlock, the player's ship and a station's alike", () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 2 });
    sim.step();
    const station = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.immobile);
    const locks = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).filter((m) => m.def === 'module.airlock');
    expect(new Set(locks.map((m) => shipIdOf(sim, m)))).toContain(station);
    const tiles = airlockDoorTiles(sim.world, content.modules, () => true);
    for (const m of locks) {
      const t = airlockTiles(content.modules['module.airlock']!, m);
      expect(tiles).toContainEqual(t.outer);
      expect(tiles).toContainEqual(t.inner);
      // Both are door tiles in the grid, so without this the generic door sprite would be drawn on them.
      const g = shipGrid(sim, shipIdOf(sim, m))!;
      expect(g.get('struct', t.inner.x, t.inner.y)).toBe(Struct.Door);
      expect(g.get('struct', t.outer.x, t.outer.y)).toBe(Struct.Door);
    }
  });
});
