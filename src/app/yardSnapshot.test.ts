import { describe, expect, it } from 'vitest';
import { JobC } from '../sim';
import { outline, planHull, run, yardGame } from '../content/yardFixture';
import { buildYard } from './yardSnapshot';

describe('yard snapshot: the ghost overlay', () => {
  it('leaves tiles the crew have started on out of the order overlay (the renderer draws them as truss)', () => {
    const { sim, station, me } = yardGame();
    planHull(sim, me, outline(sim, me, 8, -2, 4, 3));
    sim.enqueue({ type: 'yard.order', station });
    run(sim, 2);
    const order = sim.yard.orders[0]!;
    const before = buildYard(sim, station).order!;
    expect(before.walls).toHaveLength(order.walls.length);
    expect(before.floor).toHaveLength(order.floor.length);
    let started = 0;
    for (const id of sim.world.query(JobC)) {
      const j = sim.world.get(id, JobC)!;
      if (j.yard === order.id && started < 4) {
        j.progress = 1;
        started++;
      }
    }
    const after = buildYard(sim, station).order!;
    expect(after.walls.length + after.floor.length).toBe(before.walls.length + before.floor.length - 4);
  });
});
