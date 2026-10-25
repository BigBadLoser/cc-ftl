import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { homeShip, newGame, ShipC } from '../sim';
import { DeadC } from '../sim/crew/components';
import { playerCrew } from '../sim/story/world';
import { lostReason } from './saves';

describe('game over', () => {
  it('is not lost at the start, and is lost when the ship is wrecked or the crew is all dead', () => {
    const sim = newGame(7, content);
    expect(lostReason(sim)).toBeNull();
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    ship.state = 'wreck';
    expect(lostReason(sim)).toMatch(/destroyed/);
    ship.state = 'active';
    for (const id of playerCrew(sim)) sim.world.add(id, DeadC, { tick: sim.tick });
    expect(lostReason(sim)).toMatch(/crew/);
  });

  it('is never called lost in hyperspace, where the ship and crew are packed away', () => {
    const sim = newGame(7, content);
    sim.sector.state = 'hyperspace';
    for (const id of playerCrew(sim)) sim.world.add(id, DeadC, { tick: sim.tick });
    expect(lostReason(sim)).toBeNull();
  });
});
