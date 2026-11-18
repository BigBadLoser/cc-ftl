import { describe, expect, it } from 'vitest';
import { VehicleC } from '../sim/vehicles/components';
import { shuttleOut, until } from '../../test/support/fixtures/jobs';

// Slow tier: the tail of a delivery that jobs.test.ts leaves out (it ends at the drop-off).
describe('station jobs, a delivery to the end', () => {
  it('after the drop-off the shuttle flies home and is stowed again, free for other work', () => {
    const { sim } = shuttleOut();
    until(sim, () => sim.galaxy.jobs.length === 0);
    const deal = sim.trade.deals.find((d) => d.handover)!;
    expect(deal.phase).toBe('done');
    until(sim, () => deal.vehicle === 0, 3000);
    expect(deal.vehicle).toBe(0);
    // Every vehicle stowed and off autopilot (a station's own that never flew has no autopilot set at all).
    for (const vid of sim.world.query(VehicleC)) {
      const v = sim.world.get(vid, VehicleC)!;
      expect(v.state).toBe('stowed');
      expect(v.autopilot ?? false).toBe(false);
    }
  });
});
