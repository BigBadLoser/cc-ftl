import { describe, expect, it } from 'vitest';
import { AsteroidC, MiningPodC, homeShip, isOreTile, newGame, placementError, shipGrid, spawnModule, spawnVehicle, type Sim } from '../sim';
import { content } from '../content';
import type { Renderer } from '../render/scene';
import { createStore } from './store';
import type { Bridge } from './bridge';
import { createController } from './controller';

/** The starter with a pod bay and pod, plus an asteroid field. */
function setup(): { sim: Sim; pod: number; asteroid: number } {
  const sim = newGame(1, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  let bay = 0;
  for (let y = g.y0; y < g.y0 + g.height && !bay; y++) {
    for (let x = g.x0; x < g.x0 + g.width && !bay; x++) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) bay = spawnModule(sim, 'module.pod_bay', x, y, 0);
  }
  const pod = spawnVehicle(sim, 'vehicle.mining_pod', bay);
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  return { sim, pod, asteroid: [...sim.world.query(AsteroidC)][0]! };
}

describe('mining paint tool', () => {
  it('previews only the ore tiles in the dragged rectangle and orders the pod to mine just those', () => {
    const { sim, pod, asteroid } = setup();
    const a = sim.world.get(asteroid, AsteroidC)!;
    const ore: { x: number; y: number }[] = [];
    for (let y = a.y; y < a.y + a.height; y++) for (let x = a.x; x < a.x + a.width; x++) if (isOreTile(sim, asteroid, x, y)) ore.push({ x, y });
    expect(ore.length).toBeGreaterThan(4);
    // A rectangle around the first few ore tiles (row-major), wide enough to take rock without ore too.
    const first = ore[0]!;
    const rect = { x0: first.x, y0: first.y, x1: first.x + 5, y1: first.y + 5 };
    const inRect = ore.filter((t) => t.x >= rect.x0 && t.x <= rect.x1 && t.y >= rect.y0 && t.y <= rect.y1);

    let preview: { x: number; y: number }[] = [];
    const renderer = { setAreas: () => undefined, setWorldGrid: () => undefined, setPreview: (t: { x: number; y: number }[]) => (preview = t), setHover: () => undefined, setSites: () => undefined } as unknown as Renderer;
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c = createController(sim, bridge);
    const h = c.attach(renderer);
    c.setTool({ tool: 'build', build: 'mine', pods: [pod] });
    h.onPaint('start', { x: rect.x0, y: rect.y0 });
    h.onPaint('move', { x: rect.x1, y: rect.y1 });
    expect(preview.map(({ x, y }) => ({ x, y }))).toEqual(inRect);
    expect(preview.every((t) => (t as { lift?: number }).lift !== undefined)).toBe(true); // drawn on the rock tops
    expect(preview.length).toBeLessThan((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1));
    h.onPaint('end', { x: rect.x1, y: rect.y1 });
    sim.step();
    const order = sim.world.get(pod, MiningPodC)!;
    expect(order.asteroid).toBe(asteroid);
    expect(order.tiles).toEqual(inRect);
    expect(preview).toEqual([]);
  });

  it('toasts instead of ordering when the rectangle holds no ore', () => {
    const { sim, pod, asteroid } = setup();
    const a = sim.world.get(asteroid, AsteroidC)!;
    let toast: string | null = null;
    const c = createController(sim, { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge);
    c.toast.subscribe((m) => (toast = m));
    const h = c.attach({ setPreview: () => undefined, setAreas: () => undefined, setWorldGrid: () => undefined, setHover: () => undefined, setSites: () => undefined } as unknown as Renderer);
    c.setTool({ tool: 'build', build: 'mine' });
    h.onPaint('start', { x: a.x - 20, y: a.y - 20 });
    h.onPaint('end', { x: a.x - 18, y: a.y - 18 });
    sim.step();
    expect(toast).toBe('No ore in that rectangle');
    expect(sim.world.has(pod, MiningPodC)).toBe(false);
  });
});
