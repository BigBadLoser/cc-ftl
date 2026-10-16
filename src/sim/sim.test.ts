import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { MarkerC } from './components';
import { Sim } from './sim';
import { deserialize, serialize } from './save';

function run(seed: number): Sim {
  const sim = new Sim(seed);
  sim.grids.set(1, new Grid(1, 8, 8, { flags: 'u8' }));
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
    sim.grids.get(1)?.set('flags', 2, 2, 7);
    sim.enqueue({ type: 'noop' });
    const json = serialize(sim);
    const loaded = deserialize(json, { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [] });
    expect(serialize(loaded)).toBe(json);
    expect(loaded.tick).toBe(sim.tick);
    expect(loaded.grids.get(1)?.get('flags', 2, 2)).toBe(7);
    // both continue identically
    sim.step();
    loaded.step();
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('rejects newer or unmigratable versions', () => {
    const data = JSON.parse(serialize(new Sim(1)));
    data.version = 99;
    expect(() => deserialize(JSON.stringify(data), { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [] })).toThrow();
  });
});
