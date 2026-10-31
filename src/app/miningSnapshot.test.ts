import { describe, expect, it } from 'vitest';
import { AsteroidC, homeShip, newGame, placementError, shipGrid, spawnModule, spawnVehicle, type Sim } from '../sim';
import { content } from '../content';
import { buildMining } from './miningSnapshot';
import { buildShuttles } from './shuttleSnapshot';

function setup(): { sim: Sim; pod: number; asteroid: number; bay: number } {
  const sim = newGame(1, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  let bay = 0;
  for (let y = g.y0; y < g.y0 + g.height && !bay; y++) for (let x = g.x0; x < g.x0 + g.width && !bay; x++) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) bay = spawnModule(sim, 'module.pod_bay', x, y, 0);
  const pod = spawnVehicle(sim, 'vehicle.mining_pod', bay);
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  return { sim, pod, asteroid: [...sim.world.query(AsteroidC)][0]!, bay };
}

describe('mining snapshot', () => {
  it('lists asteroids with ore totals by kind and the player pods with their order state', () => {
    const { sim, pod, asteroid, bay } = setup();
    let m = buildMining(sim);
    const a = m.asteroids.find((x) => x.id === asteroid)!;
    expect(a.kind).toBe('field');
    expect(a.ore.length).toBeGreaterThan(0);
    expect(a.ore.every((o) => o.units > 0 && /^#[0-9a-f]{6}$/.test(o.color))).toBe(true);
    expect(m.pods).toEqual([expect.objectContaining({ id: pod, state: 'stowed', phase: null, hold: 0, cap: content.vehicles['vehicle.mining_pod'].cargo, trips: 0 })]);
    sim.enqueue({ type: 'mining.order', pod, asteroid });
    for (let i = 0; i < 2000 && buildMining(sim).pods[0]!.phase !== 'mining'; i++) sim.step();
    m = buildMining(sim);
    expect(m.pods[0]).toMatchObject({ phase: 'mining', asteroid, trips: 1 });
    expect(m.pods[0]!.pilot).not.toBeNull();
    expect(m.asteroids.find((x) => x.id === asteroid)!.pods).toBe(1);
    // the pod bay is one of the player's bays: selecting it opens the vehicle panel, which lists the pods
    expect(buildShuttles(sim).bays.some((b) => b.id === bay)).toBe(true);
  });
});
