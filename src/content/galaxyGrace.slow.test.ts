import { describe, expect, it } from 'vitest';
import { ShipC, newGame, type Sim } from '../sim';
import { factionsHostile } from '../sim/combat/factions';
import { GRACE_SEC } from '../sim/galaxy/tuning';
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

describe('opening grace period', () => {
  it('keeps hostiles out of the danger-0 start node for the first 20 minutes (seed 1 used to be raided at ~9 minutes), then behaves as before', { timeout: 600000 }, () => {
    const sim = newGame(1, content, 'ship.starter', true);
    expect(firstHostileAt(sim, GRACE_SEC - 5)).toBe(-1);
    // Past the window the same world raids this node.
    expect(firstHostileAt(sim, 15 * 60)).toBeGreaterThan(-1);
  });

  it('ends early when the goal chain is skipped', { timeout: 600000 }, () => {
    const skipped = newGame(1, content, 'ship.starter', true);
    skipped.enqueue({ type: 'story.skipGoals' });
    const at = firstHostileAt(skipped, 20 * 60);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(GRACE_SEC);
  });
});
