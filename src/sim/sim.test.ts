import { describe, expect, it } from 'vitest';
import { MarkerC } from './components';
import { Sim } from './sim';
import { deserialize, SAVE_VERSION, serialize } from './save';
import { stampShip } from './combat/ships';
import { shipGrid } from './regions';

function run(seed: number): Sim {
  const sim = new Sim(seed);
  stampShip(sim, { name: 't', rows: Array.from({ length: 8 }, () => '########') }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  for (let i = 0; i < 100; i++) {
    if (i % 7 === 0) sim.enqueue({ type: 'debug.spawnMarker', x: i % 8, y: sim.rng.int(0, 7) });
    if (i % 13 === 0) sim.enqueue({ type: 'noop' });
    sim.step();
  }
  return sim;
}

describe('Sim', () => {
  it('steps the tick counter and applies commands at tick start', () => {
    const sim = new Sim(1);
    sim.enqueue({ type: 'debug.spawnMarker', x: 2, y: 3 });
    expect(sim.world.query(MarkerC)).toHaveLength(0);
    sim.step();
    expect(sim.tick).toBe(1);
    const [id] = sim.world.query(MarkerC);
    expect(sim.world.get(id as number, MarkerC)).toEqual({ x: 2, y: 3 });
    expect(sim.events.drain()).toHaveLength(1);
    expect(sim.events.drain()).toHaveLength(0);
  });

  it('is deterministic for same seed and commands', () => {
    expect(serialize(run(123))).toBe(serialize(run(123)));
    expect(serialize(run(123))).not.toBe(serialize(run(124)));
  });
});

describe('save', () => {
  it('round-trips serialize -> deserialize -> serialize', () => {
    const sim = run(55);
    shipGrid(sim, 1)?.set('smoke', 2, 2, 7);
    sim.enqueue({ type: 'noop' });
    const json = serialize(sim);
    const loaded = deserialize(json, { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} });
    expect(serialize(loaded)).toBe(json);
    expect(loaded.tick).toBe(sim.tick);
    expect(shipGrid(loaded, 1)?.get('smoke', 2, 2)).toBe(7);
    // both continue identically
    sim.step();
    loaded.step();
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('rejects newer and older versions (saves are not migrated)', () => {
    const empty = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} };
    for (const version of [99, SAVE_VERSION - 1, 1]) {
      const data = JSON.parse(serialize(new Sim(1)));
      data.version = version;
      expect(() => deserialize(JSON.stringify(data), empty)).toThrow(/not migrated/);
    }
  });

  it('stores the tiles as sector chunks and a ship as its ShipC rectangle (no window rectangles)', () => {
    const sim = run(55);
    const data = JSON.parse(serialize(sim));
    expect(data.version).toBe(SAVE_VERSION);
    expect(data['grids']).toBeUndefined();
    expect(data.world.stores.ship).toMatchObject([[1, { x: 0, y: 0, width: 8, height: 8 }]]);
    expect(data.sector.grid.chunks.length).toBeGreaterThan(0);
  });
});
