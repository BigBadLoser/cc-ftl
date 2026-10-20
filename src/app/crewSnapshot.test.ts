import { shipIdOf, shipGrid } from '../sim/regions';
import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, newGame, type Sim } from '../sim';
import { content } from '../content';
import { buildCrewLists } from './crewSnapshot';
import { shipIds } from '../sim/regions';

const run = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) sim.step();
  sim.events.drain();
};

describe('buildCrewLists', () => {
  it('lists the player crew with their ship and available weapons, and no hostiles at first', () => {
    const sim = newGame(1, content);
    run(sim, 3);
    const { crew, hostiles } = buildCrewLists(sim);
    expect(crew).toHaveLength(5);
    expect(hostiles).toHaveLength(0);
    expect(crew.every((c) => c.side === 'player' && c.where === 'Starter ship' && !c.away && c.weapon === null)).toBe(true);
    expect(crew[0]?.arms.map((a) => a.item).sort()).toEqual(['item.blade', 'item.rifle', 'item.sidearm']);
  });

  it('keeps crew who are away from grid 1, and lists enemy crew only on grids the player stands on', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 5);
    expect(buildCrewLists(sim).hostiles).toHaveLength(0);
    const id = sim.world.query(CrewC).find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === shipIds(sim)[0] as number)!;
    const pos = sim.world.get(id, PositionC)!;
    const raider = shipGrid(sim, shipIds(sim)[1] as number)!;
    pos.x = pos.toX = raider.x0 + 1; // as if it had landed on the raider
    pos.y = pos.toY = raider.y0 + 1;
    const { crew, hostiles } = buildCrewLists(sim);
    const me = crew.find((c) => c.id === id)!;
    expect(me.away).toBe(true);
    expect(me.where).toBe('Raider');
    expect(hostiles.length).toBeGreaterThan(0);
    expect(hostiles.every((h) => h.side === 'enemy' && h.ship === shipIds(sim)[1])).toBe(true);
  });
});
