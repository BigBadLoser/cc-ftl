import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { AirlockC, ModuleC, airlockTiles, homeShip, newGame, shipGrid } from '../sim';
import type { Body } from '../sim/body';
import { mustWaitAtAirlockDoor } from '../sim/modules/airlock';
import type { Drone } from '../sim/drones/components';
import { fly } from '../sim/drones/flight';

describe('drone flight through an airlock door (#318)', () => {
  it('requests the cycle, holds while the door is shut, and passes once it is open', () => {
    const sim = newGame(7, content);
    for (let i = 0; i < 20; i++) sim.step();
    const ship = homeShip(sim);
    const grid = shipGrid(sim, ship)!;
    const id = sim.world.query(AirlockC, ModuleC).find((e) => !!sim.content.modules[sim.world.get(e, ModuleC)!.def]?.airlock)!;
    const m = sim.world.get(id, ModuleC)!;
    const t = airlockTiles(sim.content.modules[m.def]!, m);
    const a = sim.world.get(id, AirlockC)!;
    // Park the lock open to the outside, so the inner door is shut, and have a drone stand inside, bound through the inner door.
    a.state = 'outer';
    a.request = null;
    grid.set('door', t.inner.x, t.inner.y, 0);
    const b = { x: t.inside.x + 0.5, y: t.inside.y + 0.5, heading: 0 } as Body;
    const d = { steps: [{ x: t.inner.x, y: t.inner.y }] } as Drone;
    const step = (): boolean => fly(d, b, 3, () => true, (x, y) => mustWaitAtAirlockDoor(sim, grid, x, y));
    expect(step()).toBe(true);
    expect(a.request).toBe('inner'); // it asked for the cycle
    expect(d.steps.length).toBe(1);
    expect(b.x).toBe(t.inside.x + 0.5);
    expect(b.y).toBe(t.inside.y + 0.5);
    let waited = 0;
    for (let i = 0; i < 400 && d.steps.length > 0; i++) {
      sim.step();
      const open = grid.get('door', t.inner.x, t.inner.y) >= 255;
      const before = { x: b.x, y: b.y };
      step();
      if (!open) {
        waited++;
        expect(b).toMatchObject(before); // never moves while the door is shut
      }
    }
    expect(waited).toBeGreaterThan(0);
    expect(d.steps.length).toBe(0);
    expect(b.x).toBeCloseTo(t.inner.x + 0.5);
    expect(b.y).toBeCloseTo(t.inner.y + 0.5);
  });
});
