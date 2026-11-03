import { describe, expect, it } from 'vitest';
import { AboardC, AssignmentC, CrewC, DraftedC, EquipC, FighterC, HealthC, StunC, FerryC, JobC, ModuleC, PositionC, VehicleC, ferryFree } from '../../sim';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { passagesOf } from '../../sim/away/passage';
import { destroyVehicle } from '../../sim/vehicles/lifecycle';
import { launchOf, orderLaunch } from '../../sim/boarding/launch';
import { pickPilot } from '../../sim/mining/pilot';
import { playerCourier } from '../../sim/trade/courier';
import { shipIdOf } from '../../sim/regions';
import { airlockOf, crewOn, nth, of, raiderCrew, run, setup, shuttleOf } from './boardingFixture';

const heldPassage = (sim: ReturnType<typeof setup>, c: number): boolean => sim.world.get(sim.world.get(c, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'passage';

/** A boarding is an away site on the enemy ship (#287): the launch opens it with the player's pick as its named party. */
describe('boarding.launch', () => {
  it('embarks the party, docks at the enemy airlock and lands all of them on the enemy ship, standing by for orders', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    const onEnemy = (c: number) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 2);
    const events = run(sim, 3000, () => party.every(onEnemy));
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(of(events, 'command.rejected')).toEqual([]);
    expect(of(events, 'away.opened')).toMatchObject([{ ship: nth(sim, 2), vehicle: shuttle }]);
    expect(party.every(onEnemy)).toBe(true);
    for (const c of party) expect(sim.world.get(c, DraftedC)?.target ?? null).toBeNull(); // drafted: boarders wait for orders
    expect(v.state).toBe('docked');
    expect(v.dock).toBe(airlockOf(sim, 2));
    expect(v.pilot).toBe(0);
    expect(v.passengers).toEqual([]);
    // Waiting at the enemy for the party: no cargo run or trade takes it away meanwhile.
    expect(ferryFree(sim, shuttle)).toBe(false);
    expect((playerCourier(sim) as { vehicle?: number }).vehicle).not.toBe(shuttle);
  });

  it('the landed party can be recalled: the shuttle brings them home and the site closes', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 3000, () => sim.world.get(shuttle, VehicleC)!.state === 'docked' && party.every((c) => !sim.world.has(c, AboardC)));
    run(sim, 5);
    sim.enqueue({ type: 'crew.recall', ids: party });
    const events = run(sim, 4000, () => !sim.world.has(shuttle, SiteRunC) && party.every((c) => sim.world.has(c, PositionC)));
    expect(of(events, 'crew.recallFailed')).toEqual([]);
    expect(of(events, 'away.closed')).toMatchObject([{ ship: nth(sim, 2), vehicle: shuttle, reason: 'closed' }]);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    for (const c of party) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(nth(sim, 1));
      expect(sim.world.has(c, AwayC)).toBe(false);
      expect(sim.world.has(c, DraftedC)).toBe(false); // home again: back to their duties
    }
  });

  it('docks at another airlock or hovers when the target airlock is lost on the approach: the party still lands', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    const lock = airlockOf(sim, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: lock });
    run(sim, 3000, () => sim.world.get(shuttle, SiteRunC)?.phase === 'fly');
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('fly');
    sim.world.get(lock, ModuleC)!.hp = 0; // shot out before the shuttle latches on
    const landed = (c: number) => sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 2);
    run(sim, 6000, () => party.every(landed));
    expect(party.every(landed)).toBe(true);
    expect(sim.world.get(shuttle, VehicleC)!.dock).not.toBe(lock);
  });

  it('a party that never comes is given up: those not aboard stay home, the site closes, nothing is left held', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 3);
    expect(passagesOf(sim, shuttle)).toHaveLength(2); // a seat held for each of them
    sim.world.get(shuttle, SiteRunC)!.timer = 10_000; // their walk to the bay has stalled
    const events = run(sim, 60, () => !sim.world.has(shuttle, SiteRunC));
    expect(of(events, 'away.leftBehind').flatMap((e) => e.crew).sort()).toEqual([...party].sort());
    expect(sim.world.has(shuttle, SiteRunC)).toBe(false);
    expect(sim.world.has(nth(sim, 2), AwaySiteC)).toBe(false);
    for (const c of party) {
      expect(heldPassage(sim, c)).toBe(false);
      expect(sim.world.has(c, DraftedC)).toBe(false);
    }
    expect(sim.world.get(shuttle, VehicleC)).toMatchObject({ pilot: 0, passengers: [] });
  });

  it('a passenger too slow to reach the shuttle stays home: walk stopped, back to work, and the player hears of it', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 3000, () => party.some((c) => sim.world.has(c, AboardC)));
    const late = party.filter((c) => !sim.world.has(c, AboardC));
    expect(late.length).toBeGreaterThan(0); // the rest have not got there yet
    sim.world.get(shuttle, SiteRunC)!.boardedAt = sim.tick - 10_000; // the wait for them is over
    const events = run(sim, 3, () => sim.world.get(shuttle, SiteRunC)?.phase === 'fly');
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('fly');
    expect(of(events, 'away.leftBehind').flatMap((e) => e.crew).sort()).toEqual([...late].sort());
    for (const c of late) {
      expect(heldPassage(sim, c)).toBe(false);
      expect(sim.world.has(c, DraftedC)).toBe(false);
      expect(sim.world.has(c, AwayC)).toBe(false);
    }
  });

  it('the picked party is held for the launch: drafted while they walk, an emergency at home does not take them off it', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const home = crewOn(sim, 1);
    const party = home.slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    for (const c of party) {
      expect(sim.world.get(c, DraftedC)).toMatchObject({ target: null, away: true }); // the launch's hold, not the player's draft
      expect(heldPassage(sim, c)).toBe(true);
    }
    // A fire breaks out at home, by the crew who stay, and the party is hungry: neither calls them off.
    const stay = sim.world.get(home[home.length - 1]!, PositionC)!;
    sim.enqueue({ type: 'debug.ignite', ship: nth(sim, 1), x: Math.round(stay.x), y: Math.round(stay.y) });
    for (const c of party) sim.enqueue({ type: 'debug.setCrew', id: c, hunger: 5 });
    const onEnemy = (c: number) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 2);
    const events = run(sim, 3000, () => party.every(onEnemy));
    expect(of(events, 'away.leftBehind')).toEqual([]);
    expect(party.every(onEnemy)).toBe(true);
    for (const c of party) expect(sim.world.get(c, DraftedC)?.away).toBeUndefined(); // landed: standing by on the player's draft
  });

  it('an armed pick who meets a hostile on the way to the shuttle keeps walking to their seat: the fight does not take them off it', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    const c = party[0]!;
    sim.world.add(c, EquipC, { weapon: 'item.rifle' }); // armed: it would engage
    const at = sim.world.get(c, PositionC)!;
    const raider = raiderCrew(sim)[0]!; // an intruder wakes up beside them, aboard the home ship
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    for (const id of [...party, raider]) sim.world.get(id, HealthC)!.max = sim.world.get(id, HealthC)!.hp = 100000;
    const events = run(sim, 3000, () => party.every((p) => sim.world.has(p, AwayC)));
    expect(of(events, 'away.leftBehind')).toEqual([]);
    for (const p of party) expect(sim.world.has(p, AwayC)).toBe(true); // aboard: of the party
  });

  it('a pick with an earlier attack order of the player\'s drops it for the launch: the stale order does not keep them from their seat', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    const c = party[0]!;
    sim.world.add(c, EquipC, { weapon: 'item.rifle' });
    const at = sim.world.get(c, PositionC)!;
    const raider = raiderCrew(sim)[0]!; // an intruder beside them, aboard the home ship
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    for (const id of [...party, raider]) sim.world.get(id, HealthC)!.max = sim.world.get(id, HealthC)!.hp = 100000;
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    run(sim, 1);
    sim.enqueue({ type: 'crew.attack', id: c, target: raider });
    run(sim, 2);
    expect(sim.world.get(c, FighterC)?.ordered).toBe(raider);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    expect(sim.world.get(c, FighterC)?.ordered).toBe(0);
    const events = run(sim, 3000, () => party.every((p) => sim.world.has(p, AwayC)));
    expect(of(events, 'away.leftBehind')).toEqual([]);
    for (const p of party) expect(sim.world.has(p, AwayC)).toBe(true);
  });

  it('a sleeping crew member picked for the party wakes up and goes', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    const sleeper = party[1]!;
    sim.enqueue({ type: 'debug.setCrew', id: sleeper, rest: 0 });
    run(sim, 2000, () => sim.world.get(sleeper, CrewC)!.activity === 'sleeping');
    expect(sim.world.get(sleeper, CrewC)!.activity).toBe('sleeping');
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    const onEnemy = (c: number) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 2);
    const events = run(sim, 3000, () => party.every(onEnemy));
    expect(of(events, 'away.leftBehind')).toEqual([]);
    expect(party.every(onEnemy)).toBe(true);
  });

  it('a picked crew member the player orders elsewhere before take-off stays home, on the player\'s draft, and the player hears of it', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    const [gone, kept] = party as [number, number];
    const at = sim.world.get(gone, PositionC)!;
    sim.enqueue({ type: 'crew.moveTo', id: gone, x: Math.round(at.x), y: Math.round(at.y) });
    const events = run(sim, 3);
    expect(of(events, 'away.leftBehind')).toMatchObject([{ vehicle: shuttle, crew: [gone] }]);
    expect(heldPassage(sim, gone)).toBe(false);
    expect(sim.world.get(gone, DraftedC)).toBeDefined();
    expect(sim.world.get(gone, DraftedC)?.away).toBeUndefined(); // the player's draft now
    expect(heldPassage(sim, kept)).toBe(true);
    expect(sim.world.get(nth(sim, 2), AwaySiteC)?.invited).toEqual([kept]);
  });

  it('a party whose shuttle is destroyed before take-off is let go: no one stays drafted or walking', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 3);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    for (const c of party) expect(sim.world.has(c, AssignmentC)).toBe(true); // each holds their seat
    destroyVehicle(sim, shuttle); // e.g. its bay blown up: the site's run goes with it
    run(sim, 3);
    for (const c of party) {
      expect(sim.world.has(c, DraftedC)).toBe(false);
      expect(heldPassage(sim, c)).toBe(false); // free for any other work
      expect(launchOf(sim, c)).toBe(0);
    }
    expect(sim.world.has(nth(sim, 2), AwaySiteC)).toBe(false);
  });

  it('a shuttle has one owner: a launching shuttle is not free for cargo runs or trade, and a ferrying one cannot launch', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    expect((playerCourier(sim) as { vehicle?: number }).vehicle).toBe(shuttle); // free before the launch
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    expect(sim.world.has(shuttle, SiteRunC)).toBe(true);
    expect(ferryFree(sim, shuttle)).toBe(false);
    expect((playerCourier(sim) as { vehicle?: number }).vehicle).not.toBe(shuttle);

    const other = setup();
    const s2 = shuttleOf(other, 1);
    other.world.add(s2, FerryC, { phase: 'load' } as never); // only its presence matters here; no tick runs
    expect(orderLaunch(other, s2, crewOn(other, 1).slice(0, 1), airlockOf(other, 2))).toBe('shuttleBusy');
  });

  it('the whole party is reserved once a launch is accepted: no crew member can be picked for a second launch', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const party = crewOn(sim, 1).slice(0, 2);
    sim.enqueue({ type: 'boarding.launch', vehicle: shuttle, crew: party, airlock: airlockOf(sim, 2) });
    run(sim, 2);
    // The passenger (not aboard yet) is already taken: a second launch naming them is refused.
    expect(orderLaunch(sim, shuttle, [party[1] as number], airlockOf(sim, 2))).not.toBeNull();
    expect(launchOf(sim, party[1] as number)).toBe(shuttle);
    // Held for the launch: automated pilot selection (mining pods, cargo runs) skips them.
    expect(pickPilot(sim, sim.world.get(shuttle, VehicleC)!, new Set([party[0] as number]))).not.toBe(party[1]);
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
