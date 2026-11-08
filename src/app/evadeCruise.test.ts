import { describe, expect, it } from 'vitest';
import { CombatC, newGame, playerHelm, playerShip } from '../sim';
import { patrolNode } from './scenarios/patrol';
import { piratesCommands } from './scenarios/pirates';
import { content } from '../content';

/**
 * #367: the trip's evade odds read the ship's cruise figures from its packet. The helm refreshes them only every few ticks, so a jump took
 * whatever the last refresh left (zeros on a ship that had not been refreshed, which pins the odds at EVADE_MIN). The jump now takes them fresh.
 */
describe('cruise figures at the jump', () => {
  it('are taken fresh as the ship leaves, not from the helm system\'s last refresh', () => {
    const sim = newGame(3, content);
    for (let i = 0; i < 20; i++) sim.step();
    const combat = sim.world.get(playerShip(sim), CombatC)!;
    expect(combat.cruiseEvasion).toBeGreaterThan(0);
    combat.cruiseEvasion = 0; // stale, as between two refreshes after a change aboard
    combat.cruisePilot = 0;
    for (const cmd of piratesCommands(sim, patrolNode(sim)!)) sim.enqueue(cmd);
    sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    const helm = playerHelm(sim);
    expect(helm.evasion).toBeCloseTo(0.312, 3);
    expect(helm.pilot).toBe(3);
  });
});
