import { describe, expect, it } from 'vitest';
import { stampAsteroid } from '../asteroids/place';
import type { AsteroidPlan } from '../asteroids/types';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { BodyC } from '../body';
import { MiningPodC, type MiningPod } from './components';
import { hoverSpot, orderTiles, pickTile } from './pick';

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

  it('hovers behind the ore on screen first (grid -x or -y), nearest the pod, then in front, then the grid diagonals', () => {
    const { sim } = bar();
    const pod = sim.world.createEntity();
    sim.world.add(pod, BodyC, { x: 8, y: 14, heading: 0, alt: 2.5 });
    // Open space on both spots behind (12, 10) (the bar's tile (11, 10) cleared): the pod in the south-west is nearer the (-1, 0) one.
    sim.sector.grid.set('struct', 11, 10, Struct.Space);
    expect(hoverSpot(sim, pod, { x: 12, y: 10 }, 2.6)).toEqual({ x: 11.5, y: 10.5 });
    sim.world.get(pod, BodyC)!.x = 16;
    sim.world.get(pod, BodyC)!.y = 4;
    expect(hoverSpot(sim, pod, { x: 12, y: 10 }, 2.6)).toEqual({ x: 12.5, y: 9.5 });
    // Rock behind (both): the spots in front are next.
    const g = sim.sector.grid;
    g.set('struct', 11, 10, Struct.Rock);
    g.set('struct', 12, 9, Struct.Rock);
    const front = hoverSpot(sim, pod, { x: 12, y: 10 }, 2.6);
    expect([[13.5, 10.5], [12.5, 11.5]].some(([x, y]) => front.x === x && front.y === y)).toBe(true);
    // Rock in front too: a grid diagonal.
    g.set('struct', 13, 10, Struct.Rock);
    g.set('struct', 12, 11, Struct.Rock);
    const diag = hoverSpot(sim, pod, { x: 12, y: 10 }, 2.6);
    expect(Math.abs(diag.x - 12.5)).toBe(1);
    expect(Math.abs(diag.y - 10.5)).toBe(1);
  });

  it('keeps pods a width apart and is deterministic', () => {
    const { sim, asteroid } = bar();
    const other = sim.world.createEntity();
    sim.world.add(other, MiningPodC, order(asteroid, { phase: 'mining', target: { x: 12, y: 10 }, spot: { x: 11.5, y: 9.5 } }));
    const a = hoverSpot(sim, 99, { x: 12, y: 10 }, 2.6);
    expect(Math.hypot(a.x - 11.5, a.y - 9.5)).toBeGreaterThanOrEqual(2.6 - 1e-9);
    expect(hoverSpot(sim, 99, { x: 12, y: 10 }, 2.6)).toEqual(a);
    // A neighbouring tile's pod stays clear as well.
    const b = hoverSpot(sim, 99, { x: 13, y: 10 }, 2.6);
    expect(Math.hypot(b.x - 11.5, b.y - 9.5)).toBeGreaterThanOrEqual(2.6 - 1e-9);
  });
});
