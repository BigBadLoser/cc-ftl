import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { ShipC, Struct, deserialize, newGame, serialize } from '../../sim';
import { tubeRuns } from '../../sim/tube';

/** A prefab base's tubes (#508): the generator marks their floor tiles, a door at each end, walls along both sides. */
describe('prefab base tubes', () => {
  it('a surface trading outpost\'s modules are joined by marked tubes that survive a save', () => {
    const sim = newGame(2, content);
    sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'trading', seed: 1 });
    sim.step();
    const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)!;
    const s = sim.world.get(base, ShipC)!;
    const g = sim.sector.grid;
    const runs = tubeRuns(g, s.x, s.y, s.width, s.height);
    expect(runs.length).toBeGreaterThanOrEqual(3);
    for (const r of runs) {
      expect(g.get('struct', r.far.x, r.far.y)).toBe(Struct.Door);
      expect(g.get('struct', r.near.x, r.near.y)).toBe(Struct.Door);
      const [dx, dy] = r.axis === 'x' ? [1, 0] : [0, 1];
      for (let k = 0; k < r.len; k++) for (const side of [-1, 1]) expect(g.get('struct', r.x + dx * k + dy * side, r.y + dy * k + dx * side)).toBe(Struct.Wall);
    }
    const again = deserialize(serialize(sim), content);
    expect(tubeRuns(again.sector.grid, s.x, s.y, s.width, s.height)).toEqual(runs);
  });
});
