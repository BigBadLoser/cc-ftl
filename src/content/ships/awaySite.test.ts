import { describe, expect, it } from 'vitest';
import { AboardC, CombatC, CrewC, DraftedC, FTL_CHARGE_SEC, JobC, NeedsC, PositionC, PrioritiesC, START_NODE, ShipC, VehicleC, deserialize, galaxyIndex, homeShip, serialize, type Sim } from '../../sim';
import { giveItems } from '../../sim/story/effects';
import { placementError, shipGrid, spawnModule } from '../../sim';
import { AirlockC } from '../../sim/modules/airlock';
import { airSources } from '../../sim/eva/sources';
import { content } from '../index';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { departCheck, unsafeMembers } from '../../sim/away/depart';
import { awayLeaks } from '../../sim/away/owned';
import { drawAir, setAirHolds } from '../../sim/eva/airLedger';
import { passagesOf } from '../../sim/away/passage';
import { AirHoldsC, SuitC } from '../../sim/eva/components';
import { ferryFree } from '../../sim/ferry/pick';
import { shipIdOf } from '../../sim/regions';
import { AWAY_HOME_HUNGER, AWAY_HOME_REST, AWAY_LIFT_SEC } from '../../sim/tuning';
import { policies } from '../policies';
import { shuttleOf } from './ferryFixture';
import { of, setup } from './salvageEvaFixture';
import { crewOn, landed, play, siteWork } from './awayFixture';

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

  /** A working airlock on the wreck's hull: another air source for the party. */
  function wreckAirlock(sim: Sim, wreck: number): number {
    const g = shipGrid(sim, wreck)!;
    for (let rot = 0; rot < 4; rot++) {
      for (let y = g.y0; y < g.y0 + g.height; y++) {
        for (let x = g.x0; x < g.x0 + g.width; x++) if (!placementError(sim, wreck, 'module.airlock', x, y, rot)) return spawnModule(sim, 'module.airlock', x, y, rot);
      }
    }
    throw new Error('no room for an airlock');
  }

  it('the departure check: another source counts only if the tank lasts the walk there (Codex 4448881718)', () => {
    const { sim, wreck, shuttle, party } = landed();
    wreckAirlock(sim, wreck);
    const [low] = party as [number];
    const src = airSources(sim, low, { without: shuttle })[0];
    expect(src).toBeDefined();
    sim.world.get(low, SuitC)!.air = src!.ticks / 20 + 10; // reaches it with 10 s left: under the 30 s reserve
    expect(unsafeMembers(sim, shuttle)).toEqual([low]);
    sim.world.get(low, SuitC)!.air = src!.ticks / 20 + 40;
    expect(unsafeMembers(sim, shuttle)).toEqual([]);
  });

  it('the departure check: a nearly empty airlock does not hide a tank that covers the round trip (Codex 4448881710)', () => {
    const { sim, wreck, shuttle, party } = landed();
    const lock = wreckAirlock(sim, wreck);
    sim.world.get(lock, AirlockC)!.air = 5;
    const [m] = party as [number];
    expect(airSources(sim, m, { without: shuttle }).length).toBeGreaterThan(0);
    sim.world.get(m, SuitC)!.air = 590;
    expect(unsafeMembers(sim, shuttle)).toEqual([]);
  });

  it('the departure check: an empty airlock with a player shuttle docked at it counts that shuttle\'s air (Codex 4449661837)', () => {
    const { sim, wreck, shuttle, party } = landed();
    const lock = wreckAirlock(sim, wreck);
    sim.world.get(lock, AirlockC)!.air = 0;
    // A second player shuttle docked at the site's airlock, with a full store: the refill tops tanks up from it.
    const other = sim.world.createEntity();
    sim.world.add(other, VehicleC, { ...structuredClone(sim.world.get(shuttle, VehicleC)!), state: 'docked', dock: lock, air: undefined });
    const [low] = party as [number];
    sim.world.get(low, SuitC)!.air = 60;
    expect(airSources(sim, low, { without: shuttle })[0]).toMatchObject({ kind: 'airlock', id: lock });
    expect(unsafeMembers(sim, shuttle)).toEqual([]);
    sim.world.get(other, VehicleC)!.air = 0; // nothing to give: unsafe again
    expect(unsafeMembers(sim, shuttle)).toEqual([low]);
  });

  it('the departure check: a worker whose full tank cannot last the round trip needs a whole top-up set aside (Codex 4449661828)', () => {
    // A small tank (120 s) that no worker's full tank stretches over a round trip with margin: each must count on the airlock.
    const { sim, wreck, shuttle, party } = landed(3, { ...content, suit: { ...content.suit!, airSec: 120 } });
    const lock = wreckAirlock(sim, wreck);
    for (const c of party) sim.world.get(c, SuitC)!.air = 120;
    sim.world.get(lock, AirlockC)!.air = 1; // a near-empty store covers nobody's top-up
    expect(unsafeMembers(sim, shuttle)).toEqual(party);
    sim.world.get(lock, AirlockC)!.air = 2 * 120; // a tank each for the first two (ascending id)
    expect(unsafeMembers(sim, shuttle)).toEqual(party.slice(2));
    sim.world.get(lock, AirlockC)!.air = 3 * 120;
    const r = departCheck(sim, shuttle);
    expect(r.unsafe).toEqual([]);
    expect(r.returnBy).toBeGreaterThan(sim.tick); // the shuttle must be back before the top-up set aside runs out
  });

  it('air holds: held air is for its crew member only, their refill spends it, and it ends once the shuttle is beside the site again', () => {
    const { sim, wreck, shuttle, party } = landed();
    const lock = wreckAirlock(sim, wreck);
    sim.world.get(lock, AirlockC)!.air = 600;
    const [a, b] = party as [number, number];
    setAirHolds(sim, shuttle, [{ crew: a, kind: 'airlock', id: lock, sec: 500 }]);
    sim.world.get(b, SuitC)!.air = 0;
    expect(drawAir(sim, b, { kind: 'airlock', id: lock })).toBe(100); // only what is not held for a
    sim.world.get(a, SuitC)!.air = 100;
    expect(drawAir(sim, a, { kind: 'airlock', id: lock })).toBe(500);
    expect(sim.world.has(shuttle, AirHoldsC)).toBe(false); // spent
    setAirHolds(sim, shuttle, [{ crew: a, kind: 'airlock', id: lock, sec: 100 }]);
    expect(awayLeaks(sim)).toEqual([`airHolds:${shuttle}`]); // the run is beside the site: the trip that set it is over
    play(sim, 1);
    expect(sim.world.has(shuttle, AirHoldsC)).toBe(false);
  });

  it('ownership: away-owned state whose owner is gone is released by the sweep, and the audit reports it until then', () => {
    const { sim, home } = landed();
    const [c] = crewOn(sim, home) as [number];
    sim.world.add(c, AwayC, { site: 999999, vehicle: 999998, cat: 'hauling', landing: true });
    sim.world.add(c, DraftedC, { target: null, away: true });
    expect(awayLeaks(sim)).toEqual(expect.arrayContaining([`away:${c}`, `drafted.away:${c}`]));
    play(sim, 1);
    expect(awayLeaks(sim)).toEqual([]);
    expect(sim.world.has(c, AwayC)).toBe(false);
    expect(sim.world.has(c, DraftedC)).toBe(false);
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
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('depart'); // the trip is due, held by the departure check
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

  describe('a jump with a party away (the cut)', () => {
    /** Jump the home ship to a neighbouring node and drop out there. */
    function jumpAway(sim: Sim): void {
      const ship = homeShip(sim);
      sim.world.get(ship, CombatC)!.ftl = FTL_CHARGE_SEC;
      giveItems(sim, 'item.fuel', 50);
      const node = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? []).map((e) => (e.a === START_NODE ? e.b : e.a)).sort()[0]!;
      sim.enqueue({ type: 'galaxy.jump', ship, route: [node] });
      play(sim, 1);
      for (let i = 0; i < 20000 && sim.sector.state === 'hyperspace' && (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story'); i++) {
        play(sim, 1);
        sim.story.active = null;
      }
      sim.enqueue({ type: 'galaxy.drop' });
      play(sim, 1);
      sim.galaxy.fleets = []; // no fleet waits at the node: this is about the cut
      sim.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
      play(sim, 20);
      expect(sim.sector.state).toBe('active');
    }

    /** No away component anywhere, live or archived, and the save loads. */
    function clean(sim: Sim): void {
      for (const store of ['away', 'siteRun', 'awaySite']) expect(sim.world.serialize().stores[store] ?? []).toEqual([]);
      for (const a of sim.archives) for (const e of a.entities) for (const store of ['away', 'siteRun', 'awaySite']) expect(e.c[store]).toBeUndefined();
      expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'passage')).toEqual([]);
      expect(() => deserialize(serialize(sim), content)).not.toThrow();
    }

    it('with the party on the site and the shuttle beside it: the run ends, the party stays behind as ordinary crew', () => {
      const { sim, wreck, shuttle, party } = landed();
      expect(party.length).toBeGreaterThan(0);
      jumpAway(sim);
      expect(sim.world.has(wreck, ShipC)).toBe(false); // left behind in the old node's archive
      expect(sim.world.has(shuttle, VehicleC)).toBe(false);
      clean(sim);
      const arch = sim.archives.find((a) => a.entities.some((e) => e.id === shuttle))!;
      expect(arch.entities.find((e) => e.id === shuttle)!.c.vehicle).toMatchObject({ autopilot: false });
    });

    it('with passengers aboard the shuttle at home: they step out and the run ends', () => {
      const { sim, wreck } = setup();
      siteWork(sim, wreck);
      const shuttle = shuttleOf(sim);
      sim.enqueue({ type: 'away.open', ship: wreck });
      play(sim, 20 * 120, () => sim.world.query(AboardC).length > 0);
      const aboard = [...sim.world.query(AboardC)];
      expect(aboard.length).toBeGreaterThan(0);
      jumpAway(sim);
      for (const c of aboard) expect(sim.world.has(c, PositionC)).toBe(true);
      expect(sim.world.get(shuttle, VehicleC)).toMatchObject({ autopilot: false });
      clean(sim);
    });
  });
});
