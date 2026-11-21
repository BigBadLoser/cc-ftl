import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, WeaponC, type Weapon } from '../sim/combat/components';
import { setTruce } from '../sim/blackmarket/truce';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import { atBattle, shipsHostile } from '../sim/combat/engage';
import { hostileAct } from '../sim/combat/provoke';
import { wreckShip } from '../sim/combat/wreck';
import { playerShipInfo } from '../sim/galaxy/arrivals';
import { canAid } from '../sim/galaxy/engagementAid';
import { settleEngagements } from '../sim/galaxy/engagementFlow';
import { engagedFleets, engagements } from '../sim/galaxy/engagements';
import { materialiseFleet } from '../sim/galaxy/fleetShips';
import { standing } from '../sim/galaxy/standing';
import { onTurn } from '../sim/galaxy/turn';
import { AID_STANDING, ENGAGE_MAX_SEC, ENGAGE_WAIT_SEC, JOIN_STANDING, JOIN_WIN_STANDING } from '../sim/galaxy/tuningWar';
import type { Fleet } from '../sim/galaxy/types';
import { newGame } from '../sim/newGame';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { eventsOf } from '../../test/support/sim';
import { run } from '../../test/support/run';
import { expectReplayable } from '../../test/support/world';
import { content } from '.';

/**
 * Fights between NPC fleets in the player's node (#603): fleets at war that meet here fight as real ships, the player may join a side, and allies come
 * to the player's aid. Meridian and Helix are at war and both neutral to a new player, so their fight is one the player only watches.
 */

/** A one-ship fleet of `faction` parked in the player's node (it goes nowhere), cloned from the start's first patrol. */
function fleetHere(sim: Sim, faction: string, role: Fleet['role'], id: number): Fleet {
  const proto = sim.galaxy.fleets.find((f) => f.role === 'patrol') as Fleet;
  const shipgen = (content.galaxy as { factions: Record<string, { ships: { value: string }[] }> }).factions[faction]?.ships[0]?.value as string;
  const node = sim.galaxy.current;
  const ship = { ...(proto.ships[0] as Fleet['ships'][number]), id: sim.galaxy.nextFleet++, faction, shipgen, seed: 1000 + id, size: 'small' as const, name: `${faction} ${role}` };
  delete ship.ship;
  return { ...proto, id, faction, role, ships: [ship], node, from: node, dest: node, route: [], dwell: 99999, legs: 0, moved: -1, synced: sim.galaxy.turn, cargo: [] };
}

/** A new game with two fleets in the player's node, made real. */
function fight(a: [string, Fleet['role']] = ['meridian', 'patrol'], b: [string, Fleet['role']] = ['helix', 'patrol']): { sim: Sim; fa: Fleet; fb: Fleet } {
  const sim = newGame(21, content);
  sim.story.goals.skipped = true; // no opening grace
  const fa = fleetHere(sim, a[0], a[1], 9001);
  const fb = fleetHere(sim, b[0], b[1], 9002);
  sim.galaxy.fleets = [fa, fb];
  materialiseFleet(sim, fa);
  materialiseFleet(sim, fb);
  return { sim, fa, fb };
}

const shipOf = (f: Fleet): number => f.ships[0]?.ship as number;
const weaponsOf = (sim: Sim, ship: number): Weapon[] =>
  sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === ship).map((id) => sim.world.get(id, WeaponC) as Weapon);

describe('fleets at war that meet in the player\'s node', () => {
  it('fight as real ships: the meeting is recorded, each aims at the other, both are at battle and foes; the player is not in combat', () => {
    const { sim, fa, fb } = fight();
    expect(shipOf(fa)).toBeGreaterThan(0);
    expect(shipOf(fb)).toBeGreaterThan(0);
    expect(shipsHostile(sim, shipOf(fa), shipOf(fb))).toBe(false);
    run(sim, 1);
    expect(engagements(sim)).toHaveLength(1);
    expect(sim.world.get(shipOf(fa), CombatC)?.prey).toBe(shipOf(fb));
    expect(sim.world.get(shipOf(fb), CombatC)?.prey).toBe(shipOf(fa));
    expect(shipsHostile(sim, shipOf(fa), shipOf(fb))).toBe(true);
    expect(atBattle(sim, shipOf(fa))).toBe(true);
    expect(sim.sector.inCombat).toBe(false);
    expect(engagedFleets(sim)).toEqual(new Set([fa.id, fb.id]));
    // Their guns go: within a minute both have fired at the other.
    const shots = eventsOf(run(sim, 60 * TICK_HZ), 'weapon.fired');
    expect(shots.some((s) => s.ship === shipOf(fa) && s.targetShip === shipOf(fb))).toBe(true);
    expect(shots.some((s) => s.ship === shipOf(fb) && s.targetShip === shipOf(fa))).toBe(true);
  });

  it('end when a side is out: the winner holds the field, the news says so, the loser is reaped and owed, the aims are dropped', () => {
    const { sim, fa, fb } = fight();
    run(sim, 1);
    const lost = shipOf(fb);
    wreckShip(sim, lost);
    const ended = eventsOf(run(sim, 1), 'engagement.ended');
    expect(ended).toMatchObject([{ winner: 0, stats: false, who: fa.ships[0]?.name, foe: fb.ships[0]?.name }]);
    expect(engagements(sim)).toHaveLength(0);
    expect(sim.galaxy.news.some((n) => n.kind === 'destroyed' && n.who === fa.ships[0]?.name)).toBe(true);
    expect(sim.world.get(shipOf(fa), CombatC)?.prey).toBeUndefined();
    run(sim, TICK_HZ);
    expect(sim.galaxy.fleets.map((f) => f.id)).toEqual([fa.id]);
    expect(sim.galaxy.ports[fb.home]?.queue).toEqual([{ faction: 'helix', role: 'patrol', size: 'small' }]);
  });

  it('do not start where a black market truce holds (#609 review)', () => {
    const { sim } = fight();
    setTruce(sim, sim.galaxy.current);
    run(sim, 2 * TICK_HZ);
    expect(engagements(sim)).toHaveLength(0);
  });

  it('a draw drops the aims the fight set, though the node stays in combat (#609 review)', () => {
    const { sim, fa, fb } = fight();
    run(sim, 10 * TICK_HZ);
    const [a, b] = [shipOf(fa), shipOf(fb)];
    expect(sim.world.get(a, CombatC)?.target?.ship).toBe(b);
    sim.sector.inCombat = true;
    (sim.sector.engagements?.[0] as { since: number }).since -= ENGAGE_MAX_SEC * TICK_HZ;
    run(sim, 1);
    expect(engagements(sim)).toHaveLength(0);
    const aims = (ship: number) => [sim.world.get(ship, CombatC)?.target?.ship, ...weaponsOf(sim, ship).flatMap((w) => [w.target?.ship, w.commit?.target.ship])];
    expect(aims(a)).not.toContain(b);
    expect(aims(b)).not.toContain(a);
  });

  it('a fight that runs out of time is a draw; a side that never turns up, or a fight the player leaves, is settled by the stats fight', () => {
    const timed = fight();
    run(timed.sim, 1);
    (timed.sim.sector.engagements?.[0] as { since: number }).since -= ENGAGE_MAX_SEC * TICK_HZ;
    expect(eventsOf(run(timed.sim, 1), 'engagement.ended')).toMatchObject([{ winner: null, stats: false }]);
    expect(timed.sim.galaxy.news.some((n) => n.kind === 'clash')).toBe(true);

    // The other side's hull cannot be made: it never turns up, so the stats fight settles it once the wait is over.
    const sim = newGame(21, content);
    sim.story.goals.skipped = true;
    const fa = fleetHere(sim, 'meridian', 'patrol', 9001);
    const fb = fleetHere(sim, 'helix', 'patrol', 9002);
    (fb.ships[0] as { shipgen: string }).shipgen = 'faction.none';
    sim.galaxy.fleets = [fa, fb];
    materialiseFleet(sim, fa);
    run(sim, 1);
    expect(engagements(sim)).toHaveLength(1);
    const out = eventsOf(run(sim, ENGAGE_WAIT_SEC * TICK_HZ), 'engagement.ended');
    expect(out).toMatchObject([{ stats: true }]);
    expect(engagements(sim)).toHaveLength(0);

    const left = fight();
    run(left.sim, 1);
    settleEngagements(left.sim);
    expect(left.sim.sector.engagements).toBeUndefined();
    expect(left.fa.ships.every((c) => c.ship === undefined)).toBe(true); // lifted out, the stats fight decided the rest
  });

  it('hold their fleets in place while they fight (two neutrals: no fight of the player\'s holds them)', () => {
    const { sim, fa, fb } = fight();
    run(sim, 1);
    for (const f of [fa, fb]) Object.assign(f, { dwell: 0, legs: 1 });
    onTurn(sim, ++sim.galaxy.turn);
    expect([fa.node, fb.node]).toEqual([sim.galaxy.current, sim.galaxy.current]);
    expect(engagements(sim)).toHaveLength(1);
  });

  it('play the same on a replay and across a save', () => {
    expectReplayable(() => fight().sim, 120, { saveAt: 60 });
  });
});

describe('joining a side', () => {
  it('firing on one side joins the other: +JOIN_STANDING with its faction, and JOIN_WIN_STANDING more when it wins; once', () => {
    const { sim, fa, fb } = fight();
    run(sim, 1);
    const before = standing(sim, 'meridian');
    hostileAct(sim, shipOf(fb), 'fired');
    hostileAct(sim, shipOf(fb), 'fired');
    expect(engagements(sim)[0]).toMatchObject({ joined: 0, struck: [1] });
    wreckShip(sim, shipOf(fb));
    const [end] = eventsOf(run(sim, 1), 'engagement.ended');
    expect(end).toMatchObject({ joined: 0, standing: JOIN_STANDING + JOIN_WIN_STANDING, faction: 'meridian' });
    expect(standing(sim, 'meridian')).toBeCloseTo(before + JOIN_STANDING + JOIN_WIN_STANDING, 5);
    expect(sim.galaxy.news.some((n) => n.kind === 'joined' && n.faction === 'meridian')).toBe(true);
    expect(fa.ships.length).toBe(1);
  });

  it('a side that loses still pays JOIN_STANDING; shooting both sides earns nothing', () => {
    const lost = fight();
    run(lost.sim, 1);
    const before = standing(lost.sim, 'helix');
    hostileAct(lost.sim, shipOf(lost.fa), 'fired');
    wreckShip(lost.sim, shipOf(lost.fb));
    run(lost.sim, 1);
    expect(standing(lost.sim, 'helix')).toBeCloseTo(before + JOIN_STANDING, 5);

    const both = fight();
    run(both.sim, 1);
    const m = standing(both.sim, 'meridian');
    const h = standing(both.sim, 'helix');
    hostileAct(both.sim, shipOf(both.fa), 'fired');
    hostileAct(both.sim, shipOf(both.fb), 'fired');
    wreckShip(both.sim, shipOf(both.fb));
    const [end] = eventsOf(run(both.sim, 1), 'engagement.ended');
    expect(end?.standing).toBeUndefined();
    expect([standing(both.sim, 'meridian'), standing(both.sim, 'helix')]).toEqual([m, h]);
  });
});

describe('allies come to the player\'s aid', () => {
  /** A navy patrol and a mercenary ship in the node (not at war with each other); the mercenaries turned hostile to the player, who is fired on. */
  function attacked(navyRep: number): { sim: Sim; navy: number; merc: number } {
    const sim = newGame(21, content);
    sim.story.goals.skipped = true;
    sim.story.reputation['navy'] = navyRep;
    sim.story.reputation['mercenaries'] = -10;
    const fn = fleetHere(sim, 'navy', 'patrol', 9001);
    const fm = fleetHere(sim, 'mercenaries', 'patrol', 9002);
    sim.galaxy.fleets = [fn, fm];
    materialiseFleet(sim, fn);
    materialiseFleet(sim, fm);
    const me = playerShipInfo(sim)?.id as number;
    const merc = shipOf(fm);
    run(sim, 1);
    (sim.world.get(me, CombatC) as { threat?: { ship: number; at: number } }).threat = { ship: merc, at: sim.tick };
    return { sim, navy: shipOf(fn), merc };
  }

  it('a ship of a faction at AID_STANDING or better takes on the attacker; one below it does not', () => {
    const friend = attacked(AID_STANDING);
    expect(sim0Hostile(friend.sim, friend.merc)).toBe(true);
    const started = eventsOf(run(friend.sim, TICK_HZ), 'engagement.started');
    expect(started).toMatchObject([{ kind: 'aid', foe: friend.sim.world.get(friend.merc, ShipC)?.name }]);
    expect(friend.sim.world.get(friend.navy, CombatC)?.prey).toBe(friend.merc);
    expect(shipsHostile(friend.sim, friend.navy, friend.merc)).toBe(true);

    const cold = attacked(0);
    expect(eventsOf(run(cold.sim, TICK_HZ), 'engagement.started')).toHaveLength(0);
  });

  it('armed stations count; a faction never aids against itself', () => {
    const { sim, navy } = attacked(AID_STANDING);
    (sim.world.get(navy, ShipC) as { immobile?: true }).immobile = true;
    expect(canAid(sim, navy, 'mercenaries')).toBe(true);
    expect(canAid(sim, navy, 'navy')).toBe(false);
  });
});

const sim0Hostile = (sim: Sim, ship: number): boolean => sim.world.get(ship, ShipC)?.faction === 'hostile';
