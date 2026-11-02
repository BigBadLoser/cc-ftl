import { describe, expect, it } from 'vitest';
import { DraftedC, PositionC, ShipC, VehicleC } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { NestC } from '../../sim/aliens/components';
import { SalvageCrewC, SalvageOrderC } from '../../sim/salvage/components';
import { shuttleOf } from './ferryFixture';
import { of, play, setup } from './salvageEvaFixture';

describe('salvage teams: blocks and recall', () => {
  it('blocks with noShuttle when the player has no shuttle, and runs once one is back', () => {
    const { sim, wreck } = setup();
    const shuttle = shuttleOf(sim);
    const parked = sim.world.get(shuttle, VehicleC)!;
    const saved = { ...parked };
    sim.world.remove(shuttle, VehicleC);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    const first = play(sim, 200);
    expect(of(first, 'salvage.blocked')).toMatchObject([{ ship: wreck, reason: 'noShuttle' }]);
    expect(sim.world.get(wreck, SalvageOrderC)).toMatchObject({ status: 'blocked', block: 'noShuttle' });
    sim.world.add(shuttle, VehicleC, saved);
    const later = play(sim, 400, (a) => of(a, 'salvage.teamSent').length > 0);
    expect(of(later, 'salvage.teamSent')).toHaveLength(1);
    expect(sim.world.get(wreck, SalvageOrderC)).toMatchObject({ status: 'running' });
  });

  it('cancelling brings the team home', () => {
    const { sim, home, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    // Wait until someone is out on the wreck.
    play(sim, 20 * 120, () => sim.world.query(SalvageCrewC).some((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck));
    const team = [...sim.world.query(SalvageCrewC)];
    expect(team.some((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck)).toBe(true);
    console.log('cancel at', sim.tick);
    sim.enqueue({ type: 'salvage.cancel', ship: wreck });
    const all = play(sim, 20 * 240, (a) => of(a, 'salvage.teamHome').length > 0);
    expect(of(all, 'salvage.teamHome')).toMatchObject([{ ship: wreck, reason: 'cancelled' }]);
    for (const c of team) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
      expect(sim.world.has(c, DraftedC)).toBe(false);
    }
    expect(sim.world.has(wreck, ShipC)).toBe(true); // a cancelled order leaves the wreck
  });

  it('something hostile turning up aboard sends the team home, and the order waits', () => {
    const { sim, home, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 20 * 120, () => sim.world.query(SalvageCrewC).some((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck));
    const team = [...sim.world.query(SalvageCrewC)];
    const s = sim.world.get(wreck, ShipC)!;
    const nest = sim.world.createEntity();
    sim.world.add(nest, NestC, { ship: wreck, x: s.x + 5, y: s.y + 3, timer: 0, laid: 0 });
    const all = play(sim, 20 * 240, (a) => of(a, 'salvage.teamHome').length > 0);
    expect(of(all, 'salvage.blocked')).toMatchObject([{ ship: wreck, reason: 'hostile' }]);
    expect(of(all, 'salvage.teamHome')).toMatchObject([{ ship: wreck, reason: 'hostile' }]);
    for (const c of team) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
    expect(of(play(sim, 20 * 30), 'salvage.teamSent')).toHaveLength(0); // no new shift while it is blocked
  });
});
