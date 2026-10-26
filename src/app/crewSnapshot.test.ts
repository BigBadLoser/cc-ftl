import { shipIdOf, shipGrid } from '../sim/regions';
import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, newGame, type Sim } from '../sim';
import { content } from '../content';
import { buildCrewLists } from './crewSnapshot';
import { shipIds } from '../sim/regions';
import { StunC } from '../sim/robots/components';
import { haltCrew } from '../sim/robots/halt';

const run = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) sim.step();
  sim.events.drain();
};

describe('buildCrewLists', () => {
  it('lists the player crew with their ship and available weapons, and no hostiles at first', () => {
    const sim = newGame(1, content);
    run(sim, 3);
    const { crew, hostiles } = buildCrewLists(sim);
    expect(crew).toHaveLength(4);
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

  it('shows a stunned organic crew member as knocked down, and a stunned robot as inert', () => {
    const sim = newGame(1, content);
    run(sim, 2);
    const human = sim.world.query(CrewC)[0] as number;
    const home = shipIds(sim)[0] as number;
    const p = sim.world.get(human, PositionC)!;
    sim.enqueue({ type: 'debug.spawnCrew', ship: home, x: p.x, y: p.y, role: 'role.robot_worker', faction: 'player' });
    run(sim, 1);
    const robot = sim.world.query(CrewC).find((c) => sim.world.get(c, CrewC)?.role === 'role.robot_worker')!;
    for (const id of [human, robot]) {
      sim.world.add(id, StunC, { until: sim.tick + 100 });
      haltCrew(sim, id);
    }
    const { crew } = buildCrewLists(sim);
    expect(crew.find((c) => c.id === human)?.activity).toBe('knocked down');
    expect(crew.find((c) => c.id === robot)?.activity).toBe('inert');
  });
});

