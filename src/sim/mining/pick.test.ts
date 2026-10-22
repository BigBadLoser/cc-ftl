import { describe, expect, it } from 'vitest';
import { stampAsteroid } from '../asteroids/place';
import type { AsteroidPlan } from '../asteroids/types';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { MiningPodC, type MiningPod } from './components';
import { orderTiles, pickTile } from './pick';

const content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} };

/** A 5x1 rock bar at (10, 10) with ore on tiles 0, 2 and 4. */
function bar(): { sim: Sim; asteroid: number } {
  const sim = new Sim(1, content);
  const plan: AsteroidPlan = {
    kind: 'field', seed: 0, coverage: 'dense', mass: 1, w: 5, h: 1, struct: new Uint8Array(5).fill(Struct.Rock),
    ore: Uint8Array.from([1, 0, 1, 0, 1]), amt: Uint8Array.from([5, 0, 5, 0, 5]), parts: [{ x: 0, y: 0, w: 5, h: 1 }],
  };
  return { sim, asteroid: stampAsteroid(sim, plan, 10, 10) };
}
const order = (asteroid: number, o: Partial<MiningPod> = {}): MiningPod =>
  ({ asteroid, tiles: null, phase: 'launching', target: null, progress: 0, recall: false, trips: 0, pilot: 0, ...o });

describe('mining tile picks', () => {
  it('lists ore tiles row-major and picks the nearest, ties to the lower x', () => {
    const { sim, asteroid } = bar();
    expect(orderTiles(sim, order(asteroid))).toEqual([{ x: 10, y: 10 }, { x: 12, y: 10 }, { x: 14, y: 10 }]);
    expect(pickTile(sim, 99, order(asteroid), { x: 15.9, y: 10.5 })).toEqual({ x: 14, y: 10 });
    expect(pickTile(sim, 99, order(asteroid), { x: 11.5, y: 10.5 })).toEqual({ x: 10, y: 10 });
  });

  it('prefers tiles no other pod has claimed, shares a claimed one when nothing else is left, and honours a tile list', () => {
    const { sim, asteroid } = bar();
    const other = sim.world.createEntity();
    sim.world.add(other, MiningPodC, order(asteroid, { target: { x: 14, y: 10 } }));
    expect(pickTile(sim, 99, order(asteroid), { x: 15.9, y: 10.5 })).toEqual({ x: 12, y: 10 });
    expect(pickTile(sim, 99, order(asteroid, { tiles: [{ x: 14, y: 10 }] }), { x: 0, y: 0 })).toEqual({ x: 14, y: 10 });
    expect(pickTile(sim, 99, order(asteroid, { tiles: [{ x: 3, y: 3 }] }), { x: 0, y: 0 })).toBeNull(); // no ore there
    expect(pickTile(sim, other, order(asteroid, { tiles: [{ x: 14, y: 10 }] }), { x: 0, y: 0 })).toEqual({ x: 14, y: 10 });
  });
});
