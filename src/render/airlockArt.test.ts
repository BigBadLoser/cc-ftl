import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, Struct, newGame, shipGrid } from '../sim';
import { airlockTiles } from '../sim/modules/airlock';
import { shipIdOf } from '../sim/regions';
import { content } from '../content';
import { airlockDoorTiles, airlockLayers } from './airlockArt';

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

describe('airlock hull block', () => {
  it('roofed, stands only where the hull has no art at the outer door (hullFallback), at the walls-up level', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)?.def === 'module.airlock')!;
    const m = sim.world.get(id, ModuleC)!;
    const def = content.modules['module.airlock']!;
    const hull = (roofed: boolean) => airlockLayers(sim.world, id, m, def, { level: 'cut', roofed, collar: null }).find((l) => l.key === 'module.airlock.hull');
    expect(hull(false)?.hullFallback).toBeUndefined();
    const roofed = hull(true)!;
    expect(roofed.roofVisible).toBe(true);
    expect(roofed.hullFallback).toEqual(airlockTiles(def, m).outer);
    expect(roofed.chain[0]).toMatch(/\.up$/);
  });
});
