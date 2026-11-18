import { describe, expect, it } from 'vitest';
import { START_NODE } from '../sim/galaxy/state';
import { TIME_TURN_TICKS } from '../sim/galaxy/turn';
import { newGame } from '../sim/newGame';
import { giveItems } from '../sim/story/effects';
import { playerShip } from '../sim/trade/player';
import { adjacent, charge, clear, deploy, step } from '../../test/support/fixtures/traffic';
import { content } from '.';

// Slow tier: the turn clock over whole turns of game time (galaxyTraffic.test.ts starts it just short of a turn).
describe('turn clock, over whole turns', () => {
  it('three minutes of active game time are one turn, and the clock restarts', () => {
    const sim = newGame(21, content);
    sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
    clear(sim);
    step(sim, TIME_TURN_TICKS - 1);
    expect(sim.galaxy.turn).toBe(0);
    const ev = step(sim);
    expect(sim.galaxy.turn).toBe(1);
    expect(ev).toContainEqual({ type: 'galaxy.turn', turn: 1, cause: 'time' });
    step(sim, TIME_TURN_TICKS);
    expect(sim.galaxy.turn).toBe(2);
  });

  it('a hop resets the clock; no time turn fires for the same stretch; deploy resets it too', () => {
    const sim = newGame(21, content);
    sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
    clear(sim);
    step(sim, TIME_TURN_TICKS - 50);
    giveItems(sim, 'item.fuel', 50);
    charge(sim);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [adjacent(sim, START_NODE)[0] as string] });
    step(sim);
    expect(sim.galaxy.turn).toBe(1);
    expect(sim.galaxy.turnClock).toBe(0);
    // Hyperspace and deploying do not run the clock.
    while (sim.sector.state === 'hyperspace' && (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story')) { step(sim); sim.story.active = null; }
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim, 3);
    step(sim, 2000);
    expect(sim.galaxy.turn).toBe(1);
    sim.galaxy.turnClock = 500;
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    expect(sim.galaxy.turnClock).toBeLessThan(5);
    step(sim, TIME_TURN_TICKS - 10);
    expect(sim.galaxy.turn).toBe(1);
    step(sim, 20);
    expect(sim.galaxy.turn).toBe(2);
  }, 60000);
});
