import { describe, expect, it } from 'vitest';
import { AsteroidC, MiningPodC, VehicleC, homeShip, newGame, placementError, shipGrid, spawnModule, spawnVehicle, totalStock, type Sim } from '../../sim';
import { content } from '../index';

/** The starter ship with `n` pod bays (first spots that fit, scanning rows), a pod in each, and a field. */
function setup(n: number): { sim: Sim; pods: number[]; asteroid: number } {
  const sim = newGame(7, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  const pods: number[] = [];
  for (let y = g.y0; y < g.y0 + g.height && pods.length < n; y++) {
    for (let x = g.x0; x < g.x0 + g.width && pods.length < n; x++) {
      if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) pods.push(spawnVehicle(sim, 'vehicle.mining_pod', spawnModule(sim, 'module.pod_bay', x, y, 0)));
    }
  }
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  return { sim, pods, asteroid: [...sim.world.query(AsteroidC)][0]! };
}

function oreLeft(sim: Sim, asteroid: number): number {
  const a = sim.world.get(asteroid, AsteroidC)!;
  let n = 0;
  for (let y = a.y; y < a.y + a.height; y++) for (let x = a.x; x < a.x + a.width; x++) n += sim.sector.grid.get('oreAmt', x, y);
  return n;
}

describe('mining pods, long run', () => {
  it('two pods work one field for six minutes: no shared tile, and every unit cut ends in storage or a hold', () => {
    const { sim, pods, asteroid } = setup(2);
    expect(pods).toHaveLength(2);
    const items = ['item.metal', 'item.ice', 'item.electronics'];
    const stock = () => items.reduce((n, i) => n + totalStock(sim, i), 0);
    const ore0 = oreLeft(sim, asteroid);
    const stock0 = stock();
    for (const pod of pods) sim.enqueue({ type: 'mining.order', pod, asteroid });
    let trips = 0;
    for (let i = 0; i < 6 * 60 * 20; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'mining.launched') trips++;
      const [a, b] = pods.map((p) => sim.world.get(p, MiningPodC)?.target);
      if (a && b) expect(`${a.x},${a.y}`).not.toBe(`${b.x},${b.y}`);
    }
    for (const pod of pods) sim.enqueue({ type: 'mining.recall', pod });
    for (let i = 0; i < 3000; i++) sim.step();
    const cut = ore0 - oreLeft(sim, asteroid);
    expect(trips).toBeGreaterThanOrEqual(6);
    expect(cut).toBeGreaterThan(100);
    const holds = pods.reduce((n, p) => n + sim.world.get(p, VehicleC)!.cargo.reduce((m, q) => m + q.count, 0), 0);
    expect(stock() - stock0 + holds).toBe(cut);
    // Recalled pods are home; one may still wait stowed with ore aboard when the starter's crates are full.
    for (const pod of pods) {
      expect(sim.world.get(pod, VehicleC)!.state).toBe('stowed');
      expect([undefined, 'unloading']).toContain(sim.world.get(pod, MiningPodC)?.phase);
    }
  });
});
