import { describe, expect, it } from 'vitest';
import { CombatC } from '../sim/combat/components';
import { CrewC, MoodC, PrioritiesC } from '../sim/crew/components';
import { galaxyIndex } from '../sim/galaxy/state';
import { FTL_CHARGE_SEC } from '../sim/tuning';
import { RolledSkillsC } from '../sim/crew/traits';
import { AllegianceC } from '../sim/fight/components';
import { carryOf, JOIN_HAPPY_SEC, JOIN_WAIT_SEC, pendingAsks } from '../sim/galaxy/joinOffer';
import { DraftedC } from '../sim/crew/components';
import { EmbarkOrderC } from '../sim/vehicles/components';
import { giveItems } from '../sim/story/effects';
import { playerCrew } from '../sim/story/world';
import { playerShip } from '../sim/trade/player';
import { content } from '.';
import { aboard, atDestination, step } from '../../test/support/fixtures/joinOffer';

/** A passenger asks to join (#173 step 6, slice 5): on delivery, or while aboard after a good stretch; once per person. */

describe('a passenger asks to join', () => {
  it('on delivery: the handover waits; yes makes them crew with their own skills, the passage closed with no fare', () => {
    const { sim, crew, seen, job } = atDestination(7);
    expect(seen.asks).toEqual([crew]);
    expect(seen.sent).toBe(0);
    const skills = JSON.stringify(sim.world.get(crew, RolledSkillsC));
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'jobs.join', crew, accept: true });
    step(sim, seen, 60);
    expect(seen.joined).toEqual([crew]);
    expect(sim.world.get(crew, AllegianceC)?.faction).toBe('player');
    expect(JSON.stringify(sim.world.get(crew, RolledSkillsC))).toBe(skills);
    expect(sim.world.get(crew, PrioritiesC)).toEqual(content.roles['role.pilot']!.priorities);
    expect(sim.galaxy.jobs.some((j) => j.id === job)).toBe(false);
    expect(sim.trade.credits).toBe(credits);
    expect(carryOf(sim, crew)).toBeUndefined();
    expect(playerCrew(sim)).toContain(crew);
  });

  it('on delivery, no: the handover goes on and they are delivered, never asked again', () => {
    const { sim, crew, seen } = atDestination(7);
    sim.enqueue({ type: 'jobs.join', crew, accept: false });
    for (let i = 0; i < 20 * 400 && sim.world.has(crew, CrewC); i++) step(sim, seen);
    expect(sim.world.has(crew, CrewC)).toBe(false);
    expect(seen.sent).toBeGreaterThan(0);
    expect(seen.asks).toEqual([crew]);
  });

  it('on delivery in a poor mood: no ask, the handover goes ahead', () => {
    const { sim, crew, seen } = atDestination(7, false);
    for (let i = 0; i < 20 * 400 && sim.world.has(crew, CrewC); i++) step(sim, seen);
    expect(seen.asks).toEqual([]);
    expect(sim.world.has(crew, CrewC)).toBe(false);
  });

  it('left unanswered, the ask lapses as a no', () => {
    const { sim, crew, seen } = atDestination(7);
    carryOf(sim, crew)!.asking = sim.tick - 20 * (JOIN_WAIT_SEC - 2); // asked just short of the wait (the whole wait runs in joinOffer.slow)
    step(sim, seen, 20 * 6);
    expect(carryOf(sim, crew)?.asking ?? undefined).toBeUndefined();
    expect(seen.sent).toBeGreaterThan(0);
  });

  it('aboard, after a long good mood: one seeded roll, at most one ask per person', () => {
    let asked = 0;
    for (const seed of [7, 8, 9, 10, 11, 12]) {
      const { sim, crew, seen } = aboard(seed);
      const c = carryOf(sim, crew)!;
      c.happySince = sim.tick - JOIN_HAPPY_SEC * 20;
      for (let i = 0; i < 40; i++) {
        sim.world.get(crew, MoodC)!.value = 90; // a good stretch (the mood system recomputes it now and then)
        step(sim, seen);
      }
      expect(c.rolled).toBe(true);
      if (seen.asks.length) {
        asked++;
        sim.enqueue({ type: 'jobs.join', crew, accept: false });
        step(sim, seen, 200);
        expect(seen.asks).toEqual([crew]);
      }
    }
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThan(6);
  });

  it('an ask raised while a handover runs calls the run off; after the answer it runs again', () => {
    const { sim, crew, seen } = atDestination(7, false);
    for (let i = 0; i < 20 * 120 && !sim.world.has(crew, EmbarkOrderC); i++) step(sim, seen);
    expect(seen.sent).toBe(1); // the run is on, the passenger walking to the shuttle
    const c = carryOf(sim, crew)!;
    c.asked = true;
    c.asking = sim.tick; // their mood rose: they ask now
    let reason = '';
    for (let i = 0; i < 40; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'trade.failed') reason = e.reason;
    }
    expect(reason).toBe('asking');
    expect(sim.world.has(crew, CrewC)).toBe(true);
    expect(sim.world.has(crew, DraftedC)).toBe(false);
    step(sim, seen, 20 * 30);
    expect(seen.sent).toBe(1); // nothing moves them while the ask waits
    sim.enqueue({ type: 'jobs.join', crew, accept: false });
    for (let i = 0; i < 20 * 400 && sim.world.has(crew, CrewC); i++) step(sim, seen);
    expect(seen.sent).toBeGreaterThan(1);
    expect(sim.world.has(crew, CrewC)).toBe(false);
  });

  it('an ask waiting in hyperspace (the ship packed) is still listed and can be answered', () => {
    const { sim, crew } = aboard(7);
    const c = carryOf(sim, crew)!;
    c.rolled = true;
    c.asked = true;
    c.asking = sim.tick;
    giveItems(sim, 'item.fuel', 40);
    const combat = sim.world.get(playerShip(sim), CombatC);
    if (combat) combat.ftl = FTL_CHARGE_SEC;
    const next = (galaxyIndex(sim.galaxy).adjacent.get(sim.galaxy.current) ?? []).map((e) => (e.a === sim.galaxy.current ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    for (let i = 0; i < 2000 && sim.sector.state !== 'hyperspace'; i++) sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    expect(pendingAsks(sim)).toEqual([crew]);
    sim.enqueue({ type: 'jobs.join', crew, accept: true });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'crew.joined')).toBe(true);
    expect(pendingAsks(sim)).toEqual([]);
  });
});
