import { describe, expect, it } from 'vitest';
import { Sim, serialize } from '../sim';
import { buildRepro, loadRepro } from './repro';

describe('repro', () => {
  it('round-trips sim state, log and unicode errors', () => {
    const sim = new Sim(42);
    sim.enqueue({ type: 'debug.spawnMarker', x: 3, y: 4 });
    sim.step();
    sim.step();
    const errs = [{ message: 'boom ✨ ünï', stack: 'at x', time: 1 }];
    const s = buildRepro(sim, errs);
    const { sim: loaded, repro } = loadRepro(s);
    expect(repro.seed).toBe(42);
    expect(repro.tick).toBe(2);
    expect(repro.commandLog).toHaveLength(1);
    expect(repro.recentErrors).toEqual(errs);
    expect(serialize(loaded)).toBe(serialize(sim));
  });
  it('rejects bad version', () => {
    expect(() => loadRepro(btoa('{"v":2}'))).toThrow();
  });
});
