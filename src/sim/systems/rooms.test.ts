import { describe, expect, it } from 'vitest';

import { Sim } from '../sim';

import { stampShip } from '../combat/ships';

import type { ShipTemplate } from '../registry';

import { deserialize, serialize } from '../save';

import { shipGrid } from '../regions';


/** A fixture ship: the template stamped at the sector origin as an inert ship (a prize is skipped by every ship system). It is the first entity, so its id is 1. */
function fixtureShip(sim: Sim, t: ShipTemplate): number {
  return stampShip(sim, t, { faction: 'player', state: 'prize', x: 0, y: 0 });
}

const rows = ['#####', '#_#_#', '#_D_#', '#####'];

function make(): Sim {
  const sim = new Sim(1);
  fixtureShip(sim, { name: 't', rows });
  return sim;
}
const roomRow = (sim: Sim, y: number) => [0, 1, 2, 3, 4].map((x) => shipGrid(sim, 1)!.get('room', x, y));

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
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 2, y: 1, kind: 1 });
    sim.step();
    expect(roomRow(sim, 1)).toEqual([0, 1, 1, 1, 0]);
    expect(roomRow(sim, 2)).toEqual([0, 1, 0, 1, 0]);
  });
  it('rejects invalid setStruct', () => {
    const sim = make();
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 99, y: 1, kind: 1 });
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y: 1, kind: 9 });
    sim.enqueue({ type: 'debug.setStruct', ship: 7, x: 1, y: 1, kind: 1 });
    sim.step();
    expect(shipGrid(sim, 1)!.get('struct', 1, 1)).toBe(1);
  });
  it('save round-trips and recomputes after load', () => {
    const sim = make();
    sim.step();
    const loaded = deserialize(serialize(sim), { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} });
    loaded.step();
    expect(roomRow(loaded, 1)).toEqual([0, 1, 0, 2, 0]);
  });
});
