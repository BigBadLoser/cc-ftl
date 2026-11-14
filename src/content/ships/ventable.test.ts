import { describe, expect, it } from 'vitest';
import { content } from '..';
import { AirlockC, ModuleC, airlockTiles, homeShip, newGame, shipGrid, Struct } from '../../sim';
import { ventableDoor } from '../../sim/vents';

describe('which doors can have a vent', () => {
  it('an airlock door cannot, an ordinary door can, and the command is rejected for the airlock', () => {
    const sim = newGame(7, content);
    for (let i = 0; i < 5; i++) sim.step();
    const ship = homeShip(sim);
    const grid = shipGrid(sim, ship)!;
    const id = sim.world.query(AirlockC, ModuleC).find((e) => !!sim.content.modules[sim.world.get(e, ModuleC)!.def]?.airlock)!;
    const m = sim.world.get(id, ModuleC)!;
    const t = airlockTiles(sim.content.modules[m.def]!, m);
    expect(grid.get('struct', t.inner.x, t.inner.y)).toBe(Struct.Door);
    expect(ventableDoor(sim, grid, t.inner.x, t.inner.y)).toBe(false);
    expect(ventableDoor(sim, grid, t.outer.x, t.outer.y)).toBe(false);
    let plain: { x: number; y: number } | null = null;
    for (let y = grid.y0; y < grid.y0 + grid.height && !plain; y++) {
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
        if (grid.get('struct', x, y) === Struct.Door && ventableDoor(sim, grid, x, y)) { plain = { x, y }; break; }
      }
    }
    expect(plain).not.toBeNull();
    sim.enqueue({ type: 'door.vent', ship, x: t.inner.x, y: t.inner.y, open: true });
    sim.enqueue({ type: 'door.vent', ship, x: plain!.x, y: plain!.y, open: true });
    sim.step();
    expect(grid.get('vent', t.inner.x, t.inner.y)).toBe(0);
    expect(grid.get('vent', plain!.x, plain!.y)).not.toBe(0);
  });
});
