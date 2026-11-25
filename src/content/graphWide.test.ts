import { describe, expect, it } from 'vitest';
import { newGame } from '../sim/newGame';
import { nodesWithin } from '../sim/galaxy/graph';
import { FLEET_AREA_HOPS, REACH_HOPS } from '../sim/galaxy/tuning';
import { content } from '.';

/** The fleet area is wider than the cached reach (#602): it is cached too, and gives the same answer every time. */
describe('nodesWithin beyond REACH_HOPS', () => {
  const sim = newGame(1, content);
  const from = sim.galaxy.current;
  it('repeats the same answer, a superset of the cached reach', () => {
    const a = nodesWithin(sim, from, FLEET_AREA_HOPS);
    expect([...nodesWithin(sim, from, FLEET_AREA_HOPS)]).toEqual([...a]);
    for (const [id, d] of nodesWithin(sim, from, REACH_HOPS)) expect(a.get(id)).toBe(d);
    expect(Math.max(...a.values())).toBeLessThanOrEqual(FLEET_AREA_HOPS);
  });
});
