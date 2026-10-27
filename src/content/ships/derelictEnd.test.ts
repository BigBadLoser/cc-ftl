import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, ShipC, SurrenderedC, newGame, type Sim } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { killCrew } from '../../sim/crew/death';
import { AllegianceC } from '../../sim/fight/components';

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const crewOf = (sim: Sim, shipId: number): number[] =>
  sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === shipId && sim.world.get(c, AllegianceC)?.faction !== 'player');
function setup(template = 'ship.raider'): Sim {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template, x: 20, y: 90 });
  sim.step();
  sim.events.drain();
  return sim;
}
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };

describe('the fight ends in a derelict when the enemy crew is subdued or dead', () => {
  it('wrecks a ship whose crew all surrendered or died, and the fight is over', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const crew = crewOf(sim, enemy);
    expect(crew.length).toBeGreaterThan(1);
    expect(sim.world.get(enemy, ShipC)!.state).toBe('active');
    run(sim, 30);
    expect(sim.sector.inCombat).toBe(true);
    crew.forEach((c, i) => (i % 2 ? sim.world.add(c, SurrenderedC, { tick: sim.tick }) : killCrew(sim, c)));
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.state).toBe('wreck');
    expect(sim.sector.inCombat).toBe(false);
  });

  it('keeps fighting while one enemy crew member is still able', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const [, ...rest] = crewOf(sim, enemy);
    for (const c of rest) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 60);
    expect(sim.world.get(enemy, ShipC)!.state).not.toBe('wreck');
  });

  it('leaves a ship that never had crew alone', () => {
    const sim = newGame(1, { ...content, ships: { ...content.ships, 'ship.empty': { ...content.ships['ship.raider'], crew: [] } } });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.empty', x: 20, y: 90 });
    run(sim, 60);
    expect(sim.world.get(nth(sim, 2), ShipC)!.state).not.toBe('wreck');
  });

  it('leaves the capture to the boarders while player crew stand aboard', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const ship = sim.world.get(enemy, ShipC)!;
    const mine = sim.world.query(CrewC, PositionC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player')!;
    const pos = sim.world.get(mine, PositionC)!;
    const keep = { x: pos.x, y: pos.y };
    for (const c of crewOf(sim, enemy)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    Object.assign(pos, { x: ship.x + 2, y: ship.y + 2 });
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.state).not.toBe('wreck');
    Object.assign(pos, keep);
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.state).toBe('wreck');
  });
});
