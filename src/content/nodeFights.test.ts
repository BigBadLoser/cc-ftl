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
import { controlOf } from '../sim/galaxy/control';
import { settleEngagements } from '../sim/galaxy/engagementFlow';
import { takeShip } from '../sim/galaxy/engagementPrize';
import { nodeOf } from '../sim/galaxy/state';
import { engagedFleets, engagements } from '../sim/galaxy/engagements';
import { materialiseFleet } from '../sim/galaxy/fleetShips';
import { standing } from '../sim/galaxy/standing';
import { onTurn } from '../sim/galaxy/turn';
import { AID_STANDING, ENGAGE_STALE_SEC, ENGAGE_WAIT_SEC, JOIN_STANDING, JOIN_WIN_STANDING } from '../sim/galaxy/tuningWar';
import { newGame } from '../sim/newGame';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { FLEE_BELOW, FTL_CHARGE_SEC } from '../sim/tuning';
import { eventsOf } from '../../test/support/sim';
import { run } from '../../test/support/run';
import { fight, fleetHere, shipOf } from '../../test/support/content';
import { expectReplayable } from '../../test/support/world';
import { content } from '.';

/**
 * Fights between NPC fleets in the player's node (#603): fleets at war that meet here fight as real ships, the player may join a side, and allies come
 * to the player's aid. Meridian and Helix are at war and both neutral to a new player, so their fight is one the player only watches.
 */

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

  it.each(['wreck', 'take'] as const)('move the border they are fought on (#604): a ship %s adds pressure on the loser\'s sector for the winner', (how) => {
    const { sim, fa, fb } = fight();
    run(sim, 1);
    const sector = nodeOf(sim, sim.galaxy.current)?.sector as string;
    controlOf(sim, sector).owner = 'helix';
    expect(sim.galaxy.control[sector]?.pressure).toBeUndefined();
    if (how === 'wreck') wreckShip(sim, shipOf(fb));
    else takeShip(sim, shipOf(fb), shipOf(fa));
    run(sim, 2);
    expect(engagements(sim)).toHaveLength(0);
    expect(sim.galaxy.control[sector]?.pressure).toMatchObject({ by: 'meridian' });
    expect(sim.galaxy.control[sector]?.pressure?.value ?? 0).toBeGreaterThan(0);
  });

  it('do not start where a black market truce holds (#609 review)', () => {
    const { sim } = fight();
    setTruce(sim, sim.galaxy.current);
    run(sim, 2 * TICK_HZ);
    expect(engagements(sim)).toHaveLength(0);
  });

  it('end when a badly hurt ship jumps away: its fleet goes with it, the other side wins, the aims are dropped, and they do not meet again', () => {
    const { sim, fa, fb } = fight();
    run(sim, 10 * TICK_HZ);
    const [a, b] = [shipOf(fa), shipOf(fb)];
    expect(sim.world.get(a, CombatC)?.target?.ship).toBe(b);
    sim.sector.inCombat = true; // the node stays in combat: the aims still go (#609 review)
    Object.assign(sim.world.get(b, ShipC) as object, { integrity: FLEE_BELOW / 2 });
    (sim.world.get(b, CombatC) as { ftl: number }).ftl = FTL_CHARGE_SEC;
    const ended = eventsOf(run(sim, 2 * TICK_HZ), 'engagement.ended');
    expect(ended).toMatchObject([{ winner: 0, stats: false }]);
    expect(fb.node).not.toBe(sim.galaxy.current);
    expect(sim.galaxy.news.some((n) => n.kind === 'driven' && n.who === fa.ships[0]?.name)).toBe(true);
    expect(sim.galaxy.news.some((n) => n.kind === 'clash')).toBe(false);
    const aims = [sim.world.get(a, CombatC)?.target?.ship, ...weaponsOf(sim, a).flatMap((w) => [w.target?.ship, w.commit?.target.ship])];
    expect(aims).not.toContain(b);
    sim.sector.inCombat = false;
    expect(eventsOf(run(sim, 5 * TICK_HZ), 'engagement.started')).toEqual([]);
  });

  it('have no time limit: a stalemate (no damage for ENGAGE_STALE_SEC) sends the weaker side away; on a tie the side that did not start it', () => {
    const tie = fight();
    run(tie.sim, 1);
    const e = engagements(tie.sim)[0] as { calm?: number };
    run(tie.sim, 5 * TICK_HZ);
    e.calm = tie.sim.tick - ENGAGE_STALE_SEC * TICK_HZ;
    for (const f of [tie.fa, tie.fb]) (tie.sim.world.get(shipOf(f), CombatC) as { ftl: number }).ftl = FTL_CHARGE_SEC;
    expect(eventsOf(run(tie.sim, 2 * TICK_HZ), 'engagement.ended')).toMatchObject([{ winner: 0, stats: false }]);
    expect(tie.fb.node).not.toBe(tie.sim.galaxy.current);
    expect(tie.fa.node).toBe(tie.sim.galaxy.current);

    // Side 0 worse off: it is the one that goes, though it started the fight.
    const weak = fight();
    run(weak.sim, 1);
    const a = shipOf(weak.fa);
    const hit = weak.sim.world.query(ModuleC).find((id) => shipIdOf(weak.sim, weak.sim.world.get(id, ModuleC) as { x: number; y: number }) === a) as number;
    (weak.sim.world.get(hit, ModuleC) as { hp: number }).hp = 1;
    const w = engagements(weak.sim)[0] as { calm?: number; hull?: number };
    run(weak.sim, TICK_HZ - 1);
    expect(weak.sim.world.get(a, ShipC)?.integrity).toBeLessThan(weak.sim.world.get(shipOf(weak.fb), ShipC)?.integrity as number);
    w.calm = weak.sim.tick - ENGAGE_STALE_SEC * TICK_HZ;
    w.hull = 0; // no damage taken since
    run(weak.sim, 1);
    expect(engagements(weak.sim)[0]?.leaving?.side).toBe(0);
  });

  it('a side that never turns up, or a fight the player leaves, is settled by the stats fight', () => {

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

  it('a stalemate never sends away a side that cannot jump: a station that came to aid stays and the attacker leaves; stations only end in a standoff (#609 review)', () => {
    const { sim, navy, merc } = attacked(AID_STANDING);
    (sim.world.get(navy, ShipC) as { immobile?: true }).immobile = true; // an armed station
    run(sim, TICK_HZ);
    const e = engagements(sim)[0] as { calm?: number; hull?: number; leaving?: { side: number } };
    expect(e).toBeDefined();
    // The station is the weaker side, yet it cannot jump: the attacker is the one that goes.
    const hit = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === navy) as number;
    (sim.world.get(hit, ModuleC) as { hp: number }).hp = 1;
    run(sim, TICK_HZ - 1);
    expect(sim.world.get(navy, ShipC)?.integrity).toBeLessThan(sim.world.get(merc, ShipC)?.integrity as number);
    e.calm = sim.tick - ENGAGE_STALE_SEC * TICK_HZ;
    e.hull = 0;
    run(sim, TICK_HZ);
    expect(e.leaving?.side).toBe(1);

    // Neither side can jump: the fight ends at once as a standoff, holding no fleet.
    const both = attacked(AID_STANDING);
    for (const id of [both.navy, both.merc]) (both.sim.world.get(id, ShipC) as { immobile?: true }).immobile = true;
    run(both.sim, TICK_HZ);
    const f = engagements(both.sim)[0] as { calm?: number; hull?: number };
    expect(f).toBeDefined();
    f.calm = both.sim.tick - ENGAGE_STALE_SEC * TICK_HZ;
    f.hull = 0;
    const out = run(both.sim, TICK_HZ);
    expect(eventsOf(out, 'engagement.ended')).toMatchObject([{ winner: null, stats: false }]);
    expect(engagements(both.sim)).toEqual([]);
    expect(engagedFleets(both.sim).size).toBe(0);
  });

  it('armed stations count; a faction never aids against itself', () => {
    const { sim, navy } = attacked(AID_STANDING);
    (sim.world.get(navy, ShipC) as { immobile?: true }).immobile = true;
    expect(canAid(sim, navy, 'mercenaries')).toBe(true);
    expect(canAid(sim, navy, 'navy')).toBe(false);
  });
});

const sim0Hostile = (sim: Sim, ship: number): boolean => sim.world.get(ship, ShipC)?.faction === 'hostile';
