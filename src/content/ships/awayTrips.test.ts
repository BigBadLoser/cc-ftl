import { describe, expect, it } from 'vitest';
import { AboardC, CarriedC, CrewC, DownedC, DraftedC, HealthC, NeedsC, PositionC, VehicleC, createCrew, destroyVehicle, type Sim } from '../../sim';
import { EvaFloatC } from '../../sim/eva/components';
import { AwayC, SiteRunC } from '../../sim/away/components';
import { unsafeMembers } from '../../sim/away/depart';
import { SuitC } from '../../sim/eva/components';
import { outsideCrew } from '../../sim/eva/shuttle';
import { shipIdOf } from '../../sim/regions';
import { AWAY_LAST_CALL_SEC, AWAY_TRIP_WAIT_SEC } from '../../sim/tuning';
import { boardCrew, occupants, vehicleDefOf } from '../../sim/vehicles/lifecycle';
import { content } from '../index';
import { crewOn, landed, play, siteWork } from './awayFixture';
import { shuttleOf } from './ferryFixture';
import { of, setup } from './salvageEvaFixture';

/** Hold every crew member at home (drafted): nobody there would take a seat, so no rotation trip falls due on their account. */
function holdHome(sim: Sim, home: number): void {
  for (const c of crewOn(sim, home)) sim.world.add(c, DraftedC, { target: null });
}

const aboard = (sim: Sim, c: number): boolean => sim.world.has(c, AboardC) || !sim.world.has(c, PositionC);
const phase = (sim: Sim, shuttle: number): string | undefined => sim.world.get(shuttle, SiteRunC)?.phase;

describe('away sites: batched round trips (#286 slice 2b)', () => {
  it('a passenger due home waits aboard for a batch trigger; the trip timeout sends it', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    const [hungry] = party as [number];
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 34, rest: 100 });
    play(sim, 20 * 120, () => aboard(sim, hungry));
    expect(sim.world.get(hungry, AwayC)?.home).toBe(true);
    // Not urgent, the hold empty, one of four seats waiting, nobody at home to fetch: it waits.
    expect(of(play(sim, 20 * 30), 'away.departed')).toEqual([]);
    expect(phase(sim, shuttle)).toBe('stay');
    sim.world.get(shuttle, SiteRunC)!.lastTrip = sim.tick - 20 * AWAY_TRIP_WAIT_SEC;
    const all = play(sim, 20 * 30, (a) => of(a, 'away.departed').length > 0);
    expect(of(all, 'away.departed')).toMatchObject([{ vehicle: shuttle, crew: [hungry], home: true }]);
  });

  it('an urgent passenger (at the end of a need) leaves at once', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    const [hungry] = party as [number];
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 34, rest: 100 });
    play(sim, 20 * 120, () => aboard(sim, hungry));
    sim.world.get(hungry, NeedsC)!.hunger = 5; // below AWAY_URGENT_HUNGER while waiting
    const all = play(sim, 20 * 10, (a) => of(a, 'away.departed').length > 0);
    expect(of(all, 'away.departed')).toMatchObject([{ vehicle: shuttle, home: true }]);
  });

  it('the last call refills a worker short of air before the trip leaves', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    const [hungry, low] = party as [number, number];
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 5, rest: 100 });
    play(sim, 20 * 120, () => phase(sim, shuttle) === 'depart');
    sim.world.get(low, SuitC)!.air = 100; // less than a round trip with margin
    expect(unsafeMembers(sim, shuttle)).toContain(low);
    play(sim, 2);
    expect(sim.world.get(low, AwayC)?.lastCall).toBe(true);
    const all = play(sim, 20 * AWAY_LAST_CALL_SEC, (a) => of(a, 'away.departed').length > 0);
    expect(of(all, 'away.departed')).toHaveLength(1);
    expect(sim.world.get(low, SuitC)!.air).toBeGreaterThan(500); // refilled
    expect(aboard(sim, low)).toBe(false); // works on
    expect(sim.world.get(low, AwayC)?.lastCall).toBeUndefined();
  });

  it('workers still short after the last call ride the round trip out aboard and go back out', () => {
    // A small tank (120 s): no refill covers a round trip with margin (about 130 s here), so everyone staying out must ride.
    const { sim, home, shuttle, party } = landed(3, { ...content, suit: { ...content.suit!, airSec: 120 } });
    holdHome(sim, home);
    const [hungry, ...rest] = party as [number, ...number[]];
    for (const c of rest) Object.assign(sim.world.get(c, NeedsC)!, { hunger: 100, rest: 100 });
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 5, rest: 100 });
    const all = play(sim, 20 * 300, (a) => of(a, 'away.departed').some((e) => e.home));
    expect(of(all, 'away.departed').find((e) => e.home)?.crew.sort()).toEqual([...party].sort());
    for (const c of rest) expect(sim.world.get(c, AwayC)).toMatchObject({ ride: true });
    // Home: the hungry passenger steps out, the riders stay aboard; back at the site they go out again.
    const back = play(sim, 20 * 400, (a) => of(a, 'away.returned').length > 0);
    expect(of(back, 'away.returned')[0]?.crew).toEqual([hungry]);
    for (const c of rest) expect(aboard(sim, c)).toBe(true);
    play(sim, 20 * 400, () => rest.every((c) => !aboard(sim, c) && !sim.world.get(c, AwayC)?.landing));
    for (const c of rest) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(sim.world.get(shuttle, SiteRunC)!.site);
      expect(sim.world.get(c, AwayC)?.ride).toBeUndefined();
    }
  });

  it('the watch: the trip turns back when a worker left out would run short before it is back', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    const [hungry] = party as [number];
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 5, rest: 100 });
    play(sim, 20 * 200, () => phase(sim, shuttle) === 'home');
    const r = sim.world.get(shuttle, SiteRunC)!;
    expect(r.returnBy).toBeGreaterThan(sim.tick); // set on launch from the workers counting on their own tanks
    r.returnBy = sim.tick + 20; // as if a slow trip ate the margin
    play(sim, 1);
    expect(phase(sim, shuttle)).toBe('fly');
  });

  it('the watch: a worker downed while the shuttle is away brings it straight back', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    const [hungry, hurt] = party as [number, number];
    Object.assign(sim.world.get(hungry, NeedsC)!, { hunger: 5, rest: 100 });
    play(sim, 20 * 200, () => phase(sim, shuttle) === 'home');
    sim.world.get(hurt, HealthC)!.hp = 0;
    play(sim, 1);
    expect(phase(sim, shuttle)).toBe('fly');
  });

  it('a downed party member is carried to the shuttle, handed in, and the trip home leaves at once', () => {
    const { sim, home, party } = landed();
    holdHome(sim, home);
    const [hurt] = party as [number];
    sim.world.get(hurt, HealthC)!.hp = 0;
    let carried = false;
    const all = play(sim, 20 * 300, (a) => {
      carried ||= sim.world.has(hurt, CarriedC);
      return of(a, 'away.departed').some((e) => e.home);
    });
    expect(carried).toBe(true); // a rescue, not a lift
    expect(of(all, 'crew.rescued').map((e) => e.crew)).toContain(hurt);
    expect(of(all, 'away.departed').find((e) => e.home)?.crew).toContain(hurt);
    expect(sim.world.has(hurt, DownedC)).toBe(true);
  });

  it('no home leg while a passenger is on the way out: a queued eva.out lands first (Codex 4448955314)', () => {
    const { sim, home, shuttle, party } = landed();
    const [low] = party as [number];
    // A replacement aboard, just arrived (not sent out yet), and a downed passenger aboard: an urgent trip is due at once.
    const fresh = crewOn(sim, home).find((c) => !sim.world.has(c, AwayC))!;
    const site = sim.world.get(shuttle, SiteRunC)!.site;
    sim.world.remove(fresh, DraftedC);
    boardCrew(sim, fresh, shuttle);
    sim.world.add(fresh, AwayC, { site, vehicle: shuttle, cat: 'construction' });
    sim.world.get(low, HealthC)!.hp = 0;
    let homeWithTie = false;
    const all = play(sim, 20 * 300, (a) => {
      if (phase(sim, shuttle) === 'home' && outsideCrew(sim, shuttle).length > 0) homeWithTie = true;
      return of(a, 'away.returned').length > 0;
    });
    expect(homeWithTie).toBe(false);
    expect(of(all, 'away.returned')).toHaveLength(1); // the trip got home
    expect(shipIdOf(sim, sim.world.get(fresh, PositionC)!)).toBe(site); // the replacement is out working
    expect(sim.world.get(fresh, SuitC)?.vehicle).toBeUndefined();
    expect(sim.world.get(fresh, CrewC)?.activity).not.toBe('drafted');
  });
});

describe('away sites: holds for floats never leak (Codex 4449454958, 4449454964)', () => {
  const held = (sim: Sim): number[] => sim.world.query(DraftedC, PositionC).filter((c) => sim.world.get(c, DraftedC)?.away && !sim.world.has(c, EvaFloatC));

  it('two workers coming back to one free seat: only one floats in, the other is never left held', () => {
    const { sim, home, shuttle, party } = landed();
    holdHome(sim, home);
    // All seats but one taken by passengers who stay aboard.
    const at = sim.world.get(crewOn(sim, home)[0]!, PositionC)!;
    const v = sim.world.get(shuttle, VehicleC)!;
    while (occupants(v).length < (vehicleDefOf(sim, v)?.capacity ?? 0)) boardCrew(sim, createCrew(sim, home, 'role.engineer', { x: at.x, y: at.y }, { faction: 'player', rest: 100 }), shuttle);
    const [a, b] = party as [number, number];
    for (const c of [a, b]) Object.assign(sim.world.get(c, NeedsC)!, { rest: 22, hunger: 100 });
    let most = 0;
    let boarded = 0;
    for (let i = 0; i < 20 * 120; i++) {
      play(sim, 1);
      for (const c of [a, b]) if (sim.world.has(c, AboardC)) boarded |= c === a ? 1 : 2;
      most = Math.max(most, sim.world.query(EvaFloatC).filter((c) => sim.world.get(c, EvaFloatC)?.mode === 'back').length);
      expect(held(sim)).toEqual([]);
    }
    expect(most).toBe(1); // inbound floats count against the free seat
    expect(boarded).toBeGreaterThan(0); // and someone did come aboard
  });

  it('the shuttle lost while passengers float out: nobody stays held', () => {
    const { sim, wreck } = (() => {
      const { sim, wreck } = setup();
      siteWork(sim, wreck, 3);
      sim.enqueue({ type: 'away.open', ship: wreck });
      return { sim, wreck };
    })();
    const shuttle = shuttleOf(sim);
    play(sim, 20 * 300, () => sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.mode === 'out'));
    const out = sim.world.query(EvaFloatC).filter((c) => sim.world.get(c, EvaFloatC)?.mode === 'out');
    expect(out.length).toBeGreaterThan(0);
    destroyVehicle(sim, shuttle);
    play(sim, 20 * 20);
    for (const c of out) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(wreck);
      expect(sim.world.has(c, DraftedC)).toBe(false);
      expect(sim.world.get(c, CrewC)?.activity).not.toBe('drafted');
    }
    expect(held(sim)).toEqual([]);
  });

  it('a draft the player takes over during the float stays after landing (Codex 4449530810)', () => {
    const { sim, wreck } = setup();
    siteWork(sim, wreck, 3);
    sim.enqueue({ type: 'away.open', ship: wreck });
    play(sim, 20 * 300, () => sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.mode === 'out'));
    const c = sim.world.query(EvaFloatC).find((c) => sim.world.get(c, EvaFloatC)?.mode === 'out')!;
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    play(sim, 1);
    expect(sim.world.get(c, DraftedC)?.away).toBeUndefined(); // the player's draft now
    play(sim, 20 * 20);
    expect(sim.world.has(c, EvaFloatC)).toBe(false);
    expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(wreck);
    expect(sim.world.has(c, DraftedC)).toBe(true);
  });
});
