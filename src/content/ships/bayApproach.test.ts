import { describe, expect, it } from 'vitest';
import { BodyC, ModuleC, VehicleC, newGame, type Sim } from '../../sim';
import { content } from '../index';

/** The starter ship's shuttle out in space beside the ship, flying home to its bay. */
function approaching(): { sim: Sim; id: number } {
  const sim = newGame(1, content);
  const id = sim.world.query(VehicleC)[0] as number;
  const v = sim.world.get(id, VehicleC)!;
  const b = sim.world.get(id, BodyC)!;
  v.state = 'flying';
  b.x -= 30; // some way out, so the approach takes a while
  v.dest = { type: 'bay' };
  sim.step();
  expect(sim.world.get(id, VehicleC)?.state).toBe('flying');
  return { sim, id };
}

describe('a shuttle flying home to its bay (#305)', () => {
  it('lands when the bay is sound', () => {
    const { sim, id } = approaching();
    for (let i = 0; i < 20 * 60 && sim.world.get(id, VehicleC)?.state !== 'stowed'; i++) sim.step();
    expect(sim.world.get(id, VehicleC)?.state).toBe('stowed');
  });

  it('aborts the landing when the bay breaks on the way in, and is not lost with it', () => {
    const { sim, id } = approaching();
    const bay = sim.world.get(id, VehicleC)!.home;
    sim.world.get(bay, ModuleC)!.hp = 0;
    for (let i = 0; i < 20 * 60; i++) sim.step();
    const v = sim.world.get(id, VehicleC);
    expect(v).toBeDefined();
    expect(v?.state).not.toBe('stowed');
    expect(v?.dest?.type).not.toBe('bay');
  });
});
