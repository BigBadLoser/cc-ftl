import { describe, expect, it } from 'vitest';
import { AboardC, EmbarkOrderC, FerryC, ModuleC, PositionC, VehicleC, ferryFree } from '../../sim';
import { BoardLaunchC } from '../../sim/boarding/components';
import { launchOf, orderLaunch } from '../../sim/boarding/launch';
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

  it('flies the party home when the target airlock is lost on the approach', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    const lock = airlockOf(sim, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: lock });
    run(sim, 3000, () => sim.world.get(shuttle, BoardLaunchC)?.state === 'flying');
    expect(sim.world.get(shuttle, BoardLaunchC)?.state).toBe('flying');
    sim.world.get(lock, ModuleC)!.hp = 0; // shot out before the shuttle latches on
    const home = (c: number) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 1);
    const events = run(sim, 6000, () => party.every(home));
    expect(of(events, 'command.rejected').map((e) => e.reason)).toContain('aborted');
    expect(party.every(home)).toBe(true); // flown back and stepped out in the bay, not left in the shuttle
    expect(sim.world.has(shuttle, BoardLaunchC)).toBe(false);
  });

  it('a launch called off before take-off leaves no one walking to or sitting in the shuttle', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    sim.world.get(shuttle, BoardLaunchC)!.since = sim.tick - 10_000; // the pilot's walk has stalled
    const events = run(sim, 2);
    expect(of(events, 'command.rejected').map((e) => e.reason)).toEqual(['noPilot']);
    for (const c of party) expect(sim.world.has(c, EmbarkOrderC)).toBe(false);
    run(sim, 600);
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(v.pilot).toBe(0);
    expect(v.passengers).toEqual([]);
  });

  it('a shuttle has one owner: a launching shuttle is not free for cargo runs, and a ferrying one cannot launch', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    expect(sim.world.has(shuttle, BoardLaunchC)).toBe(true);
    expect(ferryFree(sim, shuttle)).toBe(false);

    const other = setup();
    const s2 = shuttleOf(other, 1);
    other.world.add(s2, FerryC, { phase: 'load' } as never); // only its presence matters here; no tick runs
    expect(orderLaunch(other, s2, crewOn(other, 1).slice(0, 1), airlockOf(other, 2))).toBe('busy');
  });

  it('the whole party is reserved once a launch is accepted: no crew member can be picked for a second launch', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    // The passenger (not yet walking) is already taken: a second launch naming them is refused.
    expect(orderLaunch(sim, shuttle, [party[1] as number], airlockOf(sim, 2))).not.toBeNull();
    expect(launchOf(sim, party[1] as number)).toBe(shuttle);
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
