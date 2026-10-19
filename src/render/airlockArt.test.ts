import { describe, expect, it } from 'vitest';
import { ModuleC, Struct, newGame } from '../sim';
import { airlockTiles } from '../sim/portals/airlock';
import { content } from '../content';
import { airlockDoorTiles } from './airlockArt';

describe('airlock door tiles', () => {
  it('cover both the outer door and the pod (inner door): the airlock draws them, not the generic door sprite', () => {
    const sim = newGame(1, content);
    const m = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).find((x) => x.def === 'module.airlock')!;
    const t = airlockTiles(content.modules['module.airlock'], m);
    const tiles = airlockDoorTiles(sim.world, content.modules, m.gridId);
    expect(tiles).toContainEqual(t.outer);
    expect(tiles).toContainEqual(t.inner);
    const grid = sim.grids.get(m.gridId)!;
    expect(grid.get('struct', t.inner.x, t.inner.y)).toBe(Struct.Door); // the generic door sprite would be drawn here
    expect(grid.get('struct', t.outer.x, t.outer.y)).toBe(Struct.Door);
  });
});
