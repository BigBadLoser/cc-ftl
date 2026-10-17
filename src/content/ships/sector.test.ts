import { describe, expect, it } from 'vitest';
import { CrewC, ShipC, deserialize, newGame, serialize, shipOf, type SimEvent } from '../../sim';
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

  it('migrates a version 3 save', () => {
    const sim = newGame(3, content);
    const data = JSON.parse(serialize(sim)) as { version: number; sector?: unknown; world: { stores: Record<string, unknown> }; grids: { fields: Record<string, unknown> }[] };
    data.version = 3;
    delete data.sector;
    delete data.world.stores.ship;
    delete data.world.stores.combat;
    for (const g of data.grids) delete g.fields.hp;
    const loaded = deserialize(JSON.stringify(data), content);
    expect(shipOf(loaded, 1)?.faction).toBe('player');
    expect(loaded.grids.get(1)!.get('hp', 0, 0)).toBe(255);
    expect(loaded.sector.width).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) loaded.step();
  });
});
