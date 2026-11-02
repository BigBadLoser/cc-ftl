import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, DraftedC, JobC, NeedsC, PositionC, PrioritiesC, ShipC, VehicleC, type Sim } from '../../sim';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { unsafeMembers } from '../../sim/away/depart';
import { passagesOf } from '../../sim/away/passage';
import { SuitC } from '../../sim/eva/components';
import { ferryFree } from '../../sim/ferry/pick';
import { shipIdOf } from '../../sim/regions';
import { AWAY_HOME_HUNGER, AWAY_HOME_REST, AWAY_LIFT_SEC } from '../../sim/tuning';
import { policies } from '../policies';
import { shuttleOf } from './ferryFixture';
import { of, play, setup } from './salvageEvaFixture';

/** Deconstruct jobs on `n` of the wreck's top hull walls: construction work on the site, reachable from the hull. */
function siteWork(sim: Sim, wreck: number, n = 1): number[] {
  const s = sim.world.get(wreck, ShipC)!;
  return Array.from({ length: n }, (_, i) => {
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, { category: 'construction', kind: 'deconstruct', x: s.x + 2 + i, y: s.y + 1, struct: 0, work: 400, progress: 0, reservedBy: 0 });
    return id;
  });
}

const crewOn = (sim: Sim, ship: number): number[] =>
  [...sim.world.query(CrewC, PositionC)].filter((c) => !sim.world.has(c, DeadC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === ship).sort((a, b) => a - b);

/** Open a site on the fixture's wreck with work on it, and play until the party has landed and been handed to the crew AI. */
function landed(n = 3): { sim: Sim; home: number; wreck: number; shuttle: number; party: number[] } {
  const { sim, home, wreck } = setup();
  siteWork(sim, wreck, n);
  const shuttle = shuttleOf(sim);
  sim.enqueue({ type: 'away.open', ship: wreck });
  play(sim, 20 * 200, () => crewOn(sim, wreck).length > 0 && crewOn(sim, wreck).every((c) => !sim.world.has(c, DraftedC)));
  return { sim, home, wreck, shuttle, party: crewOn(sim, wreck) };
}

describe('away sites', () => {
  it('sends crew out on passages and hands them to the crew AI on the site, where they do its work', () => {
    const { sim, wreck, shuttle, party } = landed();
    expect(party.length).toBeGreaterThan(0);
    expect(ferryFree(sim, shuttle)).toBe(false); // the run owns the shuttle
    for (const c of party) {
      expect(sim.world.get(c, AwayC)).toMatchObject({ site: wreck, vehicle: shuttle, cat: 'construction' });
      expect(sim.world.get(c, SuitC)?.vehicle).toBeUndefined(); // the suit is the wearer's: the shuttle may leave
    }
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('stay');
    const done = play(sim, 20 * 300, (a) => a.some((e) => e.type === 'crew.jobDone' && e.ship === wreck && e.kind === 'deconstruct'));
    expect(done.some((e) => e.type === 'crew.jobDone' && e.ship === wreck && e.kind === 'deconstruct')).toBe(true);
  });

  it('a tired crew member comes home on a trip of their own while the rest work on, and the shuttle goes back', () => {
    const { sim, home, wreck, shuttle, party } = landed();
    expect(party.length).toBeGreaterThan(1);
    const [tired, ...rest] = party as [number, ...number[]];
    sim.world.get(tired, NeedsC)!.rest = 22;
    const all = play(sim, 20 * 300, (a) => of(a, 'away.returned').length > 0);
    expect(of(all, 'away.returned')).toMatchObject([{ ship: wreck, vehicle: shuttle, crew: [tired] }]);
    expect(shipIdOf(sim, sim.world.get(tired, PositionC)!)).toBe(home);
    expect(sim.world.has(tired, AwayC)).toBe(false);
    for (const c of rest) expect(sim.world.get(c, AwayC)?.site).toBe(wreck);
    play(sim, 20 * 200, () => sim.world.get(shuttle, SiteRunC)?.phase === 'stay');
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('stay');
  });

  it('the departure check: a worker who could not last a round trip, or is down, is not safe', () => {
    const { sim, shuttle, party } = landed();
    expect(unsafeMembers(sim, shuttle)).toEqual([]);
    const [low] = party as [number];
    sim.world.get(low, SuitC)!.air = 60;
    expect(unsafeMembers(sim, shuttle)).toEqual([low]);
  });

  it('a waiting passenger does not leave while a worker staying out is unsafe', () => {
    const { sim, shuttle, party } = landed();
    const [tired, low] = party as [number, number];
    sim.world.get(tired, NeedsC)!.rest = 22;
    // The worker staying out cannot walk anywhere (held by the player) and has too little air for a round trip.
    sim.world.add(low, DraftedC, { target: null });
    play(sim, 20 * 60, () => sim.world.get(tired, AwayC)?.home === true && !sim.world.has(tired, PositionC));
    expect(sim.world.get(tired, AwayC)?.home).toBe(true);
    expect(sim.world.has(tired, PositionC)).toBe(false); // aboard, waiting
    sim.world.get(low, SuitC)!.air = 120;
    expect(unsafeMembers(sim, shuttle)).toEqual([low]);
    const all = play(sim, 20 * 10);
    expect(of(all, 'away.departed')).toEqual([]);
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('stay');
    sim.world.get(low, SuitC)!.air = 600; // a fresh tank: now it may go
    expect(of(play(sim, 20 * 5), 'away.departed')).toHaveLength(1);
  });

  it('recalling the site brings the whole party home, lifting anyone who cannot come aboard, and ends it', () => {
    const { sim, home, wreck, shuttle, party } = landed();
    const [held] = party as [number];
    sim.world.add(held, DraftedC, { target: null }); // held by the player: never walks back on their own
    sim.enqueue({ type: 'away.recall', ship: wreck });
    const all = play(sim, 20 * (AWAY_LIFT_SEC + 200), (a) => of(a, 'away.closed').length > 0);
    expect(of(all, 'away.closed')).toMatchObject([{ ship: wreck, vehicle: shuttle, reason: 'closed' }]);
    for (const c of party) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(home);
      expect(sim.world.has(c, AwayC)).toBe(false);
    }
    expect(sim.world.has(wreck, AwaySiteC)).toBe(false);
    expect(sim.world.has(shuttle, SiteRunC)).toBe(false);
    expect(sim.world.get(shuttle, VehicleC)).toMatchObject({ state: 'stowed', autopilot: false });
    expect(passagesOf(sim, shuttle)).toEqual([]);
  });

  it('home cover: a crew member who could take an open emergency at home is not given a passage', () => {
    const { sim, home, wreck } = setup();
    siteWork(sim, wreck);
    const shuttle = shuttleOf(sim);
    const crew = [...sim.world.query(CrewC, PositionC)].filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === home).sort((a, b) => a - b);
    const [free] = crew as [number];
    for (const c of crew) sim.world.add(c, DraftedC, { target: null }); // nobody free while the passages go up
    Object.assign(sim.world.get(free, PrioritiesC)!, { construction: 1, firefighting: 4 });
    Object.assign(sim.world.get(free, NeedsC)!, { rest: 100, hunger: 100 });
    sim.enqueue({ type: 'away.open', ship: wreck });
    play(sim, 5);
    expect(passagesOf(sim, shuttle).length).toBeGreaterThan(0);
    // An open breach seal at home (an emergency) the crew member can reach: they take it (level 4), not a passage (level 1).
    const at = sim.world.get(free, PositionC)!;
    const seal = sim.world.createEntity();
    sim.world.add(seal, JobC, { category: 'firefighting', kind: 'build', x: at.x, y: at.y, struct: 0, work: 1_000_000, progress: 0, reservedBy: 0 });
    sim.world.remove(free, DraftedC);
    play(sim, 20 * 10);
    expect(passagesOf(sim, shuttle).every((j) => sim.world.get(j, JobC)!.reservedBy === 0)).toBe(true);
    expect(sim.world.get(seal, JobC)?.reservedBy).toBe(free);
    // Once the emergency is gone, the passage is theirs.
    sim.world.destroyEntity(seal);
    play(sim, 20 * 5);
    expect(passagesOf(sim, shuttle).some((j) => sim.world.get(j, JobC)!.reservedBy === free) || sim.world.has(free, AwayC)).toBe(true);
  });

  it('a passage is only for crew rested and fed enough to stay a while', () => {
    const { sim, wreck } = setup();
    siteWork(sim, wreck);
    const shuttle = shuttleOf(sim);
    for (const c of sim.world.query(CrewC, NeedsC)) sim.world.get(c, NeedsC)!.rest = 50;
    sim.enqueue({ type: 'away.open', ship: wreck });
    play(sim, 20 * 10);
    expect(passagesOf(sim, shuttle).length).toBeGreaterThan(0);
    expect(passagesOf(sim, shuttle).every((j) => sim.world.get(j, JobC)!.reservedBy === 0)).toBe(true);
  });

  it('the return drive comes before sleep and eat, and wants them home before those would (needs off the home grid)', () => {
    const ids = policies['policy.colonist'].drives.map((d) => d.id as string);
    expect(ids.indexOf('return')).toBeLessThan(ids.indexOf('sleep'));
    expect(ids.indexOf('return')).toBeLessThan(ids.indexOf('eat'));
    const enter = (id: string): number => (policies['policy.colonist'].drives.find((d) => d.id === id) as { enter: number }).enter;
    expect(AWAY_HOME_REST * 10).toBeGreaterThan(enter('sleep'));
    expect(AWAY_HOME_HUNGER * 10).toBeGreaterThanOrEqual(enter('eat'));
  });

  it('a tired crew member on the site does not lie down there while the shuttle is away', () => {
    const { sim, shuttle, party } = landed();
    const [tired] = party as [number];
    sim.world.get(shuttle, SiteRunC)!.phase = 'home'; // the shuttle is off on a trip
    sim.world.get(shuttle, VehicleC)!.dest = { type: 'bay' };
    sim.world.get(tired, NeedsC)!.rest = 10;
    play(sim, 20 * 3);
    expect(sim.world.get(tired, CrewC)!.activity).not.toBe('sleeping');
  });
});
