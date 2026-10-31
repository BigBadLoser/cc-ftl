import { describe, expect, it } from 'vitest';
import { AboardC, PositionC, VehicleC } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { airlockOf, crewOn, nth, of, run, setup, shuttleOf } from './boardingFixture';

describe('boarding.launch', () => {
  it('embarks the party, docks at the enemy airlock and steps the passengers out onto the enemy ship', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const [pilot, a, b] = crewOn(sim, 1) as [number, number, number];
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: [pilot, a, b], airlock: airlockOf(sim, 2) });
    const events = run(sim, 3000, () => !sim.world.has(a, AboardC) && sim.world.has(a, PositionC) && shipIdOf(sim, sim.world.get(a, PositionC)) === nth(sim, 2));
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(of(events, 'command.rejected')).toEqual([]);
    expect(v.state).toBe('docked');
    expect(v.pilot).toBe(pilot); // the first picked flies it, however the walk went
    expect(v.passengers).toEqual([]);
    for (const c of [a, b]) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(nth(sim, 2));
    expect(sim.world.has(pilot, AboardC)).toBe(true);
  });

  it('rejects a lone crew member and a friendly airlock', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const [pilot, a] = crewOn(sim, 1) as [number, number];
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: [pilot], airlock: airlockOf(sim, 2) });
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: [pilot, a], airlock: airlockOf(sim, 1) });
    const events = run(sim, 2);
    expect(of(events, 'command.rejected').map((e) => e.reason)).toEqual(['noPassengers', 'badTarget']);
  });
});
