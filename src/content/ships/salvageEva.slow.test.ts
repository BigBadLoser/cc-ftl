import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, PositionC, ShipC, VehicleC, deserialize, serialize } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { SalvageCrewC, SalvageTripC } from '../../sim/salvage/components';
import { SuitC } from '../../sim/eva/components';
import { content } from '../index';
import { shuttleOf } from './ferryFixture';
import { of, play, scrapHome, setup } from './salvageEvaFixture';

describe('salvage teams: the shuttle and EVA loop', () => {
  it('sends a suited team by shuttle, strips the wreck, brings the scrap and the crew home, and removes the wreck', () => {
    const { sim, home, wreck } = setup();
    const before = scrapHome(sim, home);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech', 'energy', 'weapons', 'comfort'] });
    const all = play(sim, 20 * 60 * 30, (a) => of(a, 'salvage.done').length > 0);
    const sent = of(all, 'salvage.teamSent');
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]!.vehicle).toBe(shuttleOf(sim));
    expect(of(all, 'salvage.done')).toMatchObject([{ ship: wreck, removed: true }]);
    expect(sim.world.has(wreck, ShipC)).toBe(false);
    // Everyone is back aboard the home ship, out of their suits and no longer on the team.
    const rest = play(sim, 20 * 120, () => sim.world.query(SalvageTripC).length === 0);
    for (const c of sent.flatMap((e) => e.crew)) {
      if (!sim.world.has(c, CrewC)) continue;
      expect(sim.world.has(c, SalvageCrewC)).toBe(false);
      expect(sim.world.has(c, AboardC)).toBe(false);
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
      expect(sim.world.has(c, SuitC)).toBe(false);
    }
    expect(of([...all, ...rest], 'salvage.teamHome').at(-1)).toMatchObject({ ship: wreck, reason: 'done' });
    expect(scrapHome(sim, home)).toBeGreaterThan(before);
    expect(sim.world.get(shuttleOf(sim), VehicleC)).toMatchObject({ state: 'stowed', autopilot: false });
  });

  it('is deterministic and survives a save mid-shift', () => {
    const a = setup(5);
    const b = setup(5);
    for (const s of [a, b]) s.sim.enqueue({ type: 'salvage.order', ship: s.wreck, types: ['hull', 'tech'] });
    play(a.sim, 20 * 90);
    play(b.sim, 20 * 90);
    expect(serialize(a.sim)).toBe(serialize(b.sim));
    const c = deserialize(serialize(a.sim), content);
    play(a.sim, 20 * 90);
    play(c, 20 * 90);
    expect(serialize(c)).toBe(serialize(a.sim));
  });
});
