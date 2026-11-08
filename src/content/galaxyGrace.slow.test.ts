import { describe, expect, it } from 'vitest';
import { ShipC, newGame, type Sim } from '../sim';
import { factionsHostile } from '../sim/combat/factions';
import { ARRIVAL_EVERY_SEC, GRACE_SEC } from '../sim/galaxy/tuning';
import { TICK_HZ } from '../sim/time';
import { content } from './index';

/** Hostile ships in play in the player's node. */
const hostileShips = (sim: Sim): number =>
  sim.world.query(ShipC).filter((id) => {
    const s = sim.world.get(id, ShipC)!;
    return (s.state === 'active' || s.state === 'disabled') && factionsHostile(s.faction, 'player');
  }).length;

/** Idle for `sec` seconds; the first second a hostile ship is in play, or -1. */
function firstHostileAt(sim: Sim, sec: number): number {
  for (let t = 0; t < sec * TICK_HZ; t++) {
    sim.step();
    sim.events.drain();
    if (t % TICK_HZ === 0 && hostileShips(sim) > 0) return Math.round(t / TICK_HZ);
  }
  return -1;
}

/**
 * The arrival roll comes once per ARRIVAL_EVERY_SEC; hold the clock still and call it `rolls` times in a row (one step each),
 * and report how many rolls it took for a hostile ship to be in play (0 if none did). Grace consumes no galaxy rng, so these are the same rolls
 * the full-length idle run makes.
 */
function rollsUntilHostile(sim: Sim, rolls: number): number {
  for (let n = 1; n <= rolls; n++) {
    sim.galaxy.nextArrival = sim.tick;
    sim.step();
    sim.events.drain();
    if (hostileShips(sim) > 0) return n;
  }
  return 0;
}

describe('opening grace period (guard; galaxyGrace.soak.test.ts runs the full 20 minutes and the raid after it)', () => {
  it('keeps hostiles out of the danger-0 start node for every arrival roll of the first 19 minutes (seed 1 used to be raided at ~9 minutes), and for the first 2 minutes of real play', () => {
    const sim = newGame(1, content, 'ship.starter', true);
    expect(firstHostileAt(sim, 2 * 60)).toBe(-1);
    expect(rollsUntilHostile(sim, Math.floor(GRACE_SEC / ARRIVAL_EVERY_SEC) - 1)).toBe(0);
  });

  it('ends early when the goal chain is skipped: the same rolls raid the node well inside the grace window', () => {
    const skipped = newGame(1, content, 'ship.starter', true);
    skipped.enqueue({ type: 'story.skipGoals' });
    const rolls = rollsUntilHostile(skipped, Math.floor(GRACE_SEC / ARRIVAL_EVERY_SEC) - 1);
    expect(rolls).toBeGreaterThan(0);
    expect(rolls * ARRIVAL_EVERY_SEC).toBeLessThan(GRACE_SEC);
  });
});
