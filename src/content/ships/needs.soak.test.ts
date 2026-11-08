import { describe, expect, it } from 'vitest';
import { CrewC, ShipC, TaskC, TICK_HZ, homeShip, liftShip, removeModule, stampPacket } from '../../sim';
import { claimedBed } from '../../sim/ai/task';
import { humans, hungry, needs } from './needsFixture';

// Soak tier: the whole sleep after the bed is dismantled and the ship cut off, run from the low rest the sleeper started with.
describe('needs, soak', () => {
  it('a sleeper whose bed is dismantled, then cut off by a jump, sleeps on and wakes', () => {
    const { sim } = hungry(100);
    const id = humans(sim)[1] as number;
    needs(sim, id).rest = 5;
    for (let i = 0; i < 60 * TICK_HZ && !(claimedBed(sim, id) && sim.world.get(id, CrewC)!.activity === 'sleeping'); i++) sim.step();
    const bed = claimedBed(sim, id);
    expect(bed).toBeGreaterThan(0);
    removeModule(sim, bed);
    const ship = homeShip(sim);
    const at = sim.world.get(ship, ShipC)!;
    stampPacket(sim, liftShip(sim, ship), at.x, at.y);
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.world.get(id, CrewC)!.activity).toBe('sleeping');
    expect(sim.world.get(id, TaskC)?.machine).toBe('sleep');
    for (let i = 0; i < 1200 * TICK_HZ && sim.world.get(id, CrewC)!.activity === 'sleeping'; i++) sim.step();
    expect(sim.world.get(id, CrewC)!.activity).not.toBe('sleeping');
  });
});
