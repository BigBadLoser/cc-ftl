import { describe, expect, it } from 'vitest';
import { CrewC, ShipC, newGame, shipOf, type SimEvent } from '../../sim';
import { content } from '../index';

describe('sector and ships', () => {
  it('newGame places the player ship in the sector', () => {
    const sim = newGame(1, content);
    expect(shipOf(sim, 1)).toMatchObject({ faction: 'player', state: 'active', x: 20, y: 50 });
    expect(sim.sector.width).toBeGreaterThan(100);
  });

  it('debug.spawnEnemy adds a hostile grid with crew; bad placement is rejected', () => {
    const sim = newGame(1, content);
    const events: SimEvent[] = [];
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.starter', x: 100, y: 50 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.starter', x: 25, y: 50 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'nope', x: 100, y: 50 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.starter', x: 199, y: 50 });
    sim.step();
    events.push(...sim.events.drain());
    expect(events.filter((e) => e.type === 'command.rejected').map((e) => e.type === 'command.rejected' && e.reason)).toEqual(['overlap', 'badTemplate', 'outOfBounds']);
    expect(sim.grids.has(2)).toBe(true);
    expect(sim.world.query(ShipC)).toHaveLength(2);
    expect(shipOf(sim, 2)?.faction).toBe('hostile');
    expect(sim.world.query(CrewC).length).toBe(10);
  });
});
