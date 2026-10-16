import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from '../ship';
import { Sim } from '../sim';
import { deserialize, serialize } from '../save';

const rows = ['#####', '#_#_#', '#_D_#', '#####'];

function make(): Sim {
  const sim = new Sim(1);
  sim.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
  return sim;
}
const roomRow = (sim: Sim, y: number) => [0, 1, 2, 3, 4].map((x) => sim.grids.get(1)!.get('room', x, y));

describe('rooms system', () => {
  it('flood fills with deterministic ids; doors and walls are 0', () => {
    const sim = make();
    sim.step();
    expect(roomRow(sim, 1)).toEqual([0, 1, 0, 2, 0]);
    expect(roomRow(sim, 2)).toEqual([0, 1, 0, 2, 0]);
  });
  it('recomputes after debug.setStruct opens a wall', () => {
    const sim = make();
    sim.step();
    sim.enqueue({ type: 'debug.setStruct', gridId: 1, x: 2, y: 1, kind: 1 });
    sim.step();
    expect(roomRow(sim, 1)).toEqual([0, 1, 1, 1, 0]);
    expect(roomRow(sim, 2)).toEqual([0, 1, 0, 1, 0]);
  });
  it('rejects invalid setStruct', () => {
    const sim = make();
    sim.enqueue({ type: 'debug.setStruct', gridId: 1, x: 99, y: 1, kind: 1 });
    sim.enqueue({ type: 'debug.setStruct', gridId: 1, x: 1, y: 1, kind: 9 });
    sim.enqueue({ type: 'debug.setStruct', gridId: 7, x: 1, y: 1, kind: 1 });
    sim.step();
    expect(sim.grids.get(1)!.get('struct', 1, 1)).toBe(1);
  });
  it('save round-trips and recomputes after load', () => {
    const sim = make();
    sim.step();
    const loaded = deserialize(serialize(sim), { ships: {}, roles: {}, species: {}, crewNames: [] });
    loaded.step();
    expect(roomRow(loaded, 1)).toEqual([0, 1, 0, 2, 0]);
  });
});
