import { describe, expect, it } from 'vitest';
import { pickAirlock, boardTargets } from '../sim/boarding/party';
import { CombatC, ShipC } from '../sim/combat/components';
import { hopeless } from '../sim/combat/hopeless';
import { shipCrew } from '../sim/capture/control';
import { PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { isHostile } from '../sim/fight/relations';
import { surrender } from '../sim/fight/surrender';
import { engagements } from '../sim/galaxy/engagements';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { VehicleC } from '../sim/vehicles/components';
import { eventsOf } from '../../test/support/sim';
import { run } from '../../test/support/run';
import { fight, fleetHere, shipOf } from '../../test/support/content';
import { content } from './index';
import { newGame } from '../sim/newGame';
import { materialiseFleet } from '../sim/galaxy/fleetShips';
import type { Fleet } from '../sim/galaxy/types';

/**
 * A ship beaten in a fight between NPC ships gives up to its foe through the player's own systems (#603; one system for each thing, whoever acts):
 * the hopeless rule makes its crew surrender, it yields, and the foe answers by its faction's habit. The cheap guard of nodeBoarding.slow.test.ts
 * comes first: a boarding party goes for the foe it fights, and its crew and the foe's are enemies.
 */

/** Every crew member of the ship gives up. */
function beat(sim: Sim, ship: number): void {
  for (const c of shipCrew(sim, ship)) surrender(sim, c);
}

describe('boarding between NPC ships (guard of nodeBoarding.slow.test.ts)', () => {
  it('a party goes for the foe it fights; its crew and the foe\'s are enemies', () => {
    const { sim, fa, fb } = fight(['raiders', 'raider'], ['traders', 'trader'], { raiders: 10 });
    run(sim, 1);
    const [raider, trader] = [shipOf(fa), shipOf(fb)];
    expect(boardTargets(sim, raider)).toEqual([trader]);
    const shuttle = sim.world.query(VehicleC).find((v) => sim.world.get(v, VehicleC)?.homeShip === raider) as number;
    expect(shipIdOf(sim, sim.world.get(pickAirlock(sim, shuttle), ModuleC))).toBe(trader);
    const [mine] = shipCrew(sim, raider) as [number];
    const [theirs] = shipCrew(sim, trader) as [number];
    expect(isHostile(sim, mine, theirs)).toBe(true); // both neutral to the player: only the fight makes them foes
    (sim.world.get(mine, AllegianceC) as { ship?: number }).ship = raider;
    expect(shipCrew(sim, raider)).toContain(mine);
  });
});

describe('a beaten ship in a fight between NPC ships', () => {
  it('gives up when its fight is hopeless, as against the player', () => {
    const { sim, fb } = fight();
    run(sim, 1);
    const id = shipOf(fb);
    const ship = sim.world.get(id, ShipC) as { integrity: number };
    for (const m of sim.world.query(ModuleC)) {
      const mod = sim.world.get(m, ModuleC);
      if (mod && shipIdOf(sim, mod) === id && sim.content.modules[mod.def]?.weapon) mod.hp = 0;
    }
    (sim.world.get(id, CombatC) as { ftl: number }).ftl = 0;
    ship.integrity = 0.3;
    expect(hopeless(sim, id, sim.world.get(id, ShipC) as never)).toBe(true);
  });

  it('is taken by a foe that takes prizes: it joins the captor\'s fleet with its crew aboard, the fight ends as taken', () => {
    const { sim, fa, fb } = fight(['raiders', 'raider'], ['traders', 'trader'], { raiders: 10 });
    run(sim, 1);
    const trader = shipOf(fb);
    const crew = shipCrew(sim, trader);
    run(sim, 3 * TICK_HZ);
    expect(sim.world.get(shipOf(fa), CombatC)?.target?.ship).toBe(trader);
    sim.sector.inCombat = true;
    beat(sim, trader);
    const out = run(sim, 2 * TICK_HZ, { until: (s) => engagements(s).length === 0 });
    expect(eventsOf(out, 'engagement.ended')).toMatchObject([{ winner: 0, stats: false, taken: true }]);
    expect(fa.ships.map((c) => c.ship)).toEqual([shipOf(fa), trader]);
    expect(fb.ships).toEqual([]);
    expect(sim.galaxy.news.filter((n) => n.kind === 'taken')).toMatchObject([{ who: fa.ships[0]?.name, faction: 'raiders' }]);
    expect(crew.every((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === trader)).toBe(true); // no NPC prisoners: the beaten crew stay aboard
    expect(sim.world.get(trader, ShipC)?.yielded).toBeUndefined();
    expect(sim.world.get(trader, ShipC)?.taken).toBe(true);
    // Neither aims at the other any more, though the node is in combat (#609 review).
    for (const [a, b] of [[shipOf(fa), trader], [trader, shipOf(fa)]] as const) {
      const c = sim.world.get(a, CombatC);
      expect([c?.target?.ship, c?.prey]).not.toContain(b);
    }
  });

  it('taken, it never yields again: the captor fights on against the rest of the beaten fleet (#609 review)', () => {
    // Neutral raiders against two traders: after the first trader is taken, its beaten crew stay aboard as captives, and that must not read as a
    // surrender by the raiders' fleet (which would send the raiders away and make the traders the winners).
    const sim = newGame(21, content);
    sim.story.goals.skipped = true;
    sim.story.reputation['raiders'] = 10;
    const fa = fleetHere(sim, 'raiders', 'raider', 9001);
    const fb = fleetHere(sim, 'traders', 'trader', 9002);
    const second = { ...(fb.ships[0] as Fleet['ships'][number]), id: sim.galaxy.nextFleet++, seed: 2 * 9002 };
    fb.ships.push(second);
    sim.galaxy.fleets = [fa, fb];
    materialiseFleet(sim, fa);
    materialiseFleet(sim, fb);
    run(sim, 1);
    const [first, other] = [shipOf(fb), second.ship as number];
    expect(other).toBeDefined();
    run(sim, 3 * TICK_HZ);
    sim.sector.inCombat = true;
    (sim.world.get(shipOf(fa), CombatC) as { prey?: number }).prey = first;
    beat(sim, first);
    const out = run(sim, 4 * TICK_HZ);
    expect(fa.ships.map((c) => c.ship)).toContain(first);
    expect(sim.world.get(first, ShipC)?.yielded).toBeUndefined();
    expect(fa.node).toBe(sim.galaxy.current);
    expect(eventsOf(out, 'engagement.ended').filter((e) => e.winner === 1)).toEqual([]);
    expect(engagements(sim).some((e) => e.members.some((side) => side.some((m) => m.ship === other)))).toBe(true);
  });

  it('taken, it stays the captor\'s in a later fight too: its captives never surrender the captor\'s fleet (#613 review)', () => {
    const { sim, fa, fb } = fight(['raiders', 'raider'], ['traders', 'trader'], { raiders: 10 });
    const proto = fb.ships[0] as Fleet['ships'][number];
    const fc: Fleet = { ...fb, id: 9003, ships: [{ ...proto, id: sim.galaxy.nextFleet++, seed: 9003, ship: undefined }] };
    run(sim, 1);
    const trader = shipOf(fb);
    run(sim, 3 * TICK_HZ);
    sim.sector.inCombat = true;
    beat(sim, trader);
    run(sim, 2 * TICK_HZ, { until: (s) => engagements(s).length === 0 });
    expect(fa.ships.map((c) => c.ship)).toContain(trader);
    // Another trader fleet turns up and the raiders meet it in a new fight (a new turn's meeting), the prize on their side.
    sim.galaxy.fleets.push(fc);
    materialiseFleet(sim, fc);
    fa.dwell = 99999;
    delete sim.sector.met;
    run(sim, 2 * TICK_HZ, { until: (s) => engagements(s).some((e) => e.members.some((side) => side.some((m) => m.ship === trader))) });
    expect(engagements(sim).some((e) => e.members.some((side) => side.some((m) => m.ship === trader)))).toBe(true);
    const out = run(sim, 4 * TICK_HZ);
    expect(sim.world.get(trader, ShipC)?.yielded).toBeUndefined();
    expect(fa.node).toBe(sim.galaxy.current);
    expect(eventsOf(out, 'engagement.ended').filter((e) => e.winner === 1)).toEqual([]);
  });

  it('is let go by a foe that does not: its fleet jumps away and the foe wins, driven off', () => {
    const { sim, fa, fb } = fight();
    run(sim, 1);
    beat(sim, shipOf(fb));
    const out = run(sim, 2 * TICK_HZ, { until: (s) => engagements(s).length === 0 });
    expect(eventsOf(out, 'engagement.ended')).toMatchObject([{ winner: 0, stats: false }]);
    expect(eventsOf(out, 'engagement.ended')[0]?.taken).toBeUndefined();
    expect(fb.node).not.toBe(sim.galaxy.current);
    expect(fa.ships).toHaveLength(1);
    expect(sim.galaxy.news.some((n) => n.kind === 'driven' && n.who === fa.ships[0]?.name)).toBe(true);
  });
});
