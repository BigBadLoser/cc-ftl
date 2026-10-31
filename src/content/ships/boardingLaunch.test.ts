import { describe, expect, it } from 'vitest';
import { AboardC, PositionC, VehicleC } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { airlockOf, crewOn, nth, of, run, setup, shuttleOf } from './boardingFixture';

describe('boarding.launch', () => {
  it('embarks the party, docks at the enemy airlock and lands all of them on the enemy ship, the pilot too', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    const onEnemy = (c: number) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 2);
    const events = run(sim, 3000, () => party.every(onEnemy));
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(of(events, 'command.rejected')).toEqual([]);
    expect(party.every(onEnemy)).toBe(true);
    expect(v.state).toBe('docked');
    expect(v.pilot).toBe(0);
    expect(v.passengers).toEqual([]);
  });

  it('the landed party can be recalled and the first one back flies the shuttle home', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 3000, () => sim.world.get(shuttle, VehicleC)!.state === 'docked' && party.every((c) => !sim.world.has(c, AboardC)));
    run(sim, 5);
    sim.enqueue({ type: 'crew.recall', ids: party });
    const events = run(sim, 4000, () => sim.world.get(shuttle, VehicleC)!.state === 'stowed' && party.every((c) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC)));
    expect(of(events, 'crew.recallFailed')).toEqual([]);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    for (const c of party) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(nth(sim, 1));
  });

  it('rejects an empty party and a friendly airlock', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const [a] = crewOn(sim, 1) as [number];
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: [], airlock: airlockOf(sim, 2) });
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: [a], airlock: airlockOf(sim, 1) });
    const events = run(sim, 2);
    expect(of(events, 'command.rejected').map((e) => e.reason)).toEqual(['noCrew', 'badTarget']);
  });
});
