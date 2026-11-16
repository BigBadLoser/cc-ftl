import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ShipC } from '../sim/combat/components';
import { ContainerC } from '../sim/containers/components';
import { StorageC } from '../sim/items/components';
import { currentNode, newGame, playerShip, populateCargo } from '../sim';
import { buildMining } from './miningSnapshot';

/** The lost-container inspector's data (#503): what the panel lists for a box, before and while it is cut. */
describe('lost container panel data', () => {
  it('lists a box sealed and openable, then cutting under the same id', () => {
    const sim = newGame(3, content);
    const ship = sim.world.get(playerShip(sim), ShipC)!;
    const before = new Set(sim.world.query(ContainerC));
    populateCargo(sim, { ...currentNode(sim)!, danger: 2 }, 4, { x: ship.x + ship.width + 12, y: ship.y });
    const id = sim.world.query(ContainerC).find((c) => !before.has(c)) as number;
    expect(sim.world.get(id, StorageC)).toBeDefined();
    const seed = sim.world.get(id, ContainerC)!.seed as number;
    const loose = buildMining(sim).containers.find((c) => c.id === seed)!;
    expect(loose).toMatchObject({ entity: id, state: 'drifting', refusal: null });
    expect(loose.faction).toBeTruthy();
    sim.enqueue({ type: 'container.open', id });
    sim.step();
    const cutting = buildMining(sim).containers.find((c) => c.id === seed)!;
    expect(cutting.state).toBe('cutting');
    expect(cutting.refusal).not.toBeNull();
  });
});
